from backend.app.engines.disaster_simulator import (
    create_flood_simulation,
)
from backend.app.engines.simulation_analysis import (
    analyze_simulation,
)
from backend.app.state.initial_state import (
    create_demo_world_state,
)


def test_simulation_produces_one_snapshot_per_step():
    world_state = create_demo_world_state()
    steps = create_flood_simulation()

    snapshots = analyze_simulation(
        world_state,
        steps,
    )

    assert len(snapshots) == len(steps)


def test_simulation_snapshots_have_correct_zone():
    world_state = create_demo_world_state()
    steps = create_flood_simulation()

    snapshots = analyze_simulation(
        world_state,
        steps,
    )

    assert all(
        snapshot.zone_id == "Z001"
        for snapshot in snapshots
    )


def test_risk_increases_during_flood_simulation():
    world_state = create_demo_world_state()
    steps = create_flood_simulation()

    snapshots = analyze_simulation(
        world_state,
        steps,
    )

    scores = [
        snapshot.assessment.risk_score
        for snapshot in snapshots
    ]

    assert scores[-1] > scores[0]


def test_simulation_final_state_is_critical():
    world_state = create_demo_world_state()
    steps = create_flood_simulation()

    snapshots = analyze_simulation(
        world_state,
        steps,
    )

    final_assessment = snapshots[-1].assessment

    assert final_assessment.risk_score >= 75
    assert final_assessment.risk_level.value == "critical"


def test_simulation_does_not_modify_initial_state():
    world_state = create_demo_world_state()

    original_zone = world_state.get_zone("Z001")

    assert original_zone is not None

    original_water = original_zone.water_depth_m
    original_rainfall = original_zone.rainfall_mm_per_hr
    original_accessibility = (
        original_zone.accessibility_percent
    )

    analyze_simulation(
        world_state,
        create_flood_simulation(),
    )

    zone_after = world_state.get_zone("Z001")

    assert zone_after is not None

    assert zone_after.water_depth_m == original_water
    assert (
        zone_after.rainfall_mm_per_hr
        == original_rainfall
    )
    assert (
        zone_after.accessibility_percent
        == original_accessibility
    )