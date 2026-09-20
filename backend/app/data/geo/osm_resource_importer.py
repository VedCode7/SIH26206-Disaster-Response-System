import json
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen

from backend.app.data.geo.osm_road_importer import (
    CHENNAI_BBOX,
    _build_ward_index,
    _zone_for_point,
)
from backend.app.data.geo.ward_loader import load_wards

OVERPASS_URLS = (
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)
RESOURCE_BBOX = CHENNAI_BBOX
RESOURCE_QUERY = """[out:json][timeout:180];
(
  nwr["amenity"~"^(hospital|clinic|fire_station|police|shelter)$"]({south},{west},{north},{east});
  nwr["emergency"~"^(ambulance_station|rescue_station|disaster_response)$"]({south},{west},{north},{east});
);
out center tags;
"""

RESOURCE_TYPE_MAP = {
    "hospital": "hospital",
    "clinic": "clinic",
    "fire_station": "fire_station",
    "police": "police_station",
    "shelter": "shelter",
    "ambulance_station": "ambulance_station",
    "rescue_station": "rescue_station",
    "disaster_response": "disaster_response",
}


def build_resource_query(
    bbox: tuple[float, float, float, float] = RESOURCE_BBOX,
) -> str:
    south, west, north, east = bbox
    return RESOURCE_QUERY.format(
        south=south,
        west=west,
        north=north,
        east=east,
    )


def _download(query: str) -> dict[str, Any]:
    last_error: Exception | None = None
    encoded = quote(query, safe="")

    for endpoint in OVERPASS_URLS:
        url = f"{endpoint}?data={encoded}"
        try:
            request = Request(
                url,
                headers={"User-Agent": "SIH26206-resource-importer/1.0"},
            )
            with urlopen(request, timeout=60) as response:
                return json.loads(response.read())
        except HTTPError as exc:
            last_error = exc
            if exc.code in {429, 502, 503, 504}:
                time.sleep(2)
                continue
            break
        except Exception as exc:
            last_error = exc

    raise RuntimeError(f"Unable to download OSM resource data: {last_error}") from last_error


def _element_point(element: dict[str, Any]) -> tuple[float, float] | None:
    if element.get("type") == "node":
        if "lon" in element and "lat" in element:
            return float(element["lon"]), float(element["lat"])
        return None

    center = element.get("center")
    if isinstance(center, dict) and "lon" in center and "lat" in center:
        return float(center["lon"]), float(center["lat"])

    return None


def _resource_type(tags: dict[str, Any]) -> str | None:
    amenity = tags.get("amenity")
    if amenity in RESOURCE_TYPE_MAP:
        return RESOURCE_TYPE_MAP[amenity]

    emergency = tags.get("emergency")
    if emergency in RESOURCE_TYPE_MAP:
        return RESOURCE_TYPE_MAP[emergency]

    return None


def resources_from_osm(
    osm_data: dict[str, Any],
    ward_features: list[dict[str, Any]],
) -> dict[str, Any]:
    ward_index = _build_ward_index(ward_features)
    features: list[dict[str, Any]] = []
    seen: set[tuple[str, int | str]] = set()

    for element in osm_data.get("elements", []):
        element_type = element.get("type")
        element_id = element.get("id")
        tags = element.get("tags", {})
        point = _element_point(element)
        resource_type = _resource_type(tags)

        if not element_type or element_id is None or point is None or resource_type is None:
            continue

        identity = (element_type, element_id)
        if identity in seen:
            continue
        seen.add(identity)

        zone_id = _zone_for_point(point, ward_features, ward_index)
        if zone_id is None:
            continue

        name = str(tags.get("name") or tags.get("official_name") or f"OSM {resource_type}")
        emergency_value = tags.get("emergency")
        emergency_capable = None
        if emergency_value in {"yes", "no"}:
            emergency_capable = emergency_value == "yes"

        facility_id = f"OSM-{element_type.upper()}-{element_id}"
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": facility_id,
                    "name": name,
                    "resource_type": resource_type,
                    "zone_id": zone_id,
                    "source": "OpenStreetMap",
                    "osm_type": element_type,
                    "osm_id": element_id,
                    "emergency_capable": emergency_capable,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [point[0], point[1]],
                },
            }
        )

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "source": "OpenStreetMap",
            "resource_types": sorted(RESOURCE_TYPE_MAP.values()),
            "bbox": list(RESOURCE_BBOX),
            "note": "Facility presence is sourced from OSM; operational availability and unit counts are not inferred.",
        },
    }


def import_osm_resources(
    output_path: str | Path,
    bbox: tuple[float, float, float, float] = RESOURCE_BBOX,
) -> Path:
    data = _download(build_resource_query(bbox))
    resources = resources_from_osm(data, load_wards())
    output = Path(output_path)
    output.write_text(
        json.dumps(resources, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Emergency resource facilities written: {len(resources['features'])}")
    return output


if __name__ == "__main__":
    default_output = Path(__file__).resolve().parent / "emergency_resources.geojson"
    import_osm_resources(default_output)
