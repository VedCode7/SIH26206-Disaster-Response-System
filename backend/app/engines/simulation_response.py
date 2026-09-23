from dataclasses import dataclass

from backend.app.domain.models.response import ResponsePlan
from backend.app.domain.models.risk import RiskAssessment
from backend.app.domain.models.resources import ResourceFacility
from backend.app.domain.models.routing import Road
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


def _apply_road_changes(
    roads: list[Road],
    step: SimulationStep,
) -> list[Road]:
    """
    Apply road-condition changes from a simulation step.

    A new road list is returned so the original road network
    remains unchanged.
    """

    if step.road_id is None:
        return list(roads)

    updated_roads: list[Road] = []

    for road in roads:
        if road.id != step.road_id:
            updated_roads.append(road)
            continue

        updated_roads.append(
            Road(
                id=road.id,
                from_zone_id=road.from_zone_id,
                to_zone_id=road.to_zone_id,
                distance_km=road.distance_km,
                travel_time_min=road.travel_time_min,
                accessibility_percent=(
                    road.accessibility_percent
                    if step.road_accessibility_percent is None
                    else step.road_accessibility_percent
                ),
                blocked=(
                    road.blocked
                    if step.road_blocked is None
                    else step.road_blocked
                ),
            )
        )

    return updated_roads


def analyze_simulation_response(
    initial_state: WorldState,
    steps: list[SimulationStep],
    resources,
    routing_graph: RoutingGraph,
    facilities: list[ResourceFacility] | None = None,
) -> list[SimulationResponseSnapshot]:
    """
    Simulate disaster escalation and generate a response
    plan after every simulation step.

    Zone conditions and road conditions are updated
    independently for each simulation step.

    The supplied WorldState and RoutingGraph are never modified.

    Facilities are passed through to the response coordinator so
    each snapshot can recommend real mapped emergency facilities
    without treating those facilities as deployable inventory.
    """

    current_state = initial_state
    current_roads = routing_graph.get_roads()

    snapshots: list[SimulationResponseSnapshot] = []

    previous_deployments = ()

    for step in steps:
        current_state = apply_simulation_step(
            current_state,
            step,
        )

        current_roads = _apply_road_changes(
            current_roads,
            step,
        )

        current_graph = RoutingGraph(current_roads)

        zone = current_state.get_zone(
            step.zone_id
        )

        if zone is None:
            raise ValueError(
                f"Zone '{step.zone_id}' not found"
            )

        assessment = calculate_risk(zone)

        response_plan = create_response_plan(
            assessment=assessment,
            resources=resources,
            routing_graph=current_graph,
            facilities=facilities,
            live_only=False,
        )

        deployments = response_plan.deployments

        if not deployments and previous_deployments:
            deployments = previous_deployments

        if deployments != response_plan.deployments:
            response_plan = type(response_plan)(
                zone_id=response_plan.zone_id,
                risk_level=response_plan.risk_level,
                actions=response_plan.actions,
                allocations=response_plan.allocations,
                deployments=deployments,
                facilities=response_plan.facilities,
                facility_recommendations=response_plan.facility_recommendations,
            )

        previous_deployments = deployments

        snapshots.append(
            SimulationResponseSnapshot(
                step_name=step.name,
                zone_id=step.zone_id,
                assessment=assessment,
                response_plan=response_plan,
            )
        )

    return snapshots
