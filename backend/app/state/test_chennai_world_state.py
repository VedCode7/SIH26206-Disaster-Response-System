from backend.app.state.initial_state import (
    create_chennai_world_state,
)


def test_create_chennai_world_state():
    world_state = create_chennai_world_state()

    assert world_state.disaster_active is False
    assert len(world_state.zones) == 200


def test_chennai_world_state_has_population():
    world_state = create_chennai_world_state()

    populations = [
        zone.population
        for zone in world_state.zones
    ]

    assert all(population > 0 for population in populations)
    assert sum(populations) == 6672103


def test_chennai_world_state_has_geometry():
    world_state = create_chennai_world_state()

    assert all(
        zone.geometry is not None
        for zone in world_state.zones
    )


def test_chennai_world_state_has_unique_zone_ids():
    world_state = create_chennai_world_state()

    zone_ids = [
        zone.id
        for zone in world_state.zones
    ]

    assert len(zone_ids) == len(set(zone_ids))