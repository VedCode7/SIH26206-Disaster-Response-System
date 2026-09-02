from backend.app.domain.models.response import (
    ResponseAction,
    ResponsePlan,
)


def test_response_plan_creation():
    action = ResponseAction(
        zone_id="Z001",
        risk_level="high",
        action_type="prepare_evacuation",
        priority=2,
        description="Prepare evacuation for Z001",
    )

    plan = ResponsePlan(
        zone_id="Z001",
        risk_level="high",
        actions=(action,),
        allocations=(),
    )

    assert plan.zone_id == "Z001"
    assert plan.risk_level == "high"
    assert plan.actions == (action,)
    assert plan.allocations == ()
    assert plan.deployments == ()


def test_response_plan_can_contain_deployments():
    plan = ResponsePlan(
        zone_id="Z001",
        risk_level="high",
        actions=(),
        allocations=(),
        deployments=(),
    )

    assert plan.deployments == ()


def test_response_plan_rejects_empty_zone_id():
    try:
        ResponsePlan(
            zone_id="",
            risk_level="high",
            actions=(),
            allocations=(),
        )
        assert False
    except ValueError as exc:
        assert str(exc) == "zone_id cannot be empty"


def test_response_plan_rejects_empty_risk_level():
    try:
        ResponsePlan(
            zone_id="Z001",
            risk_level="",
            actions=(),
            allocations=(),
        )
        assert False
    except ValueError as exc:
        assert str(exc) == "risk_level cannot be empty"