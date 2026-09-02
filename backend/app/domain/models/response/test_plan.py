import pytest

from backend.app.domain.models.resources import ResourceAllocation
from backend.app.domain.models.response import (
    ResponseAction,
    ResponsePlan,
)


def test_response_plan_can_be_created():
    action = ResponseAction(
        zone_id="Z001",
        risk_level="critical",
        action_type="evacuate",
        priority=1,
        description="Evacuate Z001",
    )

    allocation = ResourceAllocation(
        resource_id="AMB-ALLOC-001",
        resource_type="ambulance",
        source_zone_id="Z002",
        destination_zone_id="Z001",
        quantity=1,
        priority=1,
    )

    plan = ResponsePlan(
        zone_id="Z001",
        risk_level="critical",
        actions=(action,),
        allocations=(allocation,),
    )

    assert plan.zone_id == "Z001"
    assert plan.risk_level == "critical"
    assert len(plan.actions) == 1
    assert len(plan.allocations) == 1


def test_response_plan_can_have_no_allocations():
    action = ResponseAction(
        zone_id="Z001",
        risk_level="watch",
        action_type="monitor",
        priority=3,
        description="Monitor Z001",
    )

    plan = ResponsePlan(
        zone_id="Z001",
        risk_level="watch",
        actions=(action,),
        allocations=(),
    )

    assert len(plan.actions) == 1
    assert plan.allocations == ()


def test_empty_zone_id_is_rejected():
    action = ResponseAction(
        zone_id="Z001",
        risk_level="critical",
        action_type="evacuate",
        priority=1,
        description="Evacuate Z001",
    )

    with pytest.raises(ValueError):
        ResponsePlan(
            zone_id="",
            risk_level="critical",
            actions=(action,),
            allocations=(),
        )