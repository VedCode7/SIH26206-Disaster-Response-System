import json
import math
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from backend.app.domain.models.routing import Road, RouteResult


DEFAULT_OSM_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "geo" / "chennai_roads_osm.json"
)

ROAD_ID_PATTERN = re.compile(r"^OSM(?P<way_id>\d+)(?:_(?P<segment>\d+))?$")

HIGHWAY_CLASSES = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
    "unclassified",
    "residential",
    "living_street",
    "service",
}


Point = tuple[float, float]


@dataclass(frozen=True)
class OSMNetwork:
    coordinates: dict[str, Point]
    adjacency: dict[str, tuple[tuple[str, float], ...]]
    way_nodes: dict[str, tuple[str, ...]]


_NETWORK_CACHE: dict[str, tuple[int, OSMNetwork]] = {}


def _resolve_osm_path(path: str | Path | None = None) -> Path:
    configured = path or os.environ.get("SIH26206_OSM_ROADS_PATH")
    return Path(configured) if configured else DEFAULT_OSM_PATH


def _node_key(point: Point) -> str:
    return f"{point[0]:.7f},{point[1]:.7f}"


def _distance_km(first: Point, second: Point) -> float:
    lon1, lat1 = math.radians(first[0]), math.radians(first[1])
    lon2, lat2 = math.radians(second[0]), math.radians(second[1])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    value = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    return 6371.0088 * 2 * math.atan2(
        math.sqrt(value),
        math.sqrt(max(1.0 - value, 0.0)),
    )


def _is_traversable_way(tags: dict) -> bool:
    highway = str(tags.get("highway", ""))
    if highway not in HIGHWAY_CLASSES:
        return False
    if str(tags.get("access", "")).lower() in {"no", "private"}:
        return False
    if str(tags.get("motor_vehicle", "")).lower() in {"no", "private"}:
        return False
    return True


def _oneway_mode(tags: dict) -> int:
    value = str(tags.get("oneway", "")).strip().lower()
    if value in {"yes", "true", "1"}:
        return 1
    if value == "-1":
        return -1
    if str(tags.get("junction", "")).lower() == "roundabout":
        return 1
    return 0


def load_osm_network(path: str | Path | None = None) -> OSMNetwork | None:
    """Load and cache the local Overpass road graph used for route geometry."""
    source = _resolve_osm_path(path)
    if not source.exists():
        return None

    stat = source.stat()
    cache_key = str(source.resolve())
    cached = _NETWORK_CACHE.get(cache_key)
    if cached and cached[0] == stat.st_mtime_ns:
        return cached[1]

    with source.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    coordinates: dict[str, Point] = {}
    adjacency: dict[str, list[tuple[str, float]]] = {}
    way_nodes: dict[str, tuple[str, ...]] = {}

    for element in data.get("elements", []):
        if element.get("type") != "way":
            continue

        tags = element.get("tags") or {}
        if not _is_traversable_way(tags):
            continue

        geometry = element.get("geometry") or []
        if len(geometry) < 2:
            continue

        points: list[Point] = []
        for item in geometry:
            try:
                point = (float(item["lon"]), float(item["lat"]))
            except (KeyError, TypeError, ValueError):
                continue
            points.append(point)

        if len(points) < 2:
            continue

        node_ids = tuple(_node_key(point) for point in points)
        way_id = str(element.get("id"))
        if way_id == "None":
            continue

        way_nodes[way_id] = node_ids

        for node_id, point in zip(node_ids, points):
            coordinates[node_id] = point
            adjacency.setdefault(node_id, [])

        mode = _oneway_mode(tags)
        for index in range(len(node_ids) - 1):
            first_id = node_ids[index]
            second_id = node_ids[index + 1]
            weight = _distance_km(points[index], points[index + 1])
            if weight <= 0:
                continue

            if mode == 1:
                adjacency[first_id].append((second_id, weight))
            elif mode == -1:
                adjacency[second_id].append((first_id, weight))
            else:
                adjacency[first_id].append((second_id, weight))
                adjacency[second_id].append((first_id, weight))

    network = OSMNetwork(
        coordinates=coordinates,
        adjacency={
            node_id: tuple(neighbors)
            for node_id, neighbors in adjacency.items()
        },
        way_nodes=way_nodes,
    )
    _NETWORK_CACHE[cache_key] = (stat.st_mtime_ns, network)
    return network


def _way_id_for_road(road_id: str) -> str | None:
    match = ROAD_ID_PATTERN.match(str(road_id))
    return match.group("way_id") if match else None


