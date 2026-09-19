import json
import math
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.app.data.geo.road_dataset_validator import validate_road_geojson
from backend.app.data.geo.ward_loader import load_wards

OVERPASS_URL = "https://overpass.private.coffee/api/interpreter"
OVERPASS_FALLBACK_URLS = (
    OVERPASS_URL,
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)
CHENNAI_BBOX = (12.80, 80.10, 13.23, 80.40)
DOWNLOAD_GRID_ROWS = 4
DOWNLOAD_GRID_COLUMNS = 4
OVERPASS_RETRIES = 1
OVERPASS_BACKOFF_SECONDS = 3
OVERPASS_REQUEST_TIMEOUT_SECONDS = 30
DEFAULT_SPEED_KMH = {
    "motorway": 80.0, "motorway_link": 50.0, "trunk": 70.0, "trunk_link": 45.0,
    "primary": 50.0, "primary_link": 40.0, "secondary": 40.0, "secondary_link": 35.0,
    "tertiary": 35.0, "tertiary_link": 30.0, "unclassified": 30.0,
    "residential": 25.0, "living_street": 15.0, "service": 15.0,
}
ROAD_CLASSES = tuple(DEFAULT_SPEED_KMH)
WARD_INDEX_CELL_DEGREES = 0.01
ROAD_SEGMENT_ZONE_SAMPLES = 32
BOUNDARY_SEARCH_ITERATIONS = 24


def build_overpass_query(bbox: tuple[float, float, float, float] = CHENNAI_BBOX) -> str:
    south, west, north, east = bbox
    classes = "|".join(ROAD_CLASSES)
    return f'[out:json][timeout:300];way["highway"~"^({classes})$"]({south},{west},{north},{east});out geom;'


def _download_osm_chunk(bbox: tuple[float, float, float, float]) -> dict[str, Any]:
    query = build_overpass_query(bbox)
    last_error: Exception | None = None

    for endpoint_index, endpoint in enumerate(OVERPASS_FALLBACK_URLS, start=1):
        url = f"{endpoint}?data={quote(query, safe='')}"
        for attempt in range(OVERPASS_RETRIES + 1):
            try:
                print(
                    f"    mirror {endpoint_index}/{len(OVERPASS_FALLBACK_URLS)}, "
                    f"attempt {attempt + 1}/{OVERPASS_RETRIES + 1}...",
                    flush=True,
                )
                request = Request(
                    url,
                    headers={"User-Agent": "SIH26206-road-importer/1.0"},
                )
                with urlopen(request, timeout=OVERPASS_REQUEST_TIMEOUT_SECONDS) as response:
                    data = json.loads(response.read())
                print(f"    OK: {len(data.get('elements', []))} OSM elements", flush=True)
                return data
            except HTTPError as exc:
                last_error = exc
                print(f"    HTTP {exc.code}", flush=True)
                if exc.code not in {429, 502, 503, 504}:
                    break
                if attempt < OVERPASS_RETRIES:
                    retry_after = exc.headers.get("Retry-After")
                    try:
                        delay = max(1, int(retry_after)) if retry_after else OVERPASS_BACKOFF_SECONDS
                    except ValueError:
                        delay = OVERPASS_BACKOFF_SECONDS
                    print(f"    waiting {delay}s before retry...", flush=True)
                    time.sleep(delay)
            except Exception as exc:
                last_error = exc
                print(f"    {type(exc).__name__}: {exc}", flush=True)
                break

    if isinstance(last_error, HTTPError):
        raise last_error
    if last_error is not None:
        raise RuntimeError(f"Overpass request failed: {last_error}") from last_error
    raise RuntimeError("Overpass request failed without an error response")


def download_osm_roads(
    output_path: str | Path,
    bbox: tuple[float, float, float, float] = CHENNAI_BBOX,
) -> Path:
    south, west, north, east = bbox
    lat_step = (north - south) / DOWNLOAD_GRID_ROWS
    lon_step = (east - west) / DOWNLOAD_GRID_COLUMNS
    ways_by_id: dict[int | str, dict[str, Any]] = {}
    total_chunks = DOWNLOAD_GRID_ROWS * DOWNLOAD_GRID_COLUMNS
    chunk_number = 0

    for row in range(DOWNLOAD_GRID_ROWS):
        chunk_south = south + row * lat_step
        chunk_north = north if row == DOWNLOAD_GRID_ROWS - 1 else chunk_south + lat_step
        for column in range(DOWNLOAD_GRID_COLUMNS):
            chunk_west = west + column * lon_step
            chunk_east = east if column == DOWNLOAD_GRID_COLUMNS - 1 else chunk_west + lon_step
            chunk_bbox = (chunk_south, chunk_west, chunk_north, chunk_east)
            chunk_number += 1
            print(f"Downloading chunk {chunk_number}/{total_chunks}: {chunk_bbox}", flush=True)
            try:
                chunk_data = _download_osm_chunk(chunk_bbox)
            except HTTPError as exc:
                raise RuntimeError(
                    f"Overpass request failed for chunk {chunk_bbox} with HTTP {exc.code}. "
                    "All configured public Overpass mirrors were unavailable or busy; retry later."
                ) from exc
            for element in chunk_data.get("elements", []):
                if element.get("type") != "way":
                    continue
                way_id = element.get("id")
                if way_id is not None:
                    ways_by_id[way_id] = element

    output = Path(output_path)
    output.write_text(
        json.dumps(
            {
                "version": 0.6,
                "generator": "SIH26206-road-importer",
                "elements": list(ways_by_id.values()),
            }
        ),
        encoding="utf-8",
    )
    print(f"OSM dataset written: {len(ways_by_id)} unique ways", flush=True)
    return output


