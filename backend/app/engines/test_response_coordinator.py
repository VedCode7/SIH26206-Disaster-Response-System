from backend.app.domain.models.resources import (
    Resource,
    ResourceDemand,
)
from backend.app.domain.models.risk import (
    RiskAssessment,
    RiskFactors,
)
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
        risk_score=90.0,
        risk_level=risk_level,
        factors=RiskFactors(
            water=90.0,
            rainfall=90.0,
            vulnerability=90.0,
            population=90.0,
            accessibility=90.0,
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
        )
    ]

    demands = [
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=1,
            priority=1,
        )
    ]

    plan = create_response_plan(
        assessment=assessment,
        resources=resources,
        demands=demands,
    )

    assert plan.zone_id == "Z001"
    assert plan.risk_level == "critical"

    assert len(plan.actions) == 2
    assert plan.actions[0].action_type == "evacuate"

    assert len(plan.allocations) == 1
    assert plan.allocations[0].resource_type == "ambulance"
    assert plan.allocations[0].quantity == 1


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
        )
    ]

    demands = [
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=1,
            priority=1,
        ),
        ResourceDemand(
            zone_id="Z002",
            resource_type="ambulance",
            quantity=1,
            priority=2,
        ),
    ]

    plan = create_response_plan(
        assessment=assessment,
        resources=resources,
        demands=demands,
    )

    assert len(plan.allocations) == 1
    assert plan.allocations[0].destination_zone_id == "Z001"


def test_coordinator_can_create_plan_without_resources():
    assessment = make_assessment(
        "Z001",
        RiskLevel.CRITICAL,
    )

    plan = create_response_plan(
        assessment=assessment,
        resources=[],
        demands=[],
    )

    assert plan.zone_id == "Z001"
    assert plan.risk_level == "critical"
    assert len(plan.actions) == 2
    assert plan.allocations == ()