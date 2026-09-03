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