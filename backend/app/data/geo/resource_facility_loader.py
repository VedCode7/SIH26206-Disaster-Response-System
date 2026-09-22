import json
from pathlib import Path
from typing import Any

from backend.app.domain.models.resources.resource_facility import ResourceFacility

DEFAULT_RESOURCE_GEOJSON = Path(__file__).resolve().parent / "emergency_resources.geojson"


def load_resource_facility_geojson(
    path: str | Path = DEFAULT_RESOURCE_GEOJSON,
) -> dict[str, Any]:
    geojson_path = Path(path)
    if not geojson_path.exists():
        raise FileNotFoundError(
            f"Emergency resource GeoJSON not found: {geojson_path}. "
            "Run the OSM resource importer first."
        )

    with geojson_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if data.get("type") != "FeatureCollection":
        raise ValueError("Emergency resource GeoJSON must be a FeatureCollection.")

    if not isinstance(data.get("features"), list):
        raise ValueError("Emergency resource GeoJSON must contain a features list.")

    return data


def load_resource_facilities(
    path: str | Path = DEFAULT_RESOURCE_GEOJSON,
) -> list[ResourceFacility]:
    data = load_resource_facility_geojson(path)
    facilities: list[ResourceFacility] = []

    for feature in data["features"]:
        properties = feature.get("properties", {})
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates")

        if geometry.get("type") != "Point" or not coordinates or len(coordinates) < 2:
            continue

        facilities.append(
            ResourceFacility(
                id=str(properties["id"]),
                name=str(properties.get("name")) if properties.get("name") is not None else None,
                resource_type=str(properties["resource_type"]),
                current_zone_id=str(properties["zone_id"]),
                latitude=float(coordinates[1]),
                longitude=float(coordinates[0]),
                source=str(properties.get("source", "OpenStreetMap")),
            )
        )

    return facilities


def facilities_by_zone(
    facilities: list[ResourceFacility],
) -> dict[str, list[ResourceFacility]]:
    grouped: dict[str, list[ResourceFacility]] = {}
    for facility in facilities:
        grouped.setdefault(facility.current_zone_id, []).append(facility)
    return grouped
