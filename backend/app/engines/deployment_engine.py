from backend.app.domain.models.resources import ResourceAllocation
from backend.app.domain.models.response import ResourceDeployment
from backend.app.engines.routing_engine import calculate_route
from backend.app.engines.routing_graph import RoutingGraph


def create_deployments(
    allocations: list[ResourceAllocation],
    graph: RoutingGraph,
) -> list[ResourceDeployment]:
    """
    Create resource deployments by finding a currently traversable
    route for every resource allocation.

    Allocations for which no route exists are skipped.
    """

    deployments: list[ResourceDeployment] = []

    for allocation in allocations:
        route = calculate_route(
            graph=graph,
            origin_zone_id=allocation.source_zone_id,
            destination_zone_id=allocation.destination_zone_id,
        )

        if route is None:
            continue

        deployments.append(
            ResourceDeployment(
                allocation=allocation,
                route=route,
            )
        )

    return deployments