import json

import pytest

from backend.app.data.geo.road_loader import (
    load_road_geojson,
    load_roads,
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