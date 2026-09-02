from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


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
    assert "accessibility" in factors