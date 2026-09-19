import json

import pytest

from backend.app.data.geo.road_loader import (
    load_road_geojson,
    load_roads,
    road_feature_to_model,
    load_road_models,
)


def test_load_road_geojson_rejects_missing_file(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_road_geojson(tmp_path / "missing.geojson")


def test_load_road_geojson_rejects_invalid_type(tmp_path):
    path = tmp_path / "roads.geojson"
    path.write_text(
        json.dumps({"type": "Feature", "features": []}),
        encoding="utf-8",
    )

    with pytest.raises(ValueError):
        load_road_geojson(path)


def test_load_road_geojson_rejects_missing_features(tmp_path):
    path = tmp_path / "roads.geojson"
    path.write_text(
        json.dumps({"type": "FeatureCollection"}),
        encoding="utf-8",
    )

    with pytest.raises(ValueError):
        load_road_geojson(path)


def test_load_roads_returns_features(tmp_path):
    path = tmp_path / "roads.geojson"
    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"road_id": "R001"},
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [80.20, 13.05],
                                [80.21, 13.06],
                            ],
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    roads = load_roads(path)

    assert len(roads) == 1
    assert roads[0]["properties"]["road_id"] == "R001"

def test_road_feature_to_model():
    feature = {
        "type": "Feature",
        "properties": {
            "road_id": "R001",
            "from_zone_id": "W001",
            "to_zone_id": "W002",
            "distance_km": 2.5,
            "travel_time_min": 5.0,
            "capacity": 1000,
            "road_type": "arterial",
        },
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [80.20, 13.05],
                [80.21, 13.06],
            ],
        },
    }

    road = road_feature_to_model(feature)

    assert road.id == "R001"
    assert road.from_zone_id == "W001"
    assert road.to_zone_id == "W002"
    assert road.distance_km == 2.5
    assert road.travel_time_min == 5.0
    assert road.path == (
        (80.20, 13.05),
        (80.21, 13.06),
    )
    assert road.capacity == 1000
    assert road.road_type == "arterial"


def test_load_road_models(tmp_path):
    path = tmp_path / "roads.geojson"

    path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "road_id": "R001",
                            "from_zone_id": "W001",
                            "to_zone_id": "W002",
                            "distance_km": 2.5,
                            "travel_time_min": 5.0,
                            "road_type": "arterial",
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [80.20, 13.05],
                                [80.21, 13.06],
                            ],
                        },
                    }
                ],
            }
        ),
        encoding="utf-8",
    )

    roads = load_road_models(path)

    assert len(roads) == 1
    assert roads[0].id == "R001"
    assert roads[0].from_zone_id == "W001"
    assert roads[0].to_zone_id == "W002"