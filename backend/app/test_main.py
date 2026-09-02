from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


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

    assert len(data["actions"]) > 0


def test_response_plan_unknown_zone():
    response = client.get("/response/plan/UNKNOWN")

    assert response.status_code == 404

    data = response.json()

    assert "not found" in data["detail"].lower()