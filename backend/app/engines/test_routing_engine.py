from backend.app.domain.models.routing import Road
from backend.app.engines.routing_engine import calculate_route
from backend.app.engines.routing_graph import RoutingGraph


def test_dijkstra_finds_fastest_route():
    roads = [
        Road(
            id="R001",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=5.0,
            travel_time_min=5.0,
        ),
        Road(
            id="R002",
            from_zone_id="Z002",
            to_zone_id="Z003",
            distance_km=4.0,
            travel_time_min=4.0,
        ),
        Road(
            id="R003",
            from_zone_id="Z001",
            to_zone_id="Z003",
            distance_km=12.0,
            travel_time_min=12.0,
        ),
    ]

    graph = RoutingGraph(roads)

    result = calculate_route(
        graph,
        "Z001",
        "Z003",
    )

    assert result is not None
    assert result.zone_path == (
        "Z001",
        "Z002",
        "Z003",
    )
    assert result.road_path == (
        "R001",
        "R002",
    )
    assert result.total_distance_km == 9.0
    assert result.total_travel_time_min == 9.0


def test_dijkstra_avoids_blocked_road():
    roads = [
        Road(
            id="R001",
            from_zone_id="Z001",
            to_zone_id="Z003",
            distance_km=3.0,
            travel_time_min=3.0,
            blocked=True,
        ),
        Road(
            id="R002",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=5.0,
            travel_time_min=5.0,
        ),
        Road(
            id="R003",
            from_zone_id="Z002",
            to_zone_id="Z003",
            distance_km=5.0,
            travel_time_min=5.0,
        ),
    ]

    graph = RoutingGraph(roads)

    result = calculate_route(
        graph,
        "Z001",
        "Z003",
    )

    assert result is not None
    assert result.zone_path == (
        "Z001",
        "Z002",
        "Z003",
    )
    assert result.road_path == (
        "R002",
        "R003",
    )


def test_dijkstra_returns_none_when_destination_is_unreachable():
    roads = [
        Road(
            id="R001",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=5.0,
            travel_time_min=5.0,
        ),
        Road(
            id="R002",
            from_zone_id="Z003",
            to_zone_id="Z004",
            distance_km=5.0,
            travel_time_min=5.0,
        ),
    ]

    graph = RoutingGraph(roads)

    result = calculate_route(
        graph,
        "Z001",
        "Z004",
    )

    assert result is None


def test_route_from_zone_to_itself():
    roads = [
        Road(
            id="R001",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=5.0,
            travel_time_min=5.0,
        )
    ]

    graph = RoutingGraph(roads)

    result = calculate_route(
        graph,
        "Z001",
        "Z001",
    )

    assert result is not None
    assert result.zone_path == ("Z001",)
    assert result.road_path == ()
    assert result.total_distance_km == 0.0
    assert result.total_travel_time_min == 0.0

def test_dijkstra_prefers_safer_route_over_faster_damaged_route():
    roads = [
        Road(
            id="R001",
            from_zone_id="Z001",
            to_zone_id="Z003",
            distance_km=3.0,
            travel_time_min=9.0,
            accessibility_percent=25.0,
        ),
        Road(
            id="R002",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=5.0,
            travel_time_min=6.0,
            accessibility_percent=100.0,
        ),
        Road(
            id="R003",
            from_zone_id="Z002",
            to_zone_id="Z003",
            distance_km=5.0,
            travel_time_min=6.0,
            accessibility_percent=100.0,
        ),
    ]

    graph = RoutingGraph(roads)

    result = calculate_route(
        graph,
        "Z001",
        "Z003",
    )

    assert result is not None

    assert result.zone_path == (
        "Z001",
        "Z002",
        "Z003",
    )

    assert result.road_path == (
        "R002",
        "R003",
    )

    assert result.total_distance_km == 10.0
    assert result.total_travel_time_min == 12.0