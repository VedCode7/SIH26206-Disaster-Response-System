from backend.app.domain.models import Zone
from backend.app.domain.world_state import WorldState
from backend.app.state.world_state_store import WorldStateStore


def test_store_returns_initial_state():
    zone = Zone(
        id="Z001",
        name="Test Zone",
        population=1000,
        vulnerable_population=100,
    )

    state = WorldState(
        disaster_active=True,
        zones=[zone],
    )

    store = WorldStateStore(state)

    assert store.get_state() is state
    assert store.get_state().disaster_active is True
    assert len(store.get_state().zones) == 1


def test_store_can_replace_state():
    first_state = WorldState(
        disaster_active=False,
        zones=[],
    )

    second_state = WorldState(
        disaster_active=True,
        zones=[],
    )

    store = WorldStateStore(first_state)

    store.replace_state(second_state)

    assert store.get_state() is second_state
    assert store.get_state().disaster_active is True


def test_store_creates_empty_state_when_no_initial_state_is_given():
    store = WorldStateStore()

    state = store.get_state()

    assert isinstance(state, WorldState)
    assert state.zones == []