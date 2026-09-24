import heapq
import json
import math
import os
import re
from collections import OrderedDict
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

# Connector paths are independent of the disaster-aware road state. They only
# depend on the persisted OSM graph and the two snapped graph nodes, so they
# are safe to reuse while the OSM source file remains unchanged.
_CONNECTOR_CACHE: OrderedDict[tuple[str, int, str, str], tuple[str, ...]] = OrderedDict()
_CONNECTOR_CACHE_LIMIT = 2048

# The complete reconstructed LineString is also safe to reuse for an identical
# authoritative route against the same OSM source version. Keeping this cache
# small prevents route exploration from turning into unbounded memory growth.
_GEOMETRY_CACHE: OrderedDict[
    tuple[str, int, tuple[str, ...], tuple[str, ...]], dict
] = OrderedDict()
_GEOMETRY_CACHE_LIMIT = 128


def _resolve_osm_path(path: str | Path | None = None) -> Path:
    configured = path or os.environ.get("SIH26206_OSM_ROADS_PATH")
    return Path(configured) if configured else DEFAULT_OSM_PATH


def _source_version(path: Path) -> tuple[str, int] | None:
    """Return a stable cache identity for the current OSM source file."""
    try:
        stat = path.stat()
    except OSError:
        return None
    return str(path.resolve()), stat.st_mtime_ns


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

    # A source-file replacement is a new physical network. The source version
    # is already part of connector/geometry cache keys, but dropping stale
    # entries keeps the in-process caches compact after repeated data refreshes.
    if len(_NETWORK_CACHE) > 8:
        oldest_key = next(iter(_NETWORK_CACHE))
        if oldest_key != cache_key:
            del _NETWORK_CACHE[oldest_key]

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


def _directed_edge_weight(
    network: OSMNetwork,
    start: str,
    goal: str,
) -> float | None:
    """Return the real directed edge weight when two nodes are adjacent."""
    for neighbor, weight in network.adjacency.get(start, ()):
        if neighbor == goal:
            return weight
    return None


def _astar(
    network: OSMNetwork,
    start: str,
    goal: str,
) -> list[str] | None:
    """Return a shortest physical OSM-road path using A*.

    The straight-line geographic distance is an admissible lower bound for
    road distance, so the heuristic preserves shortest-path correctness while
    avoiding exploration of large portions of the Chennai graph that Dijkstra
    would visit before reaching the target.
    """
    if start == goal:
        return [start]

    start_point = network.coordinates.get(start)
    goal_point = network.coordinates.get(goal)
    if start_point is None or goal_point is None:
        return None

    distances = {start: 0.0}
    previous: dict[str, str] = {}
    queue: list[tuple[float, float, str]] = [
        (_distance_km(start_point, goal_point), 0.0, start)
    ]

    while queue:
        _, current_distance, current = heapq.heappop(queue)
        if current_distance != distances.get(current):
            continue
        if current == goal:
            break

        for neighbor, weight in network.adjacency.get(current, ()):
            candidate = current_distance + weight
            if candidate >= distances.get(neighbor, float("inf")):
                continue

            distances[neighbor] = candidate
            previous[neighbor] = current
            neighbor_point = network.coordinates[neighbor]
            heuristic = _distance_km(neighbor_point, goal_point)
            heapq.heappush(
                queue,
                (candidate + heuristic, candidate, neighbor),
            )

    if goal not in distances:
        return None

    path = [goal]
    while path[-1] != start:
        path.append(previous[path[-1]])
    path.reverse()
    return path


def _connector_path(
    network: OSMNetwork,
    source_version: tuple[str, int],
    start: str,
    goal: str,
) -> list[str] | None:
    """Resolve and cache one physical connector between two road endpoints."""
    cache_key = (source_version[0], source_version[1], start, goal)
    cached = _CONNECTOR_CACHE.get(cache_key)
    if cached is not None:
        _CONNECTOR_CACHE.move_to_end(cache_key)
        return list(cached)

    # Most consecutive selected road segments already meet at a real graph
    # edge. Avoid any graph search in that common case.
    if _directed_edge_weight(network, start, goal) is not None:
        path = [start, goal]
    else:
        path = _astar(network, start, goal)

    if path is None:
        return None

    _CONNECTOR_CACHE[cache_key] = tuple(path)
    _CONNECTOR_CACHE.move_to_end(cache_key)
    if len(_CONNECTOR_CACHE) > _CONNECTOR_CACHE_LIMIT:
        _CONNECTOR_CACHE.popitem(last=False)

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

    source = _resolve_osm_path(osm_path)
    source_version = _source_version(source)
    if source_version is None:
        return None

    geometry_cache_key = (
        source_version[0],
        source_version[1],
        tuple(route.zone_path),
        tuple(route.road_path),
    )
    cached_geometry = _GEOMETRY_CACHE.get(geometry_cache_key)
    if cached_geometry is not None:
        _GEOMETRY_CACHE.move_to_end(geometry_cache_key)
        return cached_geometry

    network = load_osm_network(source)
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

            connector_nodes = _connector_path(
                network,
                source_version,
                start_node,
                end_node,
            )
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

    result = {
        "type": "LineString",
        "coordinates": [
            [round(lon, 7), round(lat, 7)]
            for lon, lat in geometry
        ],
        "source": "osm-road-network",
        "road_ids": [road.id for road in selected_roads],
    }

    _GEOMETRY_CACHE[geometry_cache_key] = result
    _GEOMETRY_CACHE.move_to_end(geometry_cache_key)
    if len(_GEOMETRY_CACHE) > _GEOMETRY_CACHE_LIMIT:
        _GEOMETRY_CACHE.popitem(last=False)

    return result
