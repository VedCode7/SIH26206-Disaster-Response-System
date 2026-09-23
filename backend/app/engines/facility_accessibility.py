from backend.app.domain.models.resources import (
    FacilityAccessibility,
    ResourceAllocation,
    ResourceFacility,
    ResourceFacilityRoute,
)
from backend.app.engines.routing_engine import calculate_routes_from_origin
from backend.app.engines.routing_graph import RoutingGraph


# Facility destinations are routing context, not operational capacity.
# These preferences describe the type of mapped destination that makes the
# most sense for the second leg of each response-resource workflow.
_RESOURCE_FACILITY_TYPES: dict[str, tuple[str, ...]] = {
    "ambulance": ("hospital", "clinic"),
    "rescue_team": ("fire_station", "police_station", "shelter"),
    "boat": ("shelter", "hospital", "clinic"),
}


def preferred_facility_types(resource_type: str) -> tuple[str, ...]:
    """Return mapped facility categories relevant to a resource type."""
    return _RESOURCE_FACILITY_TYPES.get(
        resource_type,
        ("hospital", "clinic", "fire_station", "police_station", "shelter"),
    )


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

    destination_zone_ids = {
        facility.current_zone_id
        for facility in candidates
    }
    route_cache = calculate_routes_from_origin(
        routing_graph,
        origin_zone_id,
        destination_zone_ids,
    )

    results: list[FacilityAccessibility] = []

    for facility in candidates:
        route = route_cache.get(facility.current_zone_id)

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


def build_resource_facility_routes(
    *,
    allocations: list[ResourceAllocation] | tuple[ResourceAllocation, ...],
    facilities: list[ResourceFacility],
    routing_graph: RoutingGraph,
) -> list[ResourceFacilityRoute]:
    """Build one explicit site-to-facility route for every allocation.

    The first routing leg is represented by the deployment record. This
    function represents the second leg: the allocated resource's incident
    site to a mapped facility appropriate to that resource type.

    Facility selection is based on mapped facility type and current route
    accessibility only. It does not assert that the facility can receive
    patients, has beds, has staff, or is otherwise operational.
    """

    routes: list[ResourceFacilityRoute] = []

    for allocation in allocations:
        facility_types = set(preferred_facility_types(allocation.resource_type))

        # Compute the current route ranking once from the incident site, then
        # select the fastest accessible facility among the categories relevant
        # to this resource type. This keeps the second leg route-aware without
        # repeatedly running the graph for each preferred facility category.
        ranked = rank_facility_accessibility(
            origin_zone_id=allocation.destination_zone_id,
            facilities=facilities,
            routing_graph=routing_graph,
            limit=max(20, len(facilities)),
        )

        selected = next(
            (
                item
                for item in ranked
                if item.accessible and item.facility_type in facility_types
            ),
            None,
        )

        # If no preferred category is currently reachable, retain a mapped
        # geographic destination rather than fabricating an operational one.
        if selected is None:
            selected = next(
                (item for item in ranked if item.accessible),
                ranked[0] if ranked else None,
            )

        if selected is None:
            continue

        routes.append(
            ResourceFacilityRoute(
                resource_id=allocation.resource_id,
                resource_type=allocation.resource_type,
                origin_zone_id=allocation.destination_zone_id,
                facility_id=selected.facility_id,
                facility_type=selected.facility_type,
                facility_name=selected.facility_name,
                destination_zone_id=selected.destination_zone_id,
                accessible=selected.accessible,
                total_distance_km=selected.total_distance_km,
                total_travel_time_min=selected.total_travel_time_min,
                zone_path=selected.zone_path,
                road_path=selected.road_path,
            )
        )

    return routes
