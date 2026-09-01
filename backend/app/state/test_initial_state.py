from backend.app.domain.world_state import WorldState
from backend.app.state.initial_state import create_demo_world_state


def test_demo_world_state_is_created():
    state = create_demo_world_state()

    assert isinstance(state, WorldState)
    assert state.disaster_active is True
    assert len(state.zones) == 4


def test_demo_world_state_has_unique_zone_ids():
    state = create_demo_world_state()

    zone_ids = [zone.id for zone in state.zones]

    assert len(zone_ids) == len(set(zone_ids))


def test_demo_world_state_contains_expected_zones():
    state = create_demo_world_state()

    zone_ids = {zone.id for zone in state.zones}

    assert zone_ids == {"Z001", "Z002", "Z003", "Z004"}