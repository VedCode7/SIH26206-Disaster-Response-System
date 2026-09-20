from collections import Counter
from pathlib import Path
from typing import Any

from backend.app.data.geo.resource_loader import load_resource_data
from backend.app.data.geo.ward_loader import load_wards

DEFAULT_RESOURCE_DATASET = (
    Path(__file__).resolve().parent / "chennai_resources.json"
)
DEFAULT_WARD_GEOJSON = (
    Path(__file__).resolve().parent / "wards.geojson"
)


def get_ward_ids(path: str | Path = DEFAULT_WARD_GEOJSON) -> set[str]:
    """Return the canonical W-prefixed ward IDs from the GCC dataset."""
    ward_ids: set[str] = set()
    for feature in load_wards(path):
        properties = feature.get("properties", {})
        ward_id = properties.get("ward_id")
        if ward_id is not None:
            ward_ids.add(f"W{ward_id}")
    return ward_ids


def validate_resource_facilities(
    resource_path: str | Path = DEFAULT_RESOURCE_DATASET,
    ward_path: str | Path = DEFAULT_WARD_GEOJSON,
) -> dict[str, Any]:
    """Validate facility identity, geography, and ward references.

    This validator checks only facts represented by the persisted datasets.
    It deliberately does not infer operational capacity or availability.
    """
    dataset = load_resource_data(resource_path)
    resources = dataset.get("resources", [])
    ward_ids = get_ward_ids(ward_path)

    ids = [item.get("id") for item in resources]
    duplicate_ids = sorted(
        facility_id
        for facility_id, count in Counter(ids).items()
        if facility_id and count > 1
    )

    missing_coordinates = []
    invalid_wards = []
    for item in resources:
        facility_id = item.get("id", "<missing-id>")
        latitude = item.get("latitude")
        longitude = item.get("longitude")
        if latitude is None or longitude is None:
            missing_coordinates.append(facility_id)

        zone_id = item.get("current_zone_id")
        if zone_id not in ward_ids:
            invalid_wards.append(
                {"facility_id": facility_id, "current_zone_id": zone_id}
            )

    return {
        "facility_count": len(resources),
        "ward_count": len(ward_ids),
        "duplicate_ids": duplicate_ids,
        "missing_coordinates": missing_coordinates,
        "invalid_wards": invalid_wards,
        "valid": not (
            duplicate_ids or missing_coordinates or invalid_wards
        ),
    }


def assert_valid_resource_facilities(
    resource_path: str | Path = DEFAULT_RESOURCE_DATASET,
    ward_path: str | Path = DEFAULT_WARD_GEOJSON,
) -> dict[str, Any]:
    """Validate the persisted facility dataset and raise on geography errors."""
    report = validate_resource_facilities(resource_path, ward_path)
    if not report["valid"]:
        raise ValueError(f"Invalid Chennai resource facility dataset: {report}")
    return report


if __name__ == "__main__":
    report = assert_valid_resource_facilities()
    print(
        "Chennai resource validation passed: "
        f"{report['facility_count']} facilities across "
        f"{report['ward_count']} wards"
    )
