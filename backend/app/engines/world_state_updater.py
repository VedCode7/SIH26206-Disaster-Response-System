from datetime import datetime, timezone

from backend.app.domain.models.zone import Zone
from backend.app.domain.world_state import WorldState


def update_zone_conditions(
    world_state: WorldState,
    zone_id: str,
    *,
    water_depth_m: float | None = None,
    rainfall_mm_per_hr: float | None = None,
    accessibility_percent: float | None = None,
) -> WorldState:
    """
    Return a new WorldState with updated environmental
    conditions for the requested zone.

    The original WorldState is not modified.
    """

    zone = world_state.get_zone(zone_id)

    if zone is None:
        raise ValueError(
            f"Zone '{zone_id}' not found"
        )

    updated_zone = zone.model_copy(
        update={
            key: value
            for key, value in {
                "water_depth_m": water_depth_m,
                "rainfall_mm_per_hr": rainfall_mm_per_hr,
                "accessibility_percent": accessibility_percent,
            }.items()
            if value is not None
        }
    )

    updated_zones = [
        updated_zone if current_zone.id == zone_id else current_zone
        for current_zone in world_state.zones
    ]

    return world_state.model_copy(
        update={
            "zones": updated_zones,
            "current_time": datetime.now(timezone.utc),
        }
    )