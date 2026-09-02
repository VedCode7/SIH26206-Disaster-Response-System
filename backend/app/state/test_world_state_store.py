import pytest

from backend.app.state.initial_state import (
    create_demo_world_state,
)
from backend.app.state.world_state_store import (
    WorldStateStore,
)


def test_store_returns_initial_state():
    initial_state = create_demo_world_state()

    store = WorldStateStore(initial_state)

    assert store.get_state() is initial_state


def test_store_can_replace_state():
    initial_state = create_demo_world_state()

    store = WorldStateStore(initial_state)

    replacement_state = create_demo_world_state()

    store.replace_state(replacement_state)

    assert store.get_state() is replacement_state


def test_store_can_update_zone_conditions():
    initial_state = create_demo_world_state()

    store = WorldStateStore(initial_state)

    updated_state = store.update_zone_conditions(
        "Z001",
        water_depth_m=2.5,
        rainfall_mm_per_hr=80.0,
        accessibility_percent=50.0,
    )

    zone = updated_state.get_zone("Z001")

    assert zone is not None
    assert zone.water_depth_m == 2.5
    assert zone.rainfall_mm_per_hr == 80.0
    assert zone.accessibility_percent == 50.0


def test_store_keeps_updated_state():
    initial_state = create_demo_world_state()

    store = WorldStateStore(initial_state)

    store.update_zone_conditions(
        "Z001",
        water_depth_m=3.0,
    )

    current_state = store.get_state()
    zone = current_state.get_zone("Z001")

    assert zone is not None
    assert zone.water_depth_m == 3.0


def test_store_rejects_unknown_zone():
    initial_state = create_demo_world_state()

    store = WorldStateStore(initial_state)

    with pytest.raises(ValueError):
        store.update_zone_conditions(
            "UNKNOWN",
            water_depth_m=2.0,
        )