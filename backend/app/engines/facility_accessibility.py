from backend.app.domain.models.resources import (
    FacilityAccessibility,
    ResourceFacility,
)
from backend.app.engines.routing_engine import calculate_route
from backend.app.engines.routing_graph import RoutingGraph


def rank_facility_accessibility(
    *,
    origin_zone_id: str,
    facilities: list[ResourceFacility],
    routing_graph: RoutingGraph,
    facility_type: str | None = None,
    limit: int = 20,
) -> list[FacilityAccessibility]:
    """Rank mapped facilities by currently traversable route cost.

    This is geographic routing context only. It deliberately does not
    infer capacity, staffing, availability, or operational readiness.
    """

    if limit < 1:
        raise ValueError("limit must be at least 1")

    candidates = [
        facility
        for facility in facilities
        if facility_type is None
        or facility.resource_type == facility_type
    ]

    # Many facilities share the same ward. Route once per unique destination
    # ward instead of recalculating the identical route for every facility.
    route_cache = {}
    for destination_zone_id in {facility.current_zone_id for facility in candidates}:
        route_cache[destination_zone_id] = calculate_route(
            routing_graph,
            origin_zone_id,
            destination_zone_id,
        )

    results: list[FacilityAccessibility] = []

    for facility in candidates:
        route = route_cache[facility.current_zone_id]

        if route is None:
            results.append(
                FacilityAccessibility(
                    facility_id=facility.id,
                    facility_type=facility.resource_type,
                    facility_name=facility.name,
                    origin_zone_id=origin_zone_id,
                    destination_zone_id=facility.current_zone_id,
                    accessible=False,
                    total_distance_km=None,
                    total_travel_time_min=None,
                )
            )
            continue

        results.append(
            FacilityAccessibility(
                facility_id=facility.id,
                facility_type=facility.resource_type,
                facility_name=facility.name,
                origin_zone_id=origin_zone_id,
                destination_zone_id=facility.current_zone_id,
                accessible=True,
                total_distance_km=route.total_distance_km,
                total_travel_time_min=route.total_travel_time_min,
                zone_path=route.zone_path,
                road_path=route.road_path,
            )
        )

    results.sort(
        key=lambda item: (
            not item.accessible,
            item.total_travel_time_min
            if item.total_travel_time_min is not None
            else float("inf"),
            item.facility_id,
        )
    )

    return results[:limit]
