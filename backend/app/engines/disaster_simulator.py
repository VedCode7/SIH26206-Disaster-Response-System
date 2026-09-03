from dataclasses import dataclass

from backend.app.domain.world_state import WorldState
from backend.app.engines.world_state_updater import (
    update_zone_conditions,
)


@dataclass(frozen=True)
class SimulationStep:
    """
    A predefined change to the disaster environment.

    A simulation step may affect either zone conditions,
    road conditions, or both.
    """

    name: str
    zone_id: str

    water_depth_m: float | None = None
    rainfall_mm_per_hr: float | None = None
    accessibility_percent: float | None = None

    road_id: str | None = None
    road_accessibility_percent: float | None = None
    road_blocked: bool | None = None


def apply_simulation_step(
    world_state: WorldState,
    step: SimulationStep,
) -> WorldState:
    """
    Apply one simulation step to the world state.

    Road changes are intentionally not applied here because
    WorldState contains zone conditions only. Road conditions
    are handled by the simulation-response layer.
    """

    return update_zone_conditions(
        world_state,
        step.zone_id,
        water_depth_m=step.water_depth_m,
        rainfall_mm_per_hr=step.rainfall_mm_per_hr,
        accessibility_percent=step.accessibility_percent,
    )


def create_flood_simulation() -> list[SimulationStep]:
    """
    Return a deterministic flood escalation scenario.

    The scenario progressively increases flood severity and
    eventually blocks the primary road into Z001.
    """

    return [
        SimulationStep(
            name="Heavy rainfall",
            zone_id="Z001",
            rainfall_mm_per_hr=150.0,
        ),
        SimulationStep(
            name="Rising water",
            zone_id="Z001",
            water_depth_m=2.0,
        ),
        SimulationStep(
            name="Road access deteriorates",
            zone_id="Z001",
            accessibility_percent=20.0,
            road_id="R001",
            road_accessibility_percent=20.0,
        ),
        SimulationStep(
            name="Severe flooding",
            zone_id="Z001",
            water_depth_m=2.5,
            rainfall_mm_per_hr=150.0,
            accessibility_percent=5.0,
            road_id="R001",
            road_accessibility_percent=5.0,
            road_blocked=True,
        ),
    ]