def _nearest_node(
    network: OSMNetwork,
    point: Point,
    way_id: str | None = None,
) -> str | None:
    """Snap a road endpoint to the corresponding real OSM graph node.

    Road GeoJSON stores coordinates rounded to seven decimal places, the same
    precision used by the local OSM graph. Prefer that exact node first. Only
    fall back to a nearest-node search when a tiny representation difference
    prevents an exact match. This avoids accidentally snapping a segment end
    to some other node on the same long OSM way.
    """
    exact_id = _node_key(point)
    if exact_id in network.coordinates:
        return exact_id

    candidates: Iterable[str]
    if way_id and way_id in network.way_nodes:
        candidates = network.way_nodes[way_id]
    else:
        candidates = network.coordinates.keys()

    best_id = None
    best_distance = float("inf")
    for node_id in candidates:
        coordinate = network.coordinates.get(node_id)
        if coordinate is None:
            continue
        dx = coordinate[0] - point[0]
        dy = coordinate[1] - point[1]
        distance = dx * dx + dy * dy
        if distance < best_distance:
            best_distance = distance
            best_id = node_id
    return best_id


def _dijkstra(
    network: OSMNetwork,
    start: str,
    goal: str,
) -> list[str] | None:
    """Return a physical OSM-road path between two graph nodes."""
    import heapq

    if start == goal:
        return [start]

    if start not in network.coordinates or goal not in network.coordinates:
        return None

    distances = {start: 0.0}
    previous: dict[str, str] = {}
    queue: list[tuple[float, str]] = [(0.0, start)]

    while queue:
        current_distance, current = heapq.heappop(queue)
        if current_distance != distances.get(current):
            continue
        if current == goal:
            break

        for neighbor, weight in network.adjacency.get(current, ()):
            candidate = current_distance + weight
            if candidate < distances.get(neighbor, float("inf")):
                distances[neighbor] = candidate
                previous[neighbor] = current
                heapq.heappush(queue, (candidate, neighbor))

    if goal not in distances:
        return None

    path = [goal]
    while path[-1] != start:
        path.append(previous[path[-1]])
    path.reverse()
    return path


def _append_unique(points: list[Point], new_points: Iterable[Point]) -> None:
    for point in new_points:
        if not points:
            points.append(point)
            continue
        if (
            abs(points[-1][0] - point[0]) < 1e-8
            and abs(points[-1][1] - point[1]) < 1e-8
        ):
            continue
        points.append(point)


def _oriented_road_path(road: Road, current_zone: str) -> list[Point]:
    path = list(road.path or ())
    if road.from_zone_id == current_zone:
        return path
    if road.to_zone_id == current_zone:
        return list(reversed(path))
    return path


def build_route_geometry(
    route: RouteResult,
    roads: list[Road],
    osm_path: str | Path | None = None,
    ward_features: list[dict] | None = None,
) -> dict | None:
    """
    Reconstruct a continuous LineString over the real OSM road graph.

    The disaster-aware zone/road route remains authoritative for which road
    segments are selected. The visual layer never connects wards with a
    synthetic straight line. Instead, every gap between two selected road
    segments is resolved through the persisted OSM graph itself, respecting
    the graph's real one-way topology.

    ``ward_features`` is retained for API compatibility with earlier callers,
    but it is deliberately not used as a routing boundary: clipping the OSM
    graph to an individual ward bounding box can disconnect perfectly valid
    road junctions at ward edges and was the reason some valid selections had
    no drawable physical route.
    """
    del ward_features

    network = load_osm_network(osm_path)
    if network is None:
        return None

    roads_by_id = {road.id: road for road in roads}
    selected = [roads_by_id.get(road_id) for road_id in route.road_path]
    if any(road is None for road in selected):
        return None

    selected_roads = [road for road in selected if road is not None]
    if not selected_roads:
        return None

    geometry: list[Point] = []
    current_zone = route.origin_zone_id

    for index, road in enumerate(selected_roads):
        oriented = _oriented_road_path(road, current_zone)
        if len(oriented) < 2:
            return None

        if index == 0:
            _append_unique(geometry, oriented)
        else:
            previous = selected_roads[index - 1]
            previous_zone = route.zone_path[index - 1]
            previous_oriented = _oriented_road_path(previous, previous_zone)
            previous_end = previous_oriented[-1]
            current_start = oriented[0]

            previous_way = _way_id_for_road(previous.id)
            current_way = _way_id_for_road(road.id)
            start_node = _nearest_node(network, previous_end, previous_way)
            end_node = _nearest_node(network, current_start, current_way)
            if start_node is None or end_node is None:
                return None

            connector_nodes = _dijkstra(network, start_node, end_node)
            if connector_nodes is None:
                return None

            connector_points = [
                network.coordinates[node]
                for node in connector_nodes
            ]
            _append_unique(geometry, [previous_end])
            _append_unique(geometry, connector_points)
            _append_unique(geometry, [current_start])
            _append_unique(geometry, oriented)

        current_zone = (
            route.zone_path[index + 1]
            if index + 1 < len(route.zone_path)
            else road.to_zone_id
        )

    if len(geometry) < 2:
        return None

    return {
        "type": "LineString",
        "coordinates": [
            [round(lon, 7), round(lat, 7)]
            for lon, lat in geometry
        ],
        "source": "osm-road-network",
        "road_ids": [road.id for road in selected_roads],
    }
