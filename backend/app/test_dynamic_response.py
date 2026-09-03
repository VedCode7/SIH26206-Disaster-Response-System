import pytest
from fastapi.testclient import TestClient

from backend.app.main import (
    app,
    road_network_store,
    world_state_store,
)
from backend.app.state.initial_state import (
    create_demo_world_state,
)


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_application_state():
    """
    Reset the in-memory application state before and after
    every integration test so tests remain independent.
    """

    world_state_store.replace_state(
        create_demo_world_state()
    )

    from backend.app.main import create_demo_roads

    road_network_store.replace_roads(
        create_demo_roads()
    )

    yield

    world_state_store.replace_state(
        create_demo_world_state()
    )

    road_network_store.replace_roads(
        create_demo_roads()
    )


def test_zone_condition_change_changes_risk():
    response = client.get("/risk/overview")

    assert response.status_code == 200

    before = next(
        assessment
        for assessment in response.json()["assessments"]
        if assessment["zone_id"] == "Z001"
    )

    response = client.post(
        "/world/zones/Z001/update",
        json={
            "water_depth_m": 2.0,
            "rainfall_mm_per_hr": 150.0,
            "accessibility_percent": 20.0,
        },
    )

    assert response.status_code == 200

    response = client.get("/risk/overview")

    assert response.status_code == 200

    after = next(
        assessment
        for assessment in response.json()["assessments"]
        if assessment["zone_id"] == "Z001"
    )

    assert after["risk_score"] > before["risk_score"]


def test_higher_risk_produces_more_resource_demand():
    response = client.post(
        "/world/zones/Z001/update",
        json={
            "water_depth_m": 2.0,
            "rainfall_mm_per_hr": 150.0,
            "accessibility_percent": 20.0,
        },
    )

    assert response.status_code == 200

    response = client.get("/response/plan/Z001")

    assert response.status_code == 200

    plan = response.json()

    assert plan["risk_level"] == "critical"

    resource_types = {
        allocation["resource_type"]
        for allocation in plan["allocations"]
    }

    assert "ambulance" in resource_types
    assert "rescue_team" in resource_types
    assert "boat" in resource_types


def test_blocked_road_changes_route_availability():
    response = client.get("/route/Z002/Z001")

    assert response.status_code == 200

    assert response.json()["road_path"] == ["R001"]

    response = client.post(
        "/world/roads/R001/update",
        json={
            "blocked": True,
        },
    )

    assert response.status_code == 200

    response = client.get("/route/Z002/Z001")

    assert response.status_code == 404


def test_response_plan_respects_current_road_network():
    response = client.post(
        "/world/roads/R001/update",
        json={
            "blocked": True,
        },
    )

    assert response.status_code == 200

    response = client.get("/response/plan/Z001")

    assert response.status_code == 200

    plan = response.json()

    assert plan["deployments"] == []