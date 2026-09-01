from backend.app.domain.models.routing import Road
from backend.app.engines.routing_graph import RoutingGraph


def test_graph_connects_roads_in_both_directions():
    roads = [
        Road(
            id="R001",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=4.0,
            travel_time_min=8.0,
        )
    ]

    graph = RoutingGraph(roads)

    z001_neighbors = graph.neighbors("Z001")
    z002_neighbors = graph.neighbors("Z002")

    assert len(z001_neighbors) == 1
    assert z001_neighbors[0].id == "R001"

    assert len(z002_neighbors) == 1
    assert z002_neighbors[0].id == "R001"


def test_blocked_roads_are_not_traversable():
    roads = [
        Road(
            id="R001",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=4.0,
            travel_time_min=8.0,
            blocked=True,
        )
    ]

    graph = RoutingGraph(roads)

    assert graph.neighbors("Z001") == []
    assert graph.neighbors("Z002") == []


def test_multiple_roads_create_multiple_neighbors():
    roads = [
        Road(
            id="R001",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=4.0,
            travel_time_min=8.0,
        ),
        Road(
            id="R002",
            from_zone_id="Z001",
            to_zone_id="Z003",
            distance_km=6.0,
            travel_time_min=12.0,
        ),
    ]

    graph = RoutingGraph(roads)

    neighbors = graph.neighbors("Z001")

    assert len(neighbors) == 2
    assert {road.id for road in neighbors} == {"R001", "R002"}


def test_unknown_zone_has_no_neighbors():
    graph = RoutingGraph([])

    assert graph.neighbors("UNKNOWN") == []
    assert graph.has_zone("UNKNOWN") is False