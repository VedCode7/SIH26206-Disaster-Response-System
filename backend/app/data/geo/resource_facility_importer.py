import json
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen

from backend.app.data.geo.osm_road_importer import (
    CHENNAI_BBOX,
    OVERPASS_FALLBACK_URLS,
    OVERPASS_REQUEST_TIMEOUT_SECONDS,
)
from backend.app.data.geo.ward_loader import load_wards

DEFAULT_OUTPUT = Path(__file__).resolve().parent / "chennai_resources.json"
RESOURCE_TAGS = (
    ("amenity", "hospital", "hospital"),
    ("amenity", "clinic", "clinic"),
    ("amenity", "police", "police_station"),
    ("amenity", "fire_station", "fire_station"),
    ("amenity", "shelter", "shelter"),
    ("emergency", "ambulance_station", "ambulance_station"),
)


def build_resource_query(
    bbox: tuple[float, float, float, float] = CHENNAI_BBOX,
) -> str:
    south, west, north, east = bbox
    clauses = [
        f'nwr["{key}"="{value}"]({south},{west},{north},{east});'
        for key, value, _ in RESOURCE_TAGS
    ]
    return f'[out:json][timeout:300];({"".join(clauses)});out center tags;'


def _download(query: str) -> dict[str, Any]:
    last_error: Exception | None = None
    for endpoint in OVERPASS_FALLBACK_URLS:
        try:
            url = f"{endpoint}?data={quote(query, safe='')}"
            request = Request(
                url,
                headers={"User-Agent": "SIH26206-resource-importer/1.0"},
            )
            with urlopen(request, timeout=OVERPASS_REQUEST_TIMEOUT_SECONDS) as response:
                return json.loads(response.read())
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"All Overpass mirrors failed: {last_error}") from last_error


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
        if not coordinates or not _point_in_ring(point, coordinates[0]):
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
    wards: list[dict[str, Any]],
) -> str | None:
    for ward in wards:
        if _point_in_geometry(point, ward.get("geometry")):
            ward_id = ward.get("properties", {}).get("ward_id")
            return None if ward_id is None else f"W{ward_id}"
    return None


def _element_point(element: dict[str, Any]) -> tuple[float, float] | None:
    if element.get("type") == "node":
        if "lon" in element and "lat" in element:
            return float(element["lon"]), float(element["lat"])
        return None
    center = element.get("center")
    if center and "lon" in center and "lat" in center:
        return float(center["lon"]), float(center["lat"])
    return None


def resources_from_osm(
    osm_data: dict[str, Any],
    wards: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Convert OSM facilities into geographically grounded facility records.

    No operational quantity is inferred here. Facility existence and location
    are facts from the source; deployable capacity belongs to a separate
    operational-resource layer and must be supplied by an authoritative source.
    """
    tag_to_type = {(key, value): resource_type for key, value, resource_type in RESOURCE_TAGS}
    resources: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for element in osm_data.get("elements", []):
        point = _element_point(element)
        if point is None:
            continue

        tags = element.get("tags", {})
        resource_type = next(
            (
                mapped_type
                for (key, value), mapped_type in tag_to_type.items()
                if tags.get(key) == value
            ),
            None,
        )
        if resource_type is None:
            continue

        osm_id = f"OSM{element.get('type', 'unknown')[:1].upper()}{element.get('id')}"
        if osm_id in seen_ids:
            continue

        zone_id = _zone_for_point(point, wards)
        if zone_id is None:
            continue

        resources.append(
            {
                "id": osm_id,
                "resource_type": resource_type,
                "current_zone_id": zone_id,
                "name": tags.get("name"),
                "latitude": point[1],
                "longitude": point[0],
                "source": "OpenStreetMap",
            }
        )
        seen_ids.add(osm_id)

    return resources


def download_chennai_resources(
    output_path: str | Path = DEFAULT_OUTPUT,
) -> Path:
    """Download real mapped emergency-relevant facilities for Chennai."""
    wards = load_wards()
    data = _download(build_resource_query())
    resources = resources_from_osm(data, wards)

    output = Path(output_path)
    output.write_text(
        json.dumps(
            {
                "source": "OpenStreetMap",
                "bbox": CHENNAI_BBOX,
                "resource_count": len(resources),
                "resources": resources,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Chennai resource dataset written: {len(resources)} facilities")
    return output


if __name__ == "__main__":
    download_chennai_resources()
