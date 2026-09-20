from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


def test_chennai_ward_geometry_endpoint():
    response = client.get("/world/wards")

    assert response.status_code == 200

    data = response.json()

    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 200

    for feature in data["features"]:
        assert feature["type"] == "Feature"
        assert feature["geometry"] is not None
        assert feature["properties"]["ward_id"] is not None


def test_chennai_ward_geometry_matches_world_zone_count():
    response = client.get("/world/wards")
    assert response.status_code == 200

    ward_ids = {
        feature["properties"]["ward_id"]
        for feature in response.json()["features"]
    }

    assert len(ward_ids) == 200
