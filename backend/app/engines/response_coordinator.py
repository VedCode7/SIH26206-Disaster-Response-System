from backend.app.domain.models.resources import (
    Resource,
)
from backend.app.domain.models.response import ResponsePlan
from backend.app.domain.models.risk import RiskAssessment

from backend.app.engines.resource_allocator import (
    allocate_resources,
)
from backend.app.engines.response_demand import (
    generate_resource_demands,
)
from backend.app.engines.response_planner import (
    generate_response_actions,
)


def create_response_plan(
    assessment: RiskAssessment,
    resources: list[Resource],
) -> ResponsePlan:
    """
    Coordinate risk assessment, response planning,
    resource demand generation, and resource allocation
    into one response plan.
    """

    actions = generate_response_actions(
        zone_id=assessment.zone_id,
        risk_level=assessment.risk_level,
    )

    demands = generate_resource_demands(
        assessment,
    )

    allocations = allocate_resources(
        resources=resources,
        demands=demands,
    )

    zone_allocations = tuple(
        allocation
        for allocation in allocations
        if allocation.destination_zone_id
        == assessment.zone_id
    )

    return ResponsePlan(
        zone_id=assessment.zone_id,
        risk_level=assessment.risk_level.value,
        actions=tuple(actions),
        allocations=zone_allocations,
    )