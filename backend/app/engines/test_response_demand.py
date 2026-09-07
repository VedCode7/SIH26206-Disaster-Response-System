from backend.app.domain.models.risk import RiskAssessment, RiskFactors
from backend.app.domain.models.zone import RiskLevel
from backend.app.engines.response_demand import (
    generate_resource_demands,
)
from backend.app.engines.risk_engine import calculate_risk
from backend.app.state.initial_state import (
    create_demo_world_state,
)


def test_critical_zone_requests_multiple_resources():
    world_state = create_demo_world_state()

    zone = world_state.get_zone("Z001")

    assert zone is not None

    assessment = RiskAssessment(
        zone_id=zone.id,
        risk_score=90.0,
        risk_level=RiskLevel.CRITICAL,
        factors=RiskFactors(
            water=100.0,
            rainfall=100.0,
            vulnerability=50.0,
            population=100.0,
            accessibility_risk=100.0,
        ),
    )

    demands = generate_resource_demands(
        assessment
    )

    resource_types = {
        demand.resource_type
        for demand in demands
    }

    assert "ambulance" in resource_types
    assert "rescue_team" in resource_types
    assert "boat" in resource_types


def test_critical_zone_has_highest_priority():
    assessment = RiskAssessment(
        zone_id="Z001",
        risk_score=90.0,
        risk_level=RiskLevel.CRITICAL,
        factors=RiskFactors(
            water=100.0,
            rainfall=100.0,
            vulnerability=50.0,
            population=100.0,
            accessibility_risk=100.0,
        ),
    )

    demands = generate_resource_demands(
        assessment
    )

    assert demands
    assert all(
        demand.priority == 1
        for demand in demands
    )


def test_high_risk_zone_requests_resources():
    world_state = create_demo_world_state()

    zone = world_state.get_zone("Z004")

    assert zone is not None

    assessment = calculate_risk(zone)

    assert assessment.risk_level == RiskLevel.HIGH

    demands = generate_resource_demands(
        assessment
    )

    assert len(demands) == 2

    assert all(
        demand.priority == 2
        for demand in demands
    )


def test_watch_zone_requests_rescue_team():
    world_state = create_demo_world_state()

    zone = world_state.get_zone("Z002")

    assert zone is not None

    assessment = calculate_risk(zone)

    assessment = assessment.model_copy(
        update={
            "risk_level": RiskLevel.WATCH,
        }
    )

    demands = generate_resource_demands(
        assessment
    )

    assert len(demands) == 1
    assert demands[0].resource_type == "rescue_team"
    assert demands[0].quantity == 1
    assert demands[0].priority == 3


def test_normal_zone_has_no_resource_demand():
    world_state = create_demo_world_state()

    zone = world_state.get_zone("Z003")

    assert zone is not None

    assessment = calculate_risk(zone)

    assert assessment.risk_level == RiskLevel.NORMAL

    demands = generate_resource_demands(
        assessment
    )

    assert demands == []