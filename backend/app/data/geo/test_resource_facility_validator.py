import json

import pytest

from backend.app.data.geo.resource_facility_validator import (
    assert_valid_resource_facilities,
    get_ward_ids,
    validate_resource_facilities,
)


def _wards():
    return {
        "type": "FeatureCollection",
        "features": [
            {"type": "Feature", "properties": {"ward_id": 1}},
            {"type": "Feature", "properties": {"ward_id": 2}},
        ],
    }


def _resources(items):
    return {"source": "OpenStreetMap", "resources": items}


def _facility(facility_id="OSMN1", zone="W1"):
    return {
        "id": facility_id,
        "resource_type": "hospital",
        "current_zone_id": zone,
        "name": "Example Hospital",
        "latitude": 13.05,
        "longitude": 80.25,
        "source": "OpenStreetMap",
    }


def _write_dataset(tmp_path, resources):
    resource_path = tmp_path / "resources.json"
    ward_path = tmp_path / "wards.geojson"
    resource_path.write_text(
        json.dumps(_resources(resources)), encoding="utf-8"
    )
    ward_path.write_text(json.dumps(_wards()), encoding="utf-8")
    return resource_path, ward_path


def test_get_ward_ids_uses_canonical_w_prefix(tmp_path):
    _, ward_path = _write_dataset(tmp_path, [])
    assert get_ward_ids(ward_path) == {"W1", "W2"}


def test_validator_accepts_valid_facilities(tmp_path):
    resource_path, ward_path = _write_dataset(
        tmp_path, [_facility(), _facility("OSMN2", "W2")]
    )

    report = validate_resource_facilities(resource_path, ward_path)

    assert report["valid"] is True
    assert report["facility_count"] == 2
    assert report["ward_count"] == 2
    assert report["duplicate_ids"] == []
    assert report["missing_coordinates"] == []
    assert report["invalid_wards"] == []


def test_validator_detects_duplicate_ids_and_invalid_wards(tmp_path):
    resource_path, ward_path = _write_dataset(
        tmp_path, [_facility(), _facility("OSMN1", "W999")]
    )

    report = validate_resource_facilities(resource_path, ward_path)

    assert report["valid"] is False
    assert report["duplicate_ids"] == ["OSMN1"]
    assert report["invalid_wards"] == [
        {"facility_id": "OSMN1", "current_zone_id": "W999"}
    ]


def test_validator_detects_missing_coordinates(tmp_path):
    facility = _facility()
    facility.pop("latitude")
    resource_path, ward_path = _write_dataset(tmp_path, [facility])

    report = validate_resource_facilities(resource_path, ward_path)

    assert report["valid"] is False
    assert report["missing_coordinates"] == ["OSMN1"]


def test_assert_validator_raises_for_invalid_dataset(tmp_path):
    resource_path, ward_path = _write_dataset(
        tmp_path, [_facility(zone="W999")]
    )

    with pytest.raises(ValueError, match="Invalid Chennai resource facility"):
        assert_valid_resource_facilities(resource_path, ward_path)