def _point_in_ring(point: tuple[float, float], ring: list[list[float]]) -> bool:
    x, y = point
    inside = False
    for index in range(len(ring)):
        x1, y1 = ring[index - 1]
        x2, y2 = ring[index]
        if (y1 > y) != (y2 > y):
            intersection_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < intersection_x:
                inside = not inside
    return inside


def _point_in_geometry(point: tuple[float, float], geometry: dict[str, Any] | None) -> bool:
    if not geometry:
        return False
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    if geometry_type == "Polygon":
        if not coordinates or not _point_in_ring(point, coordinates[0]):
            return False
        return not any(_point_in_ring(point, hole) for hole in coordinates[1:])
    if geometry_type == "MultiPolygon":
        return any(_point_in_geometry(point, {"type": "Polygon", "coordinates": polygon}) for polygon in coordinates or [])
    return False


def _geometry_bbox(geometry: dict[str, Any] | None) -> tuple[float, float, float, float] | None:
    if not geometry:
        return None
    points: list[tuple[float, float]] = []
    def collect(value: Any) -> None:
        if isinstance(value, (list, tuple)):
            if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
                points.append((float(value[0]), float(value[1])))
            else:
                for item in value:
                    collect(item)
    collect(geometry.get("coordinates"))
    if not points:
        return None
    return min(x for x, _ in points), min(y for _, y in points), max(x for x, _ in points), max(y for _, y in points)


def _index_key(point: tuple[float, float]) -> tuple[int, int]:
    return math.floor(point[0] / WARD_INDEX_CELL_DEGREES), math.floor(point[1] / WARD_INDEX_CELL_DEGREES)


def _build_ward_index(ward_features: list[dict[str, Any]]) -> dict[tuple[int, int], list[dict[str, Any]]]:
    index: dict[tuple[int, int], list[dict[str, Any]]] = {}
    for feature in ward_features:
        bbox = _geometry_bbox(feature.get("geometry"))
        if bbox is None:
            continue
        min_lon, min_lat, max_lon, max_lat = bbox
        min_x, min_y = _index_key((min_lon, min_lat))
        max_x, max_y = _index_key((max_lon, max_lat))
        for cell_x in range(min_x, max_x + 1):
            for cell_y in range(min_y, max_y + 1):
                index.setdefault((cell_x, cell_y), []).append(feature)
    return index


def _zone_for_point(point: tuple[float, float], ward_features: list[dict[str, Any]], ward_index: dict[tuple[int, int], list[dict[str, Any]]] | None = None) -> str | None:
    candidates = ward_index.get(_index_key(point), []) if ward_index is not None else ward_features
    for feature in candidates:
        if _point_in_geometry(point, feature.get("geometry")):
            ward_id = feature.get("properties", {}).get("ward_id")
            return None if ward_id is None else f"W{ward_id}"
    return None


def _distance_km(first: tuple[float, float], second: tuple[float, float]) -> float:
    lon1, lat1 = map(math.radians, first)
    lon2, lat2 = map(math.radians, second)
    dlon, dlat = lon2 - lon1, lat2 - lat1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0088 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def _speed_kmh(tags: dict[str, Any]) -> float:
    highway = str(tags.get("highway", ""))
    maxspeed = tags.get("maxspeed")
    if maxspeed is not None:
        try:
            numeric = float(str(maxspeed).split()[0])
            if numeric > 0:
                return numeric
        except ValueError:
            pass
    return DEFAULT_SPEED_KMH.get(highway, 25.0)


def _interpolate(start: tuple[float, float], end: tuple[float, float], fraction: float) -> tuple[float, float]:
    return start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction


