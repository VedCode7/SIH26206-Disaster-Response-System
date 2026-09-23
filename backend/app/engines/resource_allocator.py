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
    * when priorities tie, constrained route opportunities are protected:
      a demand that can only be served by resources having few alternative
      feasible demands is considered before a demand that can be served by
      more interchangeable resources;
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

    # Preserve declared operational priority first. Within an equal
    # priority, serve demands with the fewest currently feasible resources
    # first, protecting scarce route-compatible opportunities.
    demand_metadata = []
    for demand in demands:
        candidates = feasible_resources(demand)
        demand_metadata.append((demand, candidates))

    resource_flexibility: dict[str, int] = {}
    for resource in resources:
        if remaining.get(resource.id, 0) <= 0:
            continue

        resource_flexibility[resource.id] = sum(
            1
            for _demand, candidates in demand_metadata
            if any(candidate.id == resource.id for candidate in candidates)
        )

    sorted_demands = sorted(
        demand_metadata,
        key=lambda item: (
            item[0].priority,
            len(item[1]),
            min(
                (
                    resource_flexibility.get(
                        candidate.id,
                        len(demands) + 1,
                    )
                    for candidate in item[1]
                ),
                default=len(demands) + 1,
            ),
            item[0].resource_type,
            item[0].zone_id,
        ),
    )

    # A resource can only be consumed by one demand when it is individually
    # tracked (quantity=1). When multiple same-priority demands are otherwise
    # equally constrained, prefer the demand whose nearest feasible resource
    # has the shortest route; this gives deterministic operational behaviour.
    def nearest_route_key(demand: ResourceDemand):
        candidates = feasible_resources(demand)
        if routing_graph is None or not candidates:
            return (float("inf"), float("inf"), float("inf"))
        scores = [get_route_score(resource, demand) for resource in candidates]
        scores = [score for score in scores if score is not None]
        if not scores:
            return (float("inf"), float("inf"), float("inf"))
        return min(
            (
                route_cost,
                route.total_travel_time_min,
                route.total_distance_km,
            )
            for route, route_cost in scores
        )

    sorted_demands = sorted(
        sorted_demands,
        key=lambda item: (
            item[0].priority,
            len(item[1]),
            min(
                (
                    resource_flexibility.get(
                        candidate.id,
                        len(demands) + 1,
                    )
                    for candidate in item[1]
                ),
                default=len(demands) + 1,
            ),
            nearest_route_key(item[0]),
            item[0].resource_type,
            item[0].zone_id,
        ),
    )

    allocations: list[ResourceAllocation] = []

    for demand, _initial_candidates in sorted_demands:
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
