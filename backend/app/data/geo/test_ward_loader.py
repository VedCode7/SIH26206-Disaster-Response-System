from backend.app.data.geo.ward_loader import (
    load_ward_geojson,
    load_wards,
)


def test_load_ward_geojson():
    data = load_ward_geojson()

    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 200


def test_load_wards():
    wards = load_wards()

    assert len(wards) == 200

    first = wards[0]

    assert first["type"] == "Feature"
    assert first["geometry"]["type"] == "Polygon"

    properties = first["properties"]

    assert "ward_id" in properties
    assert "ward" in properties
    assert "zone_id" in properties
    assert "zone" in properties
    assert "region" in properties