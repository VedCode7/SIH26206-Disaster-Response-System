from backend.app.data.geo.chennai_world import (
    create_chennai_world_state,
)


def test_create_chennai_world_state():
    world = create_chennai_world_state()

    assert world.disaster_active is False
    assert len(world.zones) == 200
    assert len({zone.id for zone in world.zones}) == 200
    assert all(zone.geometry is not None for zone in world.zones)