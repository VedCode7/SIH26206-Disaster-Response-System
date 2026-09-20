import pytest
from fastapi.testclient import TestClient

from backend.app.main import app, road_network_store, world_state_store
from backend.app.data.geo.road_loader import load_road_models
from backend.app.state.initial_state import create_chennai_world_state


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_chennai_state():
    road_network_store.replace_roads(load_road_models())
    world_state_store.replace_state(create_chennai_world_state())
    yield
    road_network_store.replace_roads(load_road_models())
    world_state_store.replace_state(create_chennai_world_state())


def test_chennai_response_plan_uses_real_ward_and_resources():
    response = client.post(
        "/world/zones/W18887/update",
        json={
            "water_depth_m": 2.5,
            "rainfall_mm_per_hr": 120.0,
            "accessibility_percent": 40.0,
        },
    )
    assert response.status_code == 200

    response = client.get("/response/plan/W18887")

    assert response.status_code == 200

    data = response.json()

    assert data["zone_id"] == "W18887"
    assert data["risk_level"] in {"high", "critical"}
    assert len(data["allocations"]) > 0
    assert len(data["deployments"]) > 0

    for deployment in data["deployments"]:
        assert deployment["allocation"]["destination_zone_id"] == "W18887"
        assert deployment["route"]["origin_zone_id"] == "W18901"
        assert deployment["route"]["destination_zone_id"] == "W18887"
        assert len(deployment["route"]["road_path"]) > 0


def test_chennai_response_plan_returns_404_for_unknown_ward():
    response = client.get("/response/plan/W99999")

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_chennai_response_plan_is_empty_for_neutral_ward():
    response = client.get("/response/plan/W18887")

    assert response.status_code == 200

    data = response.json()

    assert data["zone_id"] == "W18887"
    assert data["allocations"] == []
    assert data["deployments"] == []


def test_chennai_route_reroutes_when_a_road_is_blocked():
    response = client.get("/route/W18901/W18887")

    assert response.status_code == 200

    before = response.json()
    original_road_path = before["road_path"]
    assert len(original_road_path) > 1

    blocked_road = original_road_path[len(original_road_path) // 2]

    update = client.post(
        f"/world/roads/{blocked_road}/update",
        json={"blocked": True},
    )

    assert update.status_code == 200
    assert update.json()["road"]["blocked"] is True

    response = client.get("/route/W18901/W18887")

    assert response.status_code == 200

    after = response.json()

    assert after["origin_zone_id"] == "W18901"
    assert after["destination_zone_id"] == "W18887"
    assert blocked_road not in after["road_path"]
    assert after["road_path"] != original_road_path
    assert after["total_distance_km"] > 0
    assert after["total_travel_time_min"] > 0
