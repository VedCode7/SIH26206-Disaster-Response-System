from dataclasses import replace

from backend.app.domain.models.resources import Resource, ResourceFacility
from backend.app.domain.models.routing import Road
from backend.app.engines.chennai_2015_simulation import (
    _historical_response,
    run_chennai_2015_simulation,
)
from backend.app.engines.facility_accessibility import (
    rank_facility_accessibility,
)
from backend.app.engines.facility_relevance import (
    filter_relevant_facilities,
)
from backend.app.engines.routing_graph import RoutingGraph


def _apply_stage_road_changes(
    roads: list[Road],
    changes: list[dict],
) -> list[Road]:
    """Apply a simulation stage's road deltas without mutating the base graph."""
    by_id = {change["road_id"]: change for change in changes}
    updated: list[Road] = []

    for road in roads:
        change = by_id.get(road.id)
        if change is None:
            updated.append(road)
            continue

        updated.append(
            replace(
                road,
                accessibility_percent=change["accessibility_percent"],
                blocked=change["blocked"],
            )
        )

    return updated


def run_chennai_2015_response_simulation(
    *,
    initial_state,
    roads: list[Road],
    resources: list[Resource],
    facilities: list[ResourceFacility],
) -> list[dict]:
    """
    Run the historical Chennai replay using explicit simulated inventory
    and real mapped emergency facilities.

    The historical simulation engine remains responsible for flood and road
    reconstruction. This wrapper replaces only its response resource pool
    with the declared scenario inventory and adds route-aware facility
    recommendations. No facility capacity is inferred.
    """
    stages = run_chennai_2015_simulation(
        initial_state=initial_state,
        roads=roads,
    )

    current_roads = list(roads)

    for stage in stages:
        current_roads = _apply_stage_road_changes(
            current_roads,
            stage["road_changes"],
        )
        graph = RoutingGraph(current_roads)

        stage["response"] = _historical_response(
            stage["assessments"],
            graph,
            resources,
        )

        recommendations: dict[str, list] = {}

        for priority_zone in stage["response"]["priority_zones"]:
            zone_id = priority_zone["zone_id"]
            assessment = next(
                assessment
                for assessment in stage["assessments"]
                if assessment.zone_id == zone_id
            )
            relevant = filter_relevant_facilities(
                facilities,
                assessment.risk_level,
            )
            recommendations[zone_id] = rank_facility_accessibility(
                origin_zone_id=zone_id,
                facilities=relevant,
                routing_graph=graph,
                limit=10,
            )

        stage["response"]["facility_recommendations"] = recommendations
        stage["response"]["mapped_facilities"] = [
            facility
            for facility in facilities
            if facility.current_zone_id
            in {
                item["zone_id"]
                for item in stage["response"]["priority_zones"]
            }
        ]

    return stages
