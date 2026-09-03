from backend.app.domain.models.routing import Road


def calculate_route_cost(road: Road) -> float | None:
    """
    Calculate the disaster-aware traversal cost of a road.

    Returns None when the road is blocked.
    """

    if road.blocked:
        return None

    accessibility = road.accessibility_percent

    if accessibility >= 75:
        penalty = 1.0
    elif accessibility >= 50:
        penalty = 1.25
    elif accessibility > 25:
        penalty = 1.5
    else:
        penalty = 3.0

    return road.travel_time_min * penalty