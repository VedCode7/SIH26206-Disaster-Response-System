from backend.app.data.geo.osm_road_importer import (
    build_overpass_query,
    roads_from_osm,
)


WARD_FEATURES = [
    {
        "type": "Feature",
        "properties": {"ward_id": "001"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[80.0, 13.0], [80.1, 13.0], [80.1, 13.1], [80.0, 13.1], [80.0, 13.0]]],
        },
    },
    {
        "type": "Feature",
        "properties": {"ward_id": "002"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[80.1, 13.0], [80.2, 13.0], [80.2, 13.1], [80.1, 13.1], [80.1, 13.0]]],
        },
    },
]


def test_build_overpass_query_targets_supported_roads():
    query = build_overpass_query((13.0, 80.0, 13.1, 80.2))
    assert '[out:json]' in query
    assert '["highway"~"^(' in query
    assert '(13.0,80.0,13.1,80.2)' in query
    assert 'out geom;' in query


def test_roads_from_osm_creates_cross_ward_feature():
    osm_data = {"elements": [{"type": "way", "id": 123, "tags": {"highway": "primary"}, "geometry": [
        {"lon": 80.05, "lat": 13.05}, {"lon": 80.15, "lat": 13.05},
    ]}]}
    result = roads_from_osm(osm_data, WARD_FEATURES)
    assert len(result["features"]) == 1
    feature = result["features"][0]
    assert feature["properties"]["road_id"] == "OSM123_0"
    assert feature["properties"]["from_zone_id"] == "W001"
    assert feature["properties"]["to_zone_id"] == "W002"
    assert feature["properties"]["road_type"] == "primary"
    assert feature["properties"]["distance_km"] > 0
    assert feature["properties"]["travel_time_min"] > 0


def test_roads_from_osm_detects_crossing_between_vertices():
    osm_data = {"elements": [{"type": "way", "id": 321, "tags": {"highway": "primary"}, "geometry": [
        {"lon": 80.05, "lat": 13.05}, {"lon": 80.08, "lat": 13.08},
        {"lon": 80.12, "lat": 13.08}, {"lon": 80.15, "lat": 13.05},
    ]}]}
    result = roads_from_osm(osm_data, WARD_FEATURES)
    assert len(result["features"]) == 1
    feature = result["features"][0]
    assert feature["properties"]["from_zone_id"] == "W001"
    assert feature["properties"]["to_zone_id"] == "W002"
    assert feature["properties"]["road_id"] == "OSM321_1"


def test_roads_from_osm_skips_same_ward_segments():
    osm_data = {"elements": [{"type": "way", "id": 456, "tags": {"highway": "residential"}, "geometry": [
        {"lon": 80.02, "lat": 13.02}, {"lon": 80.08, "lat": 13.08},
    ]}]}
    result = roads_from_osm(osm_data, WARD_FEATURES)
    assert result["features"] == []


def test_roads_from_osm_uses_maxspeed_when_available():
    osm_data = {"elements": [{"type": "way", "id": 789, "tags": {"highway": "secondary", "maxspeed": "60 km/h"}, "geometry": [
        {"lon": 80.05, "lat": 13.05}, {"lon": 80.15, "lat": 13.05},
    ]}]}
    result = roads_from_osm(osm_data, WARD_FEATURES)
    feature = result["features"][0]
    assert 10 < feature["properties"]["travel_time_min"] < 12


def test_roads_from_osm_ignores_unsupported_highway_classes():
    osm_data = {"elements": [{"type": "way", "id": 999, "tags": {"highway": "footway"}, "geometry": [
        {"lon": 80.05, "lat": 13.05}, {"lon": 80.15, "lat": 13.05},
    ]}]}
    result = roads_from_osm(osm_data, WARD_FEATURES)
    assert result["features"] == []
