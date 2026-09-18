from backend.app.data.geo.ward_loader import load_wards
from backend.app.data.geo.ward_zone_mapper import wards_to_zones
from backend.app.domain.world_state import WorldState


def create_chennai_world_state() -> WorldState:
    """
    Create a RADAR world state backed by the
    Greater Chennai Corporation ward geography.

    Demographic and live environmental values remain
    at neutral defaults until their dedicated data
    sources are integrated.
    """
    wards = load_wards()
    zones = wards_to_zones(wards)

    return WorldState(
        disaster_active=False,
        zones=zones,
    )