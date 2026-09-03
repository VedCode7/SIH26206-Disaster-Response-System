from dataclasses import dataclass

from backend.app.domain.models.response import ResponsePlan
from backend.app.domain.models.risk import RiskAssessment
from backend.app.domain.world_state import WorldState

from backend.app.engines.response_coordinator import (
    create_response_plan,
)
from backend.app.engines.disaster_simulator import (
    SimulationStep,
    apply_simulation_step,
)
from backend.app.engines.risk_engine import calculate_risk
from backend.app.engines.routing_graph import RoutingGraph


@dataclass(frozen=True)
class SimulationResponseSnapshot:
    """
    A disaster simulation step together with the
    response decision generated for that state.
    """

    step_name: str
    zone_id: str
    assessment: RiskAssessment
    response_plan: ResponsePlan


def analyze_simulation_response(
    initial_state: WorldState,
    steps: list[SimulationStep],
    resources,
    routing_graph: RoutingGraph,
) -> list[SimulationResponseSnapshot]:
    """
    Simulate disaster escalation and generate a response
    plan after every simulation step.

    The initial WorldState is not modified.
    """

    current_state = initial_state
    snapshots: list[SimulationResponseSnapshot] = []

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

        response_plan = create_response_plan(
            assessment=assessment,
            resources=resources,
            routing_graph=routing_graph,
        )

        snapshots.append(
            SimulationResponseSnapshot(
                step_name=step.name,
                zone_id=step.zone_id,
                assessment=assessment,
                response_plan=response_plan,
            )
        )

    return snapshots