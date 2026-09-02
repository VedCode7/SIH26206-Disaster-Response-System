import pytest

from backend.app.engines.world_state_updater import (
    update_zone_conditions,
)
from backend.app.state.initial_state import (
    create_demo_world_state,
)


def test_zone_water_level_can_be_updated():
    world_state = create_demo_world_state()

    original_zone = world_state.get_zone("Z001")

    assert original_zone is not None

    original_water = original_zone.water_depth_m

    updated_state = update_zone_conditions(
        world_state,
        "Z001",
        water_depth_m=2.5,
    )

    updated_zone = updated_state.get_zone("Z001")

    assert updated_zone is not None
    assert updated_zone.water_depth_m == 2.5

    assert original_zone.water_depth_m == original_water


def test_multiple_conditions_can_be_updated():
    world_state = create_demo_world_state()

    updated_state = update_zone_conditions(
        world_state,
        "Z001",
        water_depth_m=1.8,
        rainfall_mm_per_hr=90.0,
        accessibility_percent=40.0,
    )

    zone = updated_state.get_zone("Z001")

    assert zone is not None
    assert zone.water_depth_m == 1.8
    assert zone.rainfall_mm_per_hr == 90.0
    assert zone.accessibility_percent == 40.0


def test_unmodified_conditions_are_preserved():
    world_state = create_demo_world_state()

    zone = world_state.get_zone("Z001")

    assert zone is not None

    original_rainfall = zone.rainfall_mm_per_hr
    original_accessibility = zone.accessibility_percent

    updated_state = update_zone_conditions(
        world_state,
        "Z001",
        water_depth_m=2.0,
    )

    updated_zone = updated_state.get_zone("Z001")

    assert updated_zone is not None
    assert updated_zone.water_depth_m == 2.0
    assert updated_zone.rainfall_mm_per_hr == original_rainfall
    assert updated_zone.accessibility_percent == original_accessibility


def test_unknown_zone_is_rejected():
    world_state = create_demo_world_state()

    with pytest.raises(ValueError):
        update_zone_conditions(
            world_state,
            "UNKNOWN",
            water_depth_m=2.0,
        )


def test_original_world_state_is_not_modified():
    world_state = create_demo_world_state()

    original_zone = world_state.get_zone("Z001")

    assert original_zone is not None

    updated_state = update_zone_conditions(
        world_state,
        "Z001",
        water_depth_m=3.0,
    )

    updated_zone = updated_state.get_zone("Z001")

    assert updated_zone is not None

    assert updated_zone.water_depth_m == 3.0
    assert original_zone.water_depth_m != 3.0