def _cross_ward_segments(start: tuple[float, float], end: tuple[float, float], zone_for_point: Any) -> list[tuple[tuple[float, float], tuple[float, float], str, str]]:
    samples = []
    for index in range(ROAD_SEGMENT_ZONE_SAMPLES + 1):
        fraction = index / ROAD_SEGMENT_ZONE_SAMPLES
        point = _interpolate(start, end, fraction)
        samples.append((fraction, point, zone_for_point(point)))
    transitions = []
    previous_fraction, previous_point, previous_zone = samples[0]
    for fraction, point, zone in samples[1:]:
        if zone is None or previous_zone is None:
            previous_fraction, previous_point, previous_zone = fraction, point, zone
            continue
        if zone == previous_zone:
            previous_fraction, previous_point = fraction, point
            continue
        low_fraction, low_point = previous_fraction, previous_point
        high_fraction, high_point = fraction, point
        for _ in range(BOUNDARY_SEARCH_ITERATIONS):
            mid_fraction = (low_fraction + high_fraction) / 2.0
            mid_point = _interpolate(start, end, mid_fraction)
            if zone_for_point(mid_point) == previous_zone:
                low_fraction, low_point = mid_fraction, mid_point
            else:
                high_fraction, high_point = mid_fraction, mid_point
        transitions.append((high_point, previous_zone, zone))
        previous_fraction, previous_point, previous_zone = fraction, point, zone
    if not transitions:
        return []
    start_zone = zone_for_point(start)
    end_zone = zone_for_point(end)
    if len(transitions) == 1 and start_zone is not None and end_zone is not None and start_zone != end_zone:
        return [(start, end, start_zone, end_zone)]
    segments = []
    segment_start = start
    segment_zone = start_zone
    for boundary_point, from_zone, to_zone in transitions:
        if segment_zone == from_zone:
            segments.append((segment_start, boundary_point, from_zone, to_zone))
        segment_start, segment_zone = boundary_point, to_zone
    final_zone = end_zone
    if segment_zone is not None and final_zone is not None and segment_zone != final_zone:
        segments.append((segment_start, end, segment_zone, final_zone))
    return [segment for segment in segments if segment[2] != segment[3]]


def roads_from_osm(osm_data: dict[str, Any], ward_features: list[dict[str, Any]]) -> dict[str, Any]:
    features: list[dict[str, Any]] = []
    ward_index = _build_ward_index(ward_features)
    point_zone_cache: dict[tuple[float, float], str | None] = {}
    def zone_for_point(point: tuple[float, float]) -> str | None:
        if point not in point_zone_cache:
            point_zone_cache[point] = _zone_for_point(point, ward_features, ward_index)
        return point_zone_cache[point]
    for element in osm_data.get("elements", []):
        if element.get("type") != "way":
            continue
        tags = element.get("tags", {})
        highway = tags.get("highway")
        geometry = element.get("geometry", [])
        if highway not in ROAD_CLASSES or len(geometry) < 2:
            continue
        speed = _speed_kmh(tags)
        way_id = element.get("id")
        for index, (first, second) in enumerate(zip(geometry, geometry[1:])):
            start = (float(first["lon"]), float(first["lat"]))
            end = (float(second["lon"]), float(second["lat"]))
            cross_ward_segments = _cross_ward_segments(start, end, zone_for_point)
            for segment_index, (segment_start, segment_end, from_zone, to_zone) in enumerate(cross_ward_segments):
                distance = _distance_km(segment_start, segment_end)
                road_id = f"OSM{way_id}_{index}" if len(cross_ward_segments) == 1 else f"OSM{way_id}_{index}_{segment_index}"
                features.append({
                    "type": "Feature",
                    "properties": {
                        "road_id": road_id, "from_zone_id": from_zone, "to_zone_id": to_zone,
                        "distance_km": round(distance, 6), "travel_time_min": round(distance / speed * 60.0, 4),
                        "capacity": None, "road_type": str(highway),
                    },
                    "geometry": {"type": "LineString", "coordinates": [[segment_start[0], segment_start[1]], [segment_end[0], segment_end[1]]]},
                })
    return {"type": "FeatureCollection", "features": features}


def generate_road_geojson(osm_path: str | Path, output_path: str | Path, ward_path: str | Path | None = None) -> Path:
    osm_data = json.loads(Path(osm_path).read_text(encoding="utf-8"))
    ward_features = load_wards(ward_path) if ward_path else load_wards()
    data = roads_from_osm(osm_data, ward_features)
    valid_zone_ids = {f"W{feature['properties']['ward_id']}" for feature in ward_features if feature.get("properties", {}).get("ward_id") is not None}
    validate_road_geojson(data, valid_zone_ids=valid_zone_ids)
    output = Path(output_path)
    output.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return output
