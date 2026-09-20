from __future__

from dataclasses import dataclass
from math import atan2, cos, exp, radians, sin, sqrt
from typing import Iterable

from backend.app.domain.models import RiskLevel, Zone
from backend.app.domain.models.resources import Resource, ResourceDemand
from backend.app.domain.models.response import ResponseAction
from backend.app.domain.models.routing import Road
from backend.app.domain.world_state import WorldState
from backend.app.engines.deployment_engine import create_deployments
from backend.app.engines.resource_allocator import allocate_resources
from backend.app.engines.response_demand import generate_resource_demands
from backend.app.engines.response_planner import generate_response_actions
from backend.app.engines.risk_engine import calculate_risk
from backend.app.engines.routing_graph import RoutingGraph


@dataclass(frozen=True)
class HistoricalStage:
    id: str
    date: str
    title: str
    narrative: str
    observed_rainfall_24h_mm: float | None
    model_rainfall_mm_per_hr: float
    reservoir_release_cusecs: float
    flood_factor: float
    drainage_factor: float
    road_factor: float


CHENNAI_2015_STAGES = (
    HistoricalStage(
        id="2015-11-30",
        date="30 Nov 2015",
        title="Second Rainfall Spell",
        narrative="The second major rainfall spell begins across Chennai and its catchments.",
        observed_rainfall_24h_mm=None,
        model_rainfall_mm_per_hr=90.0,
        reservoir_release_cusecs=0.0,
        flood_factor=0.35,
        drainage_factor=0.25,
        road_factor=0.25,
    ),
    HistoricalStage(
        id="2015-12-01",
        date="1 Dec 2015",
        title="Reservoir Release",
        narrative="Heavy catchment rainfall drives a major Chembarambakkam inflow and release into the Adyar system.",
        observed_rainfall_24h_mm=None,
        model_rainfall_mm_per_hr=120.0,
        reservoir_release_cusecs=29_400.0,
        flood_factor=0.65,
        drainage_factor=0.55,
        road_factor=0.55,
    ),
    HistoricalStage(
        id="2015-12-02",
        date="2 Dec 2015",
        title="Peak Inundation",
        narrative="The simulation reaches the historical peak: extreme rainfall, reservoir discharge and widespread inundation.",
        observed_rainfall_24h_mm=294.1,
        model_rainfall_mm_per_hr=150.0,
        reservoir_release_cusecs=29_400.0,
        flood_factor=1.0,
        drainage_factor=1.0,
        road_factor=1.0,
    ),
    HistoricalStage(
        id="2015-12-03",
        date="3 Dec 2015",
        title="Persistent Flooding",
        narrative="Rainfall begins to decline, but accumulated water and constrained drainage keep many areas hazardous.",
        observed_rainfall_24h_mm=None,
        model_rainfall_mm_per_hr=90.0,
        reservoir_release_cusecs=0.0,
        flood_factor=0.86,
        drainage_factor=0.85,
        road_factor=0.88,
    ),
    HistoricalStage(
        id="2015-12-04",
        date="4 Dec 2015",
        title="Early Recession",
        narrative="The forcing weakens and the simulated response shifts from escalation toward recovery and route restoration.",
        observed_rainfall_24h_mm=None,
        model_rainfall_mm_per_hr=45.0,
        reservoir_release_cusecs=0.0,
        flood_factor=0.62,
        drainage_factor=0.55,
        road_factor=0.60,
    ),
)


# Model anchors approximate major Chennai water corridors involved in the event.
# They are not surveyed historical flood boundaries.
_FLOOD_ANCHORS = (
    (13.005, 80.240, 1.00),
    (13.030, 80.225, 0.95),
    (13.070, 80.270, 0.90),
    (13.095, 80.285, 0.82),
    (13.000, 80.105, 0.70),
)


def _coordinates(value) -> Iterable[tuple[float, float]]:
    if not isinstance(value, list):
        return

    if (
        len(value) >= 2
        and isinstance(value[0], (int, float))
        and isinstance(value[1], (int, float))
    ):
        yield float(value[0]), float(value[1])
        return

    for child in value:
        yield from _coordinates(child)


