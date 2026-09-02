from backend.app.engines.disaster_simulator import (
    SimulationStep,
    apply_simulation_step,
    create_flood_simulation,
)
from backend.app.state.initial_state import (
    create_demo_world_state,
)


def test_simulation_step_updates_zone():
    world_state = create_demo_world_state()

    step = SimulationStep(
        name="Rising water",
        zone_id="Z001",
        water_depth_m=2.0,
    )

    updated_state = apply_simulation_step(
        world_state,
        step,
    )

    zone = updated_state.get_zone("Z001")

    assert zone is not None
    assert zone.water_depth_m == 2.0


def test_simulation_step_preserves_unspecified_values():
    world_state = create_demo_world_state()

    original = world_state.get_zone("Z001")

    assert original is not None

    step = SimulationStep(
        name="Heavy rainfall",
        zone_id="Z001",
        rainfall_mm_per_hr=150.0,
    )

    updated_state = apply_simulation_step(
        world_state,
        step,
    )

    zone = updated_state.get_zone("Z001")

    assert zone is not None
    assert zone.rainfall_mm_per_hr == 150.0
    assert zone.water_depth_m == original.water_depth_m
    assert (
        zone.accessibility_percent
        == original.accessibility_percent
    )


def test_flood_simulation_contains_expected_steps():
    steps = create_flood_simulation()

    assert len(steps) == 4

    assert steps[0].name == "Heavy rainfall"
    assert steps[1].name == "Rising water"
    assert steps[2].name == "Road access deteriorates"
    assert steps[3].name == "Severe flooding"


def test_flood_simulation_targets_riverside():
    steps = create_flood_simulation()

    assert all(
        step.zone_id == "Z001"
        for step in steps
    )


def test_flood_simulation_can_be_applied_sequentially():
    world_state = create_demo_world_state()

    for step in create_flood_simulation():
        world_state = apply_simulation_step(
            world_state,
            step,
        )

    zone = world_state.get_zone("Z001")

    assert zone is not None
    assert zone.water_depth_m == 2.5
    assert zone.rainfall_mm_per_hr == 150.0
    assert zone.accessibility_percent == 5.0