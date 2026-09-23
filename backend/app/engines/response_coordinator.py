from backend.app.data.geo.resource_registry_loader import load_operational_resources
from backend.app.domain.models.resources import (
    Resource,
    ResourceProvenance,
    ResourceFacility,
)
from backend.app.domain.models.response import ResponsePlan
from backend.app.domain.models.risk import RiskAssessment

from backend.app.engines.deployment_engine import (
    create_deployments,
)
from backend.app.engines.facility_accessibility import (
    rank_facility_accessibility,
)
from backend.app.engines.facility_relevance import (
    filter_relevant_facilities,
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
from backend.app.engines.resource_registry import ResourceRegistry
from backend.app.engines.routing_graph import RoutingGraph


operational_resource_registry = ResourceRegistry(
    load_operational_resources()
)


def _select_live_resources(resources: list[Resource]) -> list[Resource]:
    """
    Prevent explicitly simulated inventory from entering a live plan.

    Historical scenario resources remain usable by the historical replay
    engine. A live/current response plan instead draws only from the
    separately verified operational registry.
    """
    if resources and all(
        resource.provenance == ResourceProvenance.SCENARIO
        for resource in resources
    ):
        return operational_resource_registry.available()

    return resources


def create_response_plan(
    assessment: RiskAssessment,
    resources: list[Resource],
    routing_graph: RoutingGraph | None = None,
    facilities: list[ResourceFacility] | None = None,
) -> ResponsePlan:
    """
    Coordinate risk assessment, response planning,
    resource allocation, resource deployment,
    geographically mapped facility context, and
    routing-aware facility recommendations.

    Facilities are informational only. They are never
    converted into operational resources or quantities.

    Scenario inventory is never used as live/current operational inventory.
    If the caller supplies explicitly simulated resources, the plan uses
    only individually tracked, verified operational resources from the
    registry. This keeps historical replay data separate from deployable
    inventory.

    If a routing graph is provided, allocated resources
    are assigned currently traversable routes and mapped
    facilities are filtered for response relevance and
    ranked by the same current routing state.
    """

    actions = generate_response_actions(
        zone_id=assessment.zone_id,
        risk_level=assessment.risk_level,
    )

    demands = generate_resource_demands(
        assessment,
    )

    live_resources = _select_live_resources(resources)

    allocations = allocate_resources(
        resources=live_resources,
        demands=demands,
    )

    zone_allocations = tuple(
        allocation
        for allocation in allocations
        if allocation.destination_zone_id
        == assessment.zone_id
    )

    zone_facilities = tuple(
        facility
        for facility in (facilities or [])
        if facility.current_zone_id == assessment.zone_id
    )

    relevant_facilities = filter_relevant_facilities(
        facilities or [],
        assessment.risk_level,
    )

    deployments = ()
    facility_recommendations = ()

    if routing_graph is not None:
        deployments = tuple(
            create_deployments(
                allocations=list(zone_allocations),
                graph=routing_graph,
            )
        )

        facility_recommendations = tuple(
            rank_facility_accessibility(
                origin_zone_id=assessment.zone_id,
                facilities=relevant_facilities,
                routing_graph=routing_graph,
                limit=20,
            )
        )

    return ResponsePlan(
        zone_id=assessment.zone_id,
        risk_level=assessment.risk_level.value,
        actions=tuple(actions),
        allocations=zone_allocations,
        deployments=deployments,
        facilities=zone_facilities,
        facility_recommendations=facility_recommendations,
    )
