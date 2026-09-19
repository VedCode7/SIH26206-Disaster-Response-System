import pytest

from backend.app.data.geo.road_zone_mapper import (
    RoadZoneMappingError,
    map_road_feature_to_zones,
    point_in_geometry,
    zone_for_point,
)


WARD_FEATURES = [
    {
        "type": "Feature",
        "properties": {"ward_id": "001"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
    },
    {
        "type": "Feature",
        "properties": {"ward_id": "002"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]],
        },
    },
]


def test_point_in_polygon():
    assert point_in_geometry(
        (0.5, 0.5), WARD_FEATURES[0]["geometry"]
    )
    assert not point_in_geometry(
        (1.5, 0.5), WARD_FEATURES[0]["geometry"]
    )


def test_zone_for_point():
    assert zone_for_point((0.5, 0.5), WARD_FEATURES) == "W001"
    assert zone_for_point((1.5, 0.5), WARD_FEATURES) == "W002"
    assert zone_for_point((3.0, 3.0), WARD_FEATURES) is None


def test_map_road_feature_to_zones():
    feature = {
        "type": "Feature",
        "properties": {"road_id": "R001"},
        "geometry": {
            "type": "LineString",
            "coordinates": [[0.5, 0.5], [1.5, 0.5]],
        },
    }

    assert map_road_feature_to_zones(feature, WARD_FEATURES) == (
        "W001",
        "W002",
    )


def test_map_road_rejects_same_zone():
    feature = {
        "type": "Feature",
        "properties": {"road_id": "R001"},
        "geometry": {
            "type": "LineString",
            "coordinates": [[0.2, 0.2], [0.8, 0.8]],
        },
    }

    with pytest.raises(RoadZoneMappingError):
        map_road_feature_to_zones(feature, WARD_FEATURES)


def test_map_road_rejects_unmapped_endpoint():
    feature = {
        "type": "Feature",
        "properties": {"road_id": "R001"},
        "geometry": {
            "type": "LineString",
            "coordinates": [[0.5, 0.5], [3.0, 3.0]],
        },
    }

    with pytest.raises(RoadZoneMappingError):
        map_road_feature_to_zones(feature, WARD_FEATURES)
