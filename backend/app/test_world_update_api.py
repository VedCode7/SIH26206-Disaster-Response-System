from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


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