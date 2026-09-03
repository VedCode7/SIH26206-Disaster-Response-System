from backend.app.domain.models.routing import Road
from backend.app.engines.disaster_simulator import (
    create_flood_simulation,
)
from backend.app.engines.routing_graph import RoutingGraph
from backend.app.engines.simulation_response import (
    analyze_simulation_response,
)
from backend.app.state.initial_state import (
    create_demo_world_state,
)


def create_test_resources():
    from backend.app.domain.models.resources import (
        Resource,
    )

    return [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z002",
            quantity=2,
        ),
        Resource(
            id="RES001",
            resource_type="rescue_team",
            current_zone_id="Z002",
            quantity=2,
        ),
        Resource(
            id="BOAT001",
            resource_type="boat",
            current_zone_id="Z002",
            quantity=1,
        ),
    ]


def create_test_roads():
    return [
        Road(
            id="R001",
            from_zone_id="Z002",
            to_zone_id="Z001",
            distance_km=3.0,
            travel_time_min=5.0,
        ),
        Road(
            id="R002",
            from_zone_id="Z002",
            to_zone_id="Z003",
            distance_km=4.0,
            travel_time_min=6.0,
        ),
        Road(
            id="R003",
            from_zone_id="Z003",
            to_zone_id="Z001",
            distance_km=4.0,
            travel_time_min=6.0,
        ),
    ]


def test_simulation_response_rebuilds_routes_after_road_changes():
    initial_state = create_demo_world_state()

    roads = create_test_roads()

    graph = RoutingGraph(roads)

    snapshots = analyze_simulation_response(
        initial_state=initial_state,
        steps=create_flood_simulation(),
        resources=create_test_resources(),
        routing_graph=graph,
    )

    assert len(snapshots) == 4

    first_step = snapshots[0]

    assert len(first_step.response_plan.deployments) > 0

    first_route = (
        first_step.response_plan.deployments[0].route
    )

    assert first_route.zone_path == (
        "Z002",
        "Z001",
    )


def test_severe_flooding_blocks_primary_road():
    initial_state = create_demo_world_state()

    roads = create_test_roads()

    graph = RoutingGraph(roads)

    snapshots = analyze_simulation_response(
        initial_state=initial_state,
        steps=create_flood_simulation(),
        resources=create_test_resources(),
        routing_graph=graph,
    )

    final_step = snapshots[-1]

    assert final_step.step_name == "Severe flooding"

    assert final_step.response_plan.deployments

    for deployment in final_step.response_plan.deployments:
        assert deployment.route.zone_path == (
            "Z002",
            "Z003",
            "Z001",
        )

        assert deployment.route.road_path == (
            "R002",
            "R003",
        )


def test_simulation_does_not_modify_original_road_graph():
    initial_state = create_demo_world_state()

    roads = create_test_roads()

    graph = RoutingGraph(roads)

    analyze_simulation_response(
        initial_state=initial_state,
        steps=create_flood_simulation(),
        resources=create_test_resources(),
        routing_graph=graph,
    )

    original_r001 = graph.get_road("R001")

    assert original_r001 is not None

    assert original_r001.accessibility_percent == 100.0
    assert original_r001.blocked is False