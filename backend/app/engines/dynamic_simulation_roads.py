from backend.app.domain.models.routing import Road
from backend.app.engines.disaster_simulator import SimulationStep
from backend.app.engines.routing_graph import RoutingGraph


def update_simulation_roads(
    graph: RoutingGraph,
    step: SimulationStep,
) -> RoutingGraph:
    """
    Create a new routing graph representing the road conditions
    for the current disaster simulation step.

    The original graph is never modified.

    During the flood simulation, the primary road R001 gradually
    deteriorates. At the severe flooding stage it becomes blocked,
    forcing routing through the alternate path.
    """

    updated_roads: list[Road] = []

    for road in graph.get_roads():
        accessibility = road.accessibility_percent
        blocked = road.blocked

        if road.id == "R001":
            if step.name == "Heavy rainfall":
                accessibility = 100.0
                blocked = False

            elif step.name == "Rising water":
                accessibility = 100.0
                blocked = False

            elif step.name == "Road access deteriorates":
                accessibility = 20.0
                blocked = False

            elif step.name == "Severe flooding":
                accessibility = 0.0
                blocked = True

        updated_roads.append(
            Road(
                id=road.id,
                from_zone_id=road.from_zone_id,
                to_zone_id=road.to_zone_id,
                distance_km=road.distance_km,
                travel_time_min=road.travel_time_min,
                accessibility_percent=accessibility,
                blocked=blocked,
            )
        )

    return RoutingGraph(updated_roads)