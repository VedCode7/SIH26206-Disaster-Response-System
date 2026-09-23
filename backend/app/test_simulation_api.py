import pytest
from fastapi.testclient import TestClient

from backend.app.main import (
    app,
    road_network_store,
)
from backend.app.domain.models.routing import Road


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
def reset_road_network():
    road_network_store.replace_roads(
        create_demo_roads()
    )


def test_flood_simulation_endpoint():
    response = client.post(
        "/simulation/flood"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["simulation"] == "flood_escalation"
    assert data["zone_id"] == "Z001"


def test_flood_simulation_returns_four_steps():
    response = client.post(
        "/simulation/flood"
    )

    assert response.status_code == 200

    data = response.json()

    assert len(data["steps"]) == 4


def test_flood_simulation_contains_expected_steps():
    response = client.post(
        "/simulation/flood"
    )

    assert response.status_code == 200

    steps = response.json()["steps"]

    assert steps[0]["step"] == "Heavy rainfall"
    assert steps[1]["step"] == "Rising water"
    assert steps[2]["step"] == "Road access deteriorates"
    assert steps[3]["step"] == "Severe flooding"


def test_flood_simulation_risk_increases():
    response = client.post(
        "/simulation/flood"
    )

    assert response.status_code == 200

    steps = response.json()["steps"]

    assert (
        steps[-1]["risk_score"]
        > steps[0]["risk_score"]
    )


def test_flood_simulation_ends_critical():
    response = client.post(
        "/simulation/flood"
    )

    assert response.status_code == 200

    final_step = response.json()["steps"][-1]

    assert final_step["risk_level"] == "critical"


def test_flood_simulation_returns_risk_factors():
    response = client.post(
        "/simulation/flood"
    )

    assert response.status_code == 200

    final_step = response.json()["steps"][-1]

    factors = final_step["factors"]

    assert "water" in factors
    assert "rainfall" in factors
    assert "vulnerability" in factors
    assert "population" in factors
    assert "accessibility_risk" in factors


def test_flood_response_simulation_endpoint():
    response = client.post(
        "/simulation/flood/response"
    )

    assert response.status_code == 200

    data = response.json()

    assert data["simulation"] == "flood_escalation"
    assert data["zone_id"] == "Z001"
    assert len(data["steps"]) == 4


def test_flood_response_simulation_contains_response_data():
    response = client.post(
        "/simulation/flood/response"
    )

    assert response.status_code == 200

    steps = response.json()["steps"]

    for step in steps:
        assert "risk_score" in step
        assert "risk_level" in step
        assert "factors" in step
        assert "actions" in step
        assert "allocations" in step
        assert "deployments" in step


def test_flood_response_final_stage_reports_unreachable_demand():
    response = client.post(
        "/simulation/flood/response"
    )

    assert response.status_code == 200

    final_step = response.json()["steps"][-1]

    assert final_step["risk_level"] == "critical"
    assert len(final_step["actions"]) > 0
    # The final stage blocks the only route into Z001. A route-aware response
    # must not claim that those units were allocated or deployed successfully.
    assert len(final_step["allocations"]) == 0
    assert len(final_step["deployments"]) > 0
