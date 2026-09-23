from backend.app.domain.models.resources import Resource
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


def make_resources():
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


def make_graph():
    return RoutingGraph(
        [
            Road(
                id="R001",
                from_zone_id="Z002",
                to_zone_id="Z001",
                distance_km=5.0,
                travel_time_min=10.0,
            )
        ]
    )


def test_simulation_response_produces_one_snapshot_per_step():
    snapshots = analyze_simulation_response(
        initial_state=create_demo_world_state(),
        steps=create_flood_simulation(),
        resources=make_resources(),
        routing_graph=make_graph(),
    )

    assert len(snapshots) == 4


def test_simulation_response_contains_response_plan():
    snapshots = analyze_simulation_response(
        initial_state=create_demo_world_state(),
        steps=create_flood_simulation(),
        resources=make_resources(),
        routing_graph=make_graph(),
    )

    for snapshot in snapshots:
        assert snapshot.response_plan.zone_id == "Z001"


def test_final_flood_stage_produces_critical_response():
    snapshots = analyze_simulation_response(
        initial_state=create_demo_world_state(),
        steps=create_flood_simulation(),
        resources=make_resources(),
        routing_graph=make_graph(),
    )

    final_snapshot = snapshots[-1]

    assert final_snapshot.assessment.risk_level.value == "critical"
    assert len(final_snapshot.response_plan.actions) > 0
    assert len(final_snapshot.response_plan.demands) > 0
    # The final simulation step blocks the only road into Z001. A route-aware
    # allocator must therefore leave the demand unallocated rather than
    # pretending that an unreachable unit can be deployed.
    assert len(final_snapshot.response_plan.allocations) == 0
