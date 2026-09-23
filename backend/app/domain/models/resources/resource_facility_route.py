from dataclasses import dataclass


@dataclass(frozen=True)
class ResourceFacilityRoute:
    """Second-leg routing context for an allocated operational resource.

    The route starts at the incident/site zone (the allocation destination)
    and ends at a mapped facility. The facility is only a geographic routing
    destination; this model does not imply facility capacity, staffing,
    readiness, or availability.
    """

    resource_id: str
    resource_type: str
    origin_zone_id: str
    facility_id: str
    facility_type: str
    facility_name: str | None
    destination_zone_id: str
    accessible: bool
    total_distance_km: float | None
    total_travel_time_min: float | None
    zone_path: tuple[str, ...] = ()
    road_path: tuple[str, ...] = ()
