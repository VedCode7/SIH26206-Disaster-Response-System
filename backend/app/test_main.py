import pytest
from fastapi.testclient import TestClient

from backend.app.main import (
    app,
    road_network_store,
    world_state_store,
)
from backend.app.domain.models.routing import Road
from backend.app.state.initial_state import create_demo_world_state


client = TestClient(app)


def create_demo_roads() -> list[Road]:
    """Create the deterministic road network used by integration tests."""
    return [
        Road(
            id="R001",
            from_zone_id="Z002",
            to_zone_id="Z001",
            distance_km=5.0,
            travel_time_min=10.0,
        ),
        Road(
            id="R002",
            from_zone_id="Z002",
            to_zone_id="Z003",
            distance_km=4.0,
            travel_time_min=8.0,
        ),
        Road(
            id="R003",
            from_zone_id="Z003",
            to_zone_id="Z004",
            distance_km=6.0,
            travel_time_min=12.0,
        ),
        Road(
            id="R004",
            from_zone_id="Z002",
            to_zone_id="Z004",
            distance_km=7.0,
            travel_time_min=14.0,
        ),
    ]


@pytest.fixture(autouse=True)
def reset_test_state():
    road_network_store.replace_roads(
        create_demo_roads()
    )
    world_state_store.replace_state(
        create_demo_world_state()
    )


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "ok"
    assert data["service"] == "disaster-response-backend"


def test_risk_overview_endpoint():
    response = client.get("/risk/overview")

    assert response.status_code == 200

    data = response.json()

    assert "total_zones" in data
    assert "assessments" in data
    assert data["total_zones"] > 0


def test_response_plan_endpoint():
    response = client.get("/response/plan/Z001")

    assert response.status_code == 200

    data = response.json()

    assert data["zone_id"] == "Z001"
    assert "risk_level" in data
    assert "actions" in data
    assert "allocations" in data
    assert "deployments" in data

    assert len(data["actions"]) > 0


def test_response_plan_contains_deployments():
    response = client.get("/response/plan/Z001")

    assert response.status_code == 200

    data = response.json()

    assert len(data["allocations"]) > 0
    assert len(data["deployments"]) > 0

    for deployment in data["deployments"]:
        assert "allocation" in deployment
        assert "route" in deployment

        allocation = deployment["allocation"]
        route = deployment["route"]

        assert (
            allocation["destination_zone_id"]
            == "Z001"
        )

        assert (
            route["origin_zone_id"]
            == allocation["source_zone_id"]
        )

        assert (
            route["destination_zone_id"]
            == allocation["destination_zone_id"]
        )

        assert len(route["zone_path"]) >= 2
        assert len(route["road_path"]) >= 1

        assert route["total_distance_km"] >= 0
        assert route["total_travel_time_min"] >= 0


def test_response_plan_unknown_zone():
    response = client.get("/response/plan/UNKNOWN")

    assert response.status_code == 404

    data = response.json()

    assert "not found" in data["detail"].lower()
