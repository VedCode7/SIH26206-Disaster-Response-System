from backend.app.domain.models.resources import (
    Resource,
    ResourceAllocation,
    ResourceDemand,
)
from backend.app.engines.route_cost import calculate_route_cost
from backend.app.engines.routing_engine import calculate_route
from backend.app.engines.routing_graph import RoutingGraph


def _route_score(
    graph: RoutingGraph,
    source_zone_id: str,
    destination_zone_id: str,
):
    """Return a route and its current disaster-aware traversal cost."""

    route = calculate_route(
        graph=graph,
        origin_zone_id=source_zone_id,
        destination_zone_id=destination_zone_id,
    )

    if route is None:
        return None

    route_cost = 0.0
    for road_id in route.road_path:
        road = graph.get_road(road_id)
        if road is None:
            return None

        cost = calculate_route_cost(road)
        if cost is None:
            return None

        route_cost += cost

    return route, route_cost


def allocate_resources(
    resources: list[Resource],
    demands: list[ResourceDemand],
    routing_graph: RoutingGraph | None = None,
) -> list[ResourceAllocation]:
    """
    Allocate available resources to disaster-zone demands.

    Allocation is deliberately conservative:

    * higher-priority demands are considered first;
    * when priorities tie, the scarcest feasible resource type is handled
      first so a constrained capability is not consumed by a less-constrained
      peer demand;
    * with a routing graph, resources without a currently traversable route
      are not allocated at all;
    * among feasible resources, the current disaster-aware route cost is
      preferred, followed by travel time, distance, and stable resource ID;
    * allocations preserve the exact operational resource ID.

    Without a routing graph the function retains its deterministic legacy
    behaviour and matches resources by type only. The live response
    coordinator supplies the routing graph for operational plans.
    """

    remaining: dict[str, int] = {
        resource.id: resource.quantity
        for resource in resources
    }

    route_cache: dict[tuple[str, str], tuple[object, float] | None] = {}

    def get_route_score(resource: Resource, demand: ResourceDemand):
        if routing_graph is None:
            return None

        key = (resource.current_zone_id, demand.zone_id)
        if key not in route_cache:
            route_cache[key] = _route_score(
                routing_graph,
                resource.current_zone_id,
                demand.zone_id,
            )
        return route_cache[key]

    def feasible_resources(demand: ResourceDemand) -> list[Resource]:
        candidates = []
        for resource in resources:
            if resource.resource_type != demand.resource_type:
                continue
            if remaining.get(resource.id, 0) <= 0:
                continue
            if routing_graph is not None and get_route_score(resource, demand) is None:
                continue
            candidates.append(resource)
        return candidates

    # Priority remains the first ordering criterion. Within the same priority,
    # scarce capabilities are processed first. Scarcity is measured against
    # currently feasible resources, not the whole historical inventory.
    demand_metadata = []
    for demand in demands:
        candidates = feasible_resources(demand)
        demand_metadata.append((demand, len(candidates)))

    sorted_demands = sorted(
        demand_metadata,
        key=lambda item: (
            item[0].priority,
            item[1],
            item[0].resource_type,
            item[0].zone_id,
        ),
    )

    allocations: list[ResourceAllocation] = []

    for demand, _candidate_count in sorted_demands:
        remaining_demand = demand.quantity

        candidates = feasible_resources(demand)

        if routing_graph is not None:
            candidates.sort(
                key=lambda resource: (
                    get_route_score(resource, demand)[1],
                    get_route_score(resource, demand)[0].total_travel_time_min,
                    get_route_score(resource, demand)[0].total_distance_km,
                    resource.id,
                )
            )
        else:
            candidates.sort(key=lambda resource: resource.id)

        for resource in candidates:
            if remaining_demand <= 0:
                break

            available_quantity = remaining.get(resource.id, 0)
            if available_quantity <= 0:
                continue

            allocated_quantity = min(
                remaining_demand,
                available_quantity,
            )

            allocations.append(
                ResourceAllocation(
                    resource_id=resource.id,
                    resource_type=resource.resource_type,
                    source_zone_id=resource.current_zone_id,
                    destination_zone_id=demand.zone_id,
                    quantity=allocated_quantity,
                    priority=demand.priority,
                )
            )

            remaining[resource.id] -= allocated_quantity
            remaining_demand -= allocated_quantity

    return allocations
