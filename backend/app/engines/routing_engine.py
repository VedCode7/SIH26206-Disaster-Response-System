import heapq

from backend.app.domain.models.routing import Road, RouteResult
from backend.app.engines.route_cost import calculate_route_cost
from backend.app.engines.routing_graph import RoutingGraph


def calculate_route(
    graph: RoutingGraph,
    origin_zone_id: str,
    destination_zone_id: str,
) -> RouteResult | None:
    """
    Calculate the best currently traversable route between two zones
    using Dijkstra's shortest-path algorithm.

    Route cost accounts for disaster-related road accessibility.
    """

    if origin_zone_id == destination_zone_id:
        return RouteResult(
            origin_zone_id=origin_zone_id,
            destination_zone_id=destination_zone_id,
            zone_path=(origin_zone_id,),
            road_path=(),
            total_distance_km=0.0,
            total_travel_time_min=0.0,
        )

    if not graph.has_zone(origin_zone_id):
        return None

    if not graph.has_zone(destination_zone_id):
        return None

    distances: dict[str, float] = {
        origin_zone_id: 0.0
    }

    previous_zone: dict[str, str] = {}
    previous_road: dict[str, Road] = {}

    priority_queue: list[tuple[float, str]] = [
        (0.0, origin_zone_id)
    ]

    while priority_queue:
        current_cost, current_zone = heapq.heappop(
            priority_queue
        )

        if current_cost > distances.get(
            current_zone,
            float("inf"),
        ):
            continue

        if current_zone == destination_zone_id:
            break

        for road in graph.neighbors(current_zone):
            route_cost = calculate_route_cost(road)

            if route_cost is None:
                continue

            if road.from_zone_id == current_zone:
                next_zone = road.to_zone_id
            else:
                next_zone = road.from_zone_id

            new_cost = current_cost + route_cost

            if new_cost < distances.get(
                next_zone,
                float("inf"),
            ):
                distances[next_zone] = new_cost
                previous_zone[next_zone] = current_zone
                previous_road[next_zone] = road

                heapq.heappush(
                    priority_queue,
                    (new_cost, next_zone),
                )

    if destination_zone_id not in distances:
        return None

    zone_path = []
    road_path = []

    current_zone = destination_zone_id

    while current_zone != origin_zone_id:
        zone_path.append(current_zone)

        road = previous_road[current_zone]
        road_path.append(road.id)

        current_zone = previous_zone[current_zone]

    zone_path.append(origin_zone_id)

    zone_path.reverse()
    road_path.reverse()

    total_distance = 0.0
    total_travel_time = 0.0

    for road_id in road_path:
        road = graph.get_road(road_id)

        if road is None:
            raise RuntimeError(
                f"Road {road_id} disappeared from the routing graph"
            )

        total_distance += road.distance_km
        total_travel_time += road.travel_time_min

    return RouteResult(
        origin_zone_id=origin_zone_id,
        destination_zone_id=destination_zone_id,
        zone_path=tuple(zone_path),
        road_path=tuple(road_path),
        total_distance_km=total_distance,
        total_travel_time_min=total_travel_time,
    )