def _centroid(zone: Zone) -> tuple[float, float] | None:
    if not zone.geometry:
        return None

    points = list(_coordinates(zone.geometry.get("coordinates")))
    if not points:
        return None

    return (
        sum(point[0] for point in points) / len(points),
        sum(point[1] for point in points) / len(points),
    )


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = (
        sin(d_lat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(d_lon / 2) ** 2
    )
    return 2 * radius_km * atan2(sqrt(a), sqrt(max(1 - a, 0.0)))


def _exposure_at(lat: float, lon: float) -> float:
    exposure = 0.0

    for anchor_lat, anchor_lon, weight in _FLOOD_ANCHORS:
        distance = _distance_km(lat, lon, anchor_lat, anchor_lon)
        influence = weight * exp(-distance / 3.2)
        exposure = max(exposure, influence)

    return max(0.12, min(exposure, 1.0))


def _road_midpoint(road: Road) -> tuple[float, float] | None:
    if not road.path:
        return None

    middle = road.path[len(road.path) // 2]
    return float(middle[1]), float(middle[0])


def _stage_zone(
    zone: Zone,
    stage: HistoricalStage,
    exposure: float,
) -> Zone:
    water = min(
        3.5,
        0.12
        + 2.85 * stage.flood_factor * exposure
        + 0.18 * stage.reservoir_release_cusecs / 29_400.0,
    )

    rainfall = min(
        150.0,
        stage.model_rainfall_mm_per_hr
        * (0.85 + 0.15 * exposure),
    )

    accessibility = max(
        0.0,
        100.0
        - 75.0 * stage.road_factor * exposure
        - 12.0 * stage.drainage_factor * max(exposure - 0.55, 0.0),
    )

    return Zone(
        **{
            **zone.model_dump(),
            "water_depth_m": round(water, 3),
            "rainfall_mm_per_hr": round(rainfall, 2),
            "accessibility_percent": round(accessibility, 2),
        }
    )


def _stage_roads(
    roads: list[Road],
    stage: HistoricalStage,
    exposures: dict[str, float],
) -> tuple[list[Road], list[dict]]:
    updated: list[Road] = []
    changes: list[dict] = []

    for road in roads:
        endpoint_exposure = max(
            exposures.get(road.from_zone_id, 0.12),
            exposures.get(road.to_zone_id, 0.12),
        )

        midpoint = _road_midpoint(road)
        corridor_exposure = (
            _exposure_at(*midpoint) if midpoint else endpoint_exposure
        )
        flood_pressure = max(endpoint_exposure, corridor_exposure)

        accessibility = max(
            0.0,
            100.0
            - 82.0 * stage.road_factor * flood_pressure
            - 10.0 * stage.drainage_factor * max(flood_pressure - 0.55, 0.0),
        )
        blocked = accessibility < 12.0 and stage.road_factor >= 0.85

        new_road = Road(
            id=road.id,
            from_zone_id=road.from_zone_id,
            to_zone_id=road.to_zone_id,
            distance_km=road.distance_km,
            travel_time_min=road.travel_time_min,
            accessibility_percent=round(accessibility, 2),
            blocked=blocked,
            path=road.path,
            capacity=road.capacity,
            road_type=road.road_type,
        )
        updated.append(new_road)

        old_restricted = road.blocked or road.accessibility_percent < 70
        new_restricted = (
            new_road.blocked
            or new_road.accessibility_percent < 70
        )

        if (
            old_restricted != new_restricted
            or new_road.blocked != road.blocked
        ):
            changes.append(
                {
                    "road_id": road.id,
                    "accessibility_percent": new_road.accessibility_percent,
                    "blocked": new_road.blocked,
                }
            )

    return updated, changes


def _risk_assessments(state: WorldState) -> list:
    return [calculate_risk(zone) for zone in state.zones]


def _response_resources(zones: list[Zone]) -> list[Resource]:
    if not zones:
        return []

    staging_zone = next(
        (zone.id for zone in zones if zone.id == "W18901"),
        zones[0].id,
    )

    return [
        Resource(
            id="SIM-AMB-001",
            resource_type="ambulance",
            current_zone_id=staging_zone,
            quantity=4,
            name="Simulated ambulance pool",
            source="historical simulation control input",
        ),
        Resource(
            id="SIM-RES-001",
            resource_type="rescue_team",
            current_zone_id=staging_zone,
            quantity=6,
            name="Simulated rescue-team pool",
            source="historical simulation control input",
        ),
        Resource(
            id="SIM-BOAT-001",
            resource_type="boat",
            current_zone_id=staging_zone,
            quantity=4,
            name="Simulated boat pool",
            source="historical simulation control input",
        ),
    ]


def _historical_response(
    assessments: list,
    graph: RoutingGraph,
    resources: list[Resource],
) -> dict:
    ordered = sorted(
        assessments,
        key=lambda assessment: float(assessment.risk_score),
        reverse=True,
    )

    priority = [
        assessment
        for assessment in ordered
        if assessment.risk_level in {RiskLevel.CRITICAL, RiskLevel.HIGH}
    ][:8]

    if not priority:
        priority = [
            assessment
            for assessment in ordered
            if assessment.risk_level == RiskLevel.WATCH
        ][:5]

    actions: list[ResponseAction] = []
    demands: list[ResourceDemand] = []

    for assessment in priority:
        actions.extend(
            generate_response_actions(
                zone_id=assessment.zone_id,
                risk_level=assessment.risk_level,
            )
        )
        demands.extend(generate_resource_demands(assessment))

    allocations = allocate_resources(
        resources=resources,
        demands=demands,
    )
    deployments = create_deployments(
        allocations=allocations,
        graph=graph,
    )

    served_quantities = {
        (allocation.destination_zone_id, allocation.resource_type): 0
        for allocation in allocations
    }
    for allocation in allocations:
        key = (allocation.destination_zone_id, allocation.resource_type)
        served_quantities[key] = (
            served_quantities.get(key, 0) + allocation.quantity
        )

    deployed_keys = {
        (
            deployment.allocation.destination_zone_id,
            deployment.allocation.resource_type,
        )
        for deployment in deployments
    }

    unserved = []
    for demand in demands:
        key = (demand.zone_id, demand.resource_type)
        served = served_quantities.get(key, 0)

        if served < demand.quantity:
            reason = "resource unavailable"
            if served > 0:
                reason = "partially allocated"
        elif key not in deployed_keys:
            reason = "no traversable route"
        else:
            continue

        unserved.append(
            {
                "zone_id": demand.zone_id,
                "resource_type": demand.resource_type,
                "quantity": max(demand.quantity - served, 0),
                "priority": demand.priority,
                "reason": reason,
            }
        )

    return {
        "priority_zones": [
            {
                "zone_id": assessment.zone_id,
                "risk_score": assessment.risk_score,
                "risk_level": assessment.risk_level.value,
            }
            for assessment in priority
        ],
        "actions": actions,
        "allocations": allocations,
        "deployments": deployments,
        "unserved_demands": unserved,
        "resource_pool": resources,
    }


def run_chennai_2015_simulation(
    initial_state: WorldState,
    roads: list[Road],
) -> list[dict]:
    """
    Replay the December 2015 Chennai flood against the current geography.

    Historical rainfall and reservoir anchors drive the stage progression.
    Ward-level water depth, accessibility and road impacts are deterministic
    reconstruction outputs rather than claims about observed ward-level data.
    """
    if not initial_state.zones:
        raise ValueError("Chennai simulation requires at least one ward.")

    exposures = {}
    for zone in initial_state.zones:
        centroid = _centroid(zone)
        exposures[zone.id] = (
            _exposure_at(centroid[1], centroid[0])
            if centroid
            else 0.12
        )

    current_zones = list(initial_state.zones)
    current_roads = list(roads)
    resources = _response_resources(current_zones)
    snapshots: list[dict] = []

    for stage in CHENNAI_2015_STAGES:
        current_zones = [
            _stage_zone(zone, stage, exposures[zone.id])
            for zone in current_zones
        ]

        current_roads, road_changes = _stage_roads(
            current_roads,
            stage,
            exposures,
        )

        state = WorldState(
            current_time=initial_state.current_time,
            disaster_active=True,
            zones=current_zones,
        )

        assessments = _risk_assessments(state)
        graph = RoutingGraph(current_roads)
        response = _historical_response(
            assessments,
            graph,
            resources,
        )

        level_counts = {
            level.value: sum(
                assessment.risk_level == level
                for assessment in assessments
            )
            for level in RiskLevel
        }

        highest = max(
            assessments,
            key=lambda assessment: float(assessment.risk_score),
        )

        snapshots.append(
            {
                "stage_id": stage.id,
                "date": stage.date,
                "title": stage.title,
                "narrative": stage.narrative,
                "observed_rainfall_24h_mm": stage.observed_rainfall_24h_mm,
                "model_rainfall_mm_per_hr": stage.model_rainfall_mm_per_hr,
                "reservoir_release_cusecs": stage.reservoir_release_cusecs,
                "risk_counts": level_counts,
                "highest_risk": highest,
                "assessments": assessments,
                "road_changes": road_changes,
                "road_summary": {
                    "restricted": sum(
                        1
                        for road in current_roads
                        if not road.blocked
                        and road.accessibility_percent < 70
                    ),
                    "blocked": sum(road.blocked for road in current_roads),
                },
                "response": response,
            }
        )

    return snapshots
