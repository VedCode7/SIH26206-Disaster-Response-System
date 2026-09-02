from backend.app.domain.models.resources import Resource
from backend.app.domain.models.response import ResponsePlan
from backend.app.domain.models.risk import RiskAssessment

from backend.app.engines.deployment_engine import (
    create_deployments,
)
from backend.app.engines.resource_allocator import (
    allocate_resources,
)
from backend.app.engines.response_demand import (
    generate_resource_demands,
)
from backend.app.engines.response_planner import (
    generate_response_actions,
)
from backend.app.engines.routing_graph import RoutingGraph


def create_response_plan(
    assessment: RiskAssessment,
    resources: list[Resource],
    routing_graph: RoutingGraph | None = None,
) -> ResponsePlan:
    """
    Coordinate risk assessment, response planning,
    resource allocation, and resource deployment.

    If a routing graph is provided, allocated resources
    are assigned currently traversable routes.
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

    deployments = ()

    if routing_graph is not None:
        deployments = tuple(
            create_deployments(
                allocations=list(zone_allocations),
                graph=routing_graph,
            )
        )

    return ResponsePlan(
        zone_id=assessment.zone_id,
        risk_level=assessment.risk_level.value,
        actions=tuple(actions),
        allocations=zone_allocations,
        deployments=deployments,
    )