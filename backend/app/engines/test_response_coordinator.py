from backend.app.domain.models.resources import Resource
from backend.app.domain.models.risk import RiskAssessment, RiskFactors
from backend.app.domain.models.zone import RiskLevel
from backend.app.engines.response_coordinator import (
    create_response_plan,
)


def make_assessment(
    zone_id: str,
    risk_level: RiskLevel,
) -> RiskAssessment:
    return RiskAssessment(
        zone_id=zone_id,
        risk_score=90.0 if risk_level == RiskLevel.CRITICAL else 60.0,
        risk_level=risk_level,
        factors=RiskFactors(
            water=80.0,
            rainfall=70.0,
            vulnerability=30.0,
            population=50.0,
            accessibility=60.0,
        ),
    )


def test_coordinator_combines_risk_actions_and_resources():
    assessment = make_assessment(
        "Z001",
        RiskLevel.CRITICAL,
    )

    resources = [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z002",
            quantity=2,
        ),
        Resource(
            id="RES001",
            resource_type="rescue_team",
            current_zone_id="Z002",
            quantity=2,
        ),
        Resource(
            id="BOAT001",
            resource_type="boat",
            current_zone_id="Z002",
            quantity=1,
        ),
    ]

    plan = create_response_plan(
        assessment=assessment,
        resources=resources,
    )

    assert plan.zone_id == "Z001"
    assert plan.risk_level == "critical"

    assert len(plan.actions) == 2
    assert len(plan.allocations) == 3

    allocation_types = {
        allocation.resource_type
        for allocation in plan.allocations
    }

    assert "ambulance" in allocation_types
    assert "rescue_team" in allocation_types
    assert "boat" in allocation_types


def test_coordinator_only_includes_allocations_for_assessed_zone():
    assessment = make_assessment(
        "Z001",
        RiskLevel.HIGH,
    )

    resources = [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z003",
            quantity=3,
        ),
    ]

    plan = create_response_plan(
        assessment=assessment,
        resources=resources,
    )

    assert all(
        allocation.destination_zone_id == "Z001"
        for allocation in plan.allocations
    )


def test_coordinator_can_create_plan_without_resources():
    assessment = make_assessment(
        "Z001",
        RiskLevel.CRITICAL,
    )

    plan = create_response_plan(
        assessment=assessment,
        resources=[],
    )

    assert plan.zone_id == "Z001"
    assert plan.risk_level == "critical"
    assert len(plan.actions) == 2
    assert plan.allocations == ()