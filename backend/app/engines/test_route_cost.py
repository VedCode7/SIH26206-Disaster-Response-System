from backend.app.domain.models.routing import Road
from backend.app.engines.route_cost import calculate_route_cost


def test_fully_accessible_road_has_normal_cost():
    road = Road(
        id="R001",
        from_zone_id="Z001",
        to_zone_id="Z002",
        distance_km=5.0,
        travel_time_min=10.0,
        accessibility_percent=100.0,
    )

    assert calculate_route_cost(road) == 10.0


def test_partially_accessible_road_gets_penalty():
    road = Road(
        id="R002",
        from_zone_id="Z001",
        to_zone_id="Z002",
        distance_km=5.0,
        travel_time_min=10.0,
        accessibility_percent=50.0,
    )

    assert calculate_route_cost(road) == 12.5


def test_severely_damaged_road_gets_larger_penalty():
    road = Road(
        id="R003",
        from_zone_id="Z001",
        to_zone_id="Z002",
        distance_km=5.0,
        travel_time_min=10.0,
        accessibility_percent=20.0,
    )

    assert calculate_route_cost(road) == 20.0


def test_blocked_road_has_no_route_cost():
    road = Road(
        id="R004",
        from_zone_id="Z001",
        to_zone_id="Z002",
        distance_km=5.0,
        travel_time_min=10.0,
        blocked=True,
    )

    assert calculate_route_cost(road) is None