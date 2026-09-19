import json
import math
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen

from backend.app.data.geo.ward_loader import load_wards


OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Chennai Metropolitan Corporation-area bounding box, expressed as
# south, west, north, east for Overpass.
CHENNAI_BBOX = (12.80, 80.10, 13.20, 80.40)

DEFAULT_SPEED_KMH = {
    "motorway": 80.0,
    "motorway_link": 50.0,
    "trunk": 70.0,
    "trunk_link": 45.0,
    "primary": 50.0,
    "primary_link": 40.0,
    "secondary": 40.0,
    "secondary_link": 35.0,
    "tertiary": 35.0,
    "tertiary_link": 30.0,
    "unclassified": 30.0,
    "residential": 25.0,
    "living_street": 15.0,
    "service": 15.0,
}

ROAD_CLASSES = tuple(DEFAULT_SPEED_KMH)


def build_overpass_query(
    bbox: tuple[float, float, float, float] = CHENNAI_BBOX,
) -> str:
    south, west, north, east = bbox
    classes = "|".join(ROAD_CLASSES)
    return (
        f'[out:json][timeout:300];'
        f'way["highway"~"^({classes})$"]'
        f'({south},{west},{north},{east});'
        f'out geom;'
    )


def download_osm_roads(
    output_path: str | Path,
    bbox: tuple[float, float, float, float] = CHENNAI_BBOX,
) -> Path:
    """Download Chennai road ways from Overpass as raw OSM JSON."""
    query = build_overpass_query(bbox)
    url = f"{OVERPASS_URL}?data={quote(query, safe='')}"
    request = Request(url, headers={"User-Agent": "SIH26206-road-importer/1.0"})

    output = Path(output_path)
    with urlopen(request, timeout=360) as response:
        payload = response.read()

    json.loads(payload)
    output.write_bytes(payload)
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


def _point_in_geometry(
    point: tuple[float, float],
    geometry: dict[str, Any] | None,
) -> bool:
    if not geometry:
        return False

    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")

    if geometry_type == "Polygon":
        if not coordinates:
            return False
        if not _point_in_ring(point, coordinates[0]):
            return False
        return not any(_point_in_ring(point, hole) for hole in coordinates[1:])

    if geometry_type == "MultiPolygon":
        return any(
            _point_in_geometry(point, {"type": "Polygon", "coordinates": polygon})
            for polygon in coordinates or []
        )

    return False


def _zone_for_point(
    point: tuple[float, float],
    ward_features: list[dict[str, Any]],
) -> str | None:
    for feature in ward_features:
        if _point_in_geometry(point, feature.get("geometry")):
            properties = feature.get("properties", {})
            ward_id = properties.get("ward_id")
            if ward_id is None:
                return None
            return f"W{ward_id}"
    return None


def _distance_km(
    first: tuple[float, float],
    second: tuple[float, float],
) -> float:
    lon1, lat1 = map(math.radians, first)
    lon2, lat2 = map(math.radians, second)
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    value = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
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


def roads_from_osm(
    osm_data: dict[str, Any],
    ward_features: list[dict[str, Any]],
) -> dict[str, Any]:
    """Convert OSM highway ways into cross-ward Road GeoJSON features."""
    features: list[dict[str, Any]] = []

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
            from_zone = _zone_for_point(start, ward_features)
            to_zone = _zone_for_point(end, ward_features)

            if from_zone is None or to_zone is None or from_zone == to_zone:
                continue

            distance = _distance_km(start, end)
            travel_time = distance / speed * 60.0
            road_id = f"OSM{way_id}_{index}"

            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "road_id": road_id,
                        "from_zone_id": from_zone,
                        "to_zone_id": to_zone,
                        "distance_km": round(distance, 6),
                        "travel_time_min": round(travel_time, 4),
                        "capacity": None,
                        "road_type": str(highway),
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[start[0], start[1]], [end[0], end[1]]],
                    },
                }
            )

    return {
        "type": "FeatureCollection",
        "features": features,
    }


def generate_road_geojson(
    osm_path: str | Path,
    output_path: str | Path,
    ward_path: str | Path | None = None,
) -> Path:
    """Generate the application's ward-aware roads.geojson dataset."""
    osm_data = json.loads(Path(osm_path).read_text(encoding="utf-8"))
    ward_features = load_wards(ward_path) if ward_path else load_wards()
    data = roads_from_osm(osm_data, ward_features)

    output = Path(output_path)
    output.write_text(
        json.dumps(data, indent=2),
        encoding="utf-8",
    )
    return output
