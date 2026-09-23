import pytest
from fastapi.testclient import TestClient

from backend.app.engines.response_coordinator import operational_resource_registry
from backend.app.main import app


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_operational_registry():
    """Keep API tests isolated from the process-global live registry."""
    operational_resource_registry.replace_all([])
    yield
    operational_resource_registry.replace_all([])


def resource_payload(**overrides):
    payload = {
        "id": "AMB-API-001",
        "resource_type": "ambulance",
        "current_zone_id": "W19022",
        "name": "Ambulance 001",
        "latitude": 13.0827,
        "longitude": 80.2707,
        "source": "operator registry",
        "status": "available",
        "last_verified_at": "2026-09-23T22:00:00+05:30",
        "operator": "test-operator",
        "capacity": 1,
        "notes": "Verified for API test",
    }
    payload.update(overrides)
    return payload


def test_operational_registry_starts_empty_and_exposes_summary():
    response = client.get("/resources/operational")

    assert response.status_code == 200
    assert response.json() == {"resources": []}

    summary = client.get("/resources/operational/summary")

    assert summary.status_code == 200
    assert summary.json() == {
        "total": 0,
        "available": 0,
        "reserved": 0,
        "dispatched": 0,
        "en_route": 0,
        "on_scene": 0,
        "unavailable": 0,
        "maintenance": 0,
        "unknown": 0,
    }


def test_register_endpoint_creates_only_verified_individual_resource():
    response = client.post("/resources/operational", json=resource_payload())

    assert response.status_code == 201

    resource = response.json()["resource"]
    assert resource["id"] == "AMB-API-001"
    assert resource["quantity"] == 1
    assert resource["provenance"] == "verified_operational"
    assert resource["status"] == "available"
    assert resource["source"] == "operator registry"
    assert resource["last_verified_at"] == "2026-09-23T22:00:00+05:30"

    listed = client.get("/resources/operational").json()["resources"]
    assert [item["id"] for item in listed] == ["AMB-API-001"]


def test_register_endpoint_rejects_missing_verification_metadata():
    payload = resource_payload()
    payload.pop("source")
    payload.pop("last_verified_at")

    response = client.post("/resources/operational", json=payload)

    assert response.status_code == 422


def test_register_endpoint_rejects_unknown_zone():
    response = client.post(
        "/resources/operational",
        json=resource_payload(current_zone_id="W-NOT-REAL"),
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]


def test_register_endpoint_rejects_duplicate_id():
    first = client.post("/resources/operational", json=resource_payload())
    second = client.post("/resources/operational", json=resource_payload())

    assert first.status_code == 201
    assert second.status_code == 409


def test_update_endpoint_changes_lifecycle_and_location():
    created = client.post("/resources/operational", json=resource_payload())
    assert created.status_code == 201

    response = client.patch(
        "/resources/operational/AMB-API-001",
        json={
            "status": "dispatched",
            "current_zone_id": "W18887",
            "operator": "dispatch-console",
            "last_verified_at": "2026-09-23T22:10:00+05:30",
        },
    )

    assert response.status_code == 200
    resource = response.json()["resource"]
    assert resource["status"] == "dispatched"
    assert resource["current_zone_id"] == "W18887"
    assert resource["operator"] == "dispatch-console"


def test_operational_filter_never_exposes_non_operational_inventory():
    from backend.app.domain.models.resources import (
        Resource,
        ResourceProvenance,
        ResourceStatus,
    )

    operational_resource_registry.add(
        Resource(
            id="SCENARIO-API-001",
            resource_type="ambulance",
            current_zone_id="W19022",
            quantity=2,
            status=ResourceStatus.AVAILABLE,
            provenance=ResourceProvenance.SCENARIO,
        )
    )

    response = client.get("/resources/operational")

    assert response.status_code == 200
    assert response.json()["resources"] == []


def test_response_plan_reads_the_same_verified_registry():
    registered = client.post("/resources/operational", json=resource_payload())
    assert registered.status_code == 201

    response = client.get("/response/plan/W19022")

    assert response.status_code == 200
    inventory = response.json()["resource_inventory"]
    assert [resource["id"] for resource in inventory] == ["AMB-API-001"]
