import pytest

from fastapi.testclient import TestClient

from backend.app.main import (
    app,
    create_demo_roads,
    road_network_store,
)


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_road_network():
    road_network_store.replace_roads(
        create_demo_roads()
    )


def test_update_zone_water_level():
    response = client.post(
        "/world/zones/Z001/update",
        json={
            "water_depth_m": 2.5,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "updated"
    assert data["zone"]["id"] == "Z001"
    assert data["zone"]["water_depth_m"] == 2.5


def test_update_multiple_zone_conditions():
    response = client.post(
        "/world/zones/Z001/update",
        json={
            "water_depth_m": 1.8,
            "rainfall_mm_per_hr": 90.0,
            "accessibility_percent": 40.0,
        },
    )

    assert response.status_code == 200

    zone = response.json()["zone"]

    assert zone["water_depth_m"] == 1.8
    assert zone["rainfall_mm_per_hr"] == 90.0
    assert zone["accessibility_percent"] == 40.0


def test_update_keeps_unspecified_values():
    response = client.post(
        "/world/zones/Z001/update",
        json={
            "water_depth_m": 3.0,
        },
    )

    assert response.status_code == 200

    zone = response.json()["zone"]

    assert zone["water_depth_m"] == 3.0
    assert "rainfall_mm_per_hr" in zone
    assert "accessibility_percent" in zone


def test_update_unknown_zone():
    response = client.post(
        "/world/zones/UNKNOWN/update",
        json={
            "water_depth_m": 2.0,
        },
    )

    assert response.status_code == 404


def test_update_rejects_negative_water_level():
    response = client.post(
        "/world/zones/Z001/update",
        json={
            "water_depth_m": -1.0,
        },
    )

    assert response.status_code == 422


def test_update_rejects_invalid_accessibility():
    response = client.post(
        "/world/zones/Z001/update",
        json={
            "accessibility_percent": 150.0,
        },
    )

    assert response.status_code == 422


def test_get_roads():
    response = client.get("/world/roads")

    assert response.status_code == 200

    data = response.json()

    assert "roads" in data
    assert len(data["roads"]) > 0


def test_get_route():
    response = client.get(
        "/route/Z002/Z001"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["origin_zone_id"] == "Z002"
    assert data["destination_zone_id"] == "Z001"
    assert data["zone_path"] == ["Z002", "Z001"]
    assert data["road_path"] == ["R001"]


def test_update_road_accessibility():
    response = client.post(
        "/world/roads/R001/update",
        json={
            "accessibility_percent": 30.0,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "updated"
    assert data["road"]["id"] == "R001"
    assert data["road"]["accessibility_percent"] == 30.0
    assert data["road"]["blocked"] is False


def test_update_road_blocked_status():
    response = client.post(
        "/world/roads/R001/update",
        json={
            "blocked": True,
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "updated"
    assert data["road"]["id"] == "R001"
    assert data["road"]["blocked"] is True


def test_update_unknown_road():
    response = client.post(
        "/world/roads/UNKNOWN/update",
        json={
            "blocked": True,
        },
    )

    assert response.status_code == 404


def test_update_road_rejects_invalid_accessibility():
    response = client.post(
        "/world/roads/R001/update",
        json={
            "accessibility_percent": 150.0,
        },
    )

    assert response.status_code == 422


def test_blocked_road_makes_route_unavailable():
    response = client.post(
        "/world/roads/R001/update",
        json={
            "blocked": True,
        },
    )

    assert response.status_code == 200

    response = client.get(
        "/route/Z002/Z001"
    )

    assert response.status_code == 404