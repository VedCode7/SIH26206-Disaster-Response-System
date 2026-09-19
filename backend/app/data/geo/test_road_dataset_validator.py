import pytest

from backend.app.data.geo.road_dataset_validator import (
    validate_road_file,
    validate_road_geojson,
)


def _feature(**overrides):
    properties = {
        "road_id": "R001",
        "from_zone_id": "W001",
        "to_zone_id": "W002",
        "distance_km": 2.5,
        "travel_time_min": 5.0,
        "capacity": None,
        "road_type": "arterial",
    }
    properties.update(overrides.pop("properties", {}))

    feature = {
        "type": "Feature",
        "properties": properties,
        "geometry": {
            "type": "LineString",
            "coordinates": [[80.20, 13.05], [80.21, 13.06]],
        },
    }
    feature.update(overrides)
    return feature


def _dataset(*features):
    return {
        "type": "FeatureCollection",
        "features": list(features),
    }


def test_validate_road_geojson_accepts_valid_dataset():
    data = _dataset(_feature())

    assert validate_road_geojson(data, {"W001", "W002"}) is data


def test_validate_road_geojson_rejects_duplicate_road_ids():
    with pytest.raises(ValueError, match="Duplicate road_id"):
        validate_road_geojson(_dataset(_feature(), _feature()))


def test_validate_road_geojson_rejects_self_loop():
    with pytest.raises(ValueError, match="cannot connect a zone to itself"):
        validate_road_geojson(
            _dataset(
                _feature(
                    properties={"from_zone_id": "W001", "to_zone_id": "W001"}
                )
            )
        )


def test_validate_road_geojson_rejects_unknown_zone():
    with pytest.raises(ValueError, match="unknown to_zone_id"):
        validate_road_geojson(
            _dataset(_feature(properties={"to_zone_id": "W999"})),
            {"W001", "W002"},
        )


def test_validate_road_geojson_rejects_invalid_geometry():
    with pytest.raises(ValueError, match="LineString"):
        validate_road_geojson(
            _dataset(
                _feature(
                    geometry={
                        "type": "Point",
                        "coordinates": [80.20, 13.05],
                    }
                )
            )
        )


def test_validate_road_geojson_rejects_non_positive_metrics():
    with pytest.raises(ValueError, match="positive distance_km"):
        validate_road_geojson(
            _dataset(_feature(properties={"distance_km": 0}))
        )


def test_validate_road_geojson_rejects_bad_coordinate():
    with pytest.raises(ValueError, match="invalid coordinate"):
        validate_road_geojson(
            _dataset(
                _feature(
                    geometry={
                        "type": "LineString",
                        "coordinates": [[80.20, 13.05], ["bad", 13.06]],
                    }
                )
            )
        )


def test_validate_road_file_rejects_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        validate_road_file(tmp_path / "missing.geojson")
