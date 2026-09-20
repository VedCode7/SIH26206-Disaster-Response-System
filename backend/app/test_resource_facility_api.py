import pytest
from fastapi.testclient import TestClient

from backend.app.main import app, world_state_store
from backend.app.state.initial_state import create_chennai_world_state


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_to_chennai_world_state():
    """Keep facility API tests independent from global world-state mutations."""
    world_state_store.replace_state(create_chennai_world_state())


def test_world_facilities_endpoint_returns_real_mapped_facilities():
    response = client.get("/world/facilities")

    assert response.status_code == 200

    facilities = response.json()["facilities"]
    assert len(facilities) == 1192
    assert all(facility["source"] == "OpenStreetMap" for facility in facilities)
    assert all("quantity" not in facility for facility in facilities)


def test_zone_facilities_endpoint_returns_only_requested_zone():
    response = client.get("/world/facilities/W19022")

    assert response.status_code == 200

    facilities = response.json()["facilities"]
    assert facilities
    assert all(
        facility["current_zone_id"] == "W19022"
        for facility in facilities
    )


def test_response_plan_contains_facility_context_without_operational_quantity():
    response = client.get("/response/plan/W19022")

    assert response.status_code == 200

    plan = response.json()
    assert "facilities" in plan
    assert all("quantity" not in facility for facility in plan["facilities"])
    assert all(
        facility["current_zone_id"] == "W19022"
        for facility in plan["facilities"]
    )
