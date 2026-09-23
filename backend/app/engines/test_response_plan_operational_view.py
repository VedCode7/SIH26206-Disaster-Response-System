from fastapi.testclient import TestClient

from backend.app.main import app, road_network_store, world_state_store
from backend.app.data.geo.road_loader import load_road_models
from backend.app.state.initial_state import create_chennai_world_state
from backend.app.engines.response_coordinator import operational_resource_registry


client = TestClient(app)


def test_response_plan_exposes_demand_and_verified_inventory():
    road_network_store.replace_roads(load_road_models())
    world_state_store.replace_state(create_chennai_world_state())
    operational_resource_registry.replace_all([])

    response = client.get("/response/plan/W18887")

    assert response.status_code == 200

    data = response.json()

    assert data["zone_id"] == "W18887"
    assert "demands" in data
    assert "resource_inventory" in data
    assert "allocations" in data
    assert "deployments" in data
    assert isinstance(data["demands"], list)
    assert isinstance(data["resource_inventory"], list)

    for resource in data["resource_inventory"]:
        assert resource["provenance"] == "verified_operational"


def test_response_plan_does_not_expose_historical_inventory_as_live_inventory():
    response = client.get("/response/plan/W18887")

    assert response.status_code == 200

    data = response.json()

    assert all(
        resource["provenance"] != "scenario"
        for resource in data["resource_inventory"]
    )
