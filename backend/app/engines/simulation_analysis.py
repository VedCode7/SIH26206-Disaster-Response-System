from dataclasses import dataclass

from backend.app.domain.models.risk import RiskAssessment
from backend.app.domain.world_state import WorldState
from backend.app.engines.disaster_simulator import (
    SimulationStep,
    apply_simulation_step,
)
from backend.app.engines.risk_engine import calculate_risk


@dataclass(frozen=True)
class SimulationSnapshot:
    """
    Risk state captured after one simulation step.
    """

    step_name: str
    zone_id: str
    assessment: RiskAssessment


def analyze_simulation(
    initial_state: WorldState,
    steps: list[SimulationStep],
) -> list[SimulationSnapshot]:
    """
    Apply simulation steps sequentially and calculate
    the affected zone's risk after each step.

    The initial WorldState is not modified.
    """

    current_state = initial_state
    snapshots: list[SimulationSnapshot] = []

    for step in steps:
        current_state = apply_simulation_step(
            current_state,
            step,
        )

        zone = current_state.get_zone(step.zone_id)

        if zone is None:
            raise ValueError(
                f"Zone '{step.zone_id}' not found"
            )

        assessment = calculate_risk(zone)

        snapshots.append(
            SimulationSnapshot(
                step_name=step.name,
                zone_id=step.zone_id,
                assessment=assessment,
            )
        )

    return snapshots