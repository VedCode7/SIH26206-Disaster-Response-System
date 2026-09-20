import json

import pytest

from backend.app.data.geo.resource_loader import load_resource_data, load_resource_facilities


def _dataset():
    return {
        "source": "OpenStreetMap",
        "resources": [
            {
                "id": "OSMN1",
                "resource_type": "fire_station",
                "current_zone_id": "W1",
                "name": "Example Fire Station",
                "latitude": 13.05,
                "longitude": 80.25,
                "source": "OpenStreetMap",
            }
        ],
    }


def test_loader_preserves_facility_semantics(tmp_path):
    path = tmp_path / "resources.json"
    path.write_text(json.dumps(_dataset()), encoding="utf-8")

    facilities = load_resource_facilities(path)

    assert len(facilities) == 1
    assert facilities[0].resource_type == "fire_station"
    assert facilities[0].current_zone_id == "W1"
    assert facilities[0].latitude == 13.05
    assert facilities[0].longitude == 80.25
    assert not hasattr(facilities[0], "quantity")


def test_loader_rejects_non_osm_dataset(tmp_path):
    path = tmp_path / "resources.json"
    path.write_text(
        json.dumps({"source": "synthetic", "resources": []}),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="OpenStreetMap"):
        load_resource_data(path)
