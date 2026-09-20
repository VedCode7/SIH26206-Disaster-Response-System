from dataclasses import dataclass


@dataclass(frozen=True)
class FacilityAccessibility:
    """Routing context for a real mapped facility.

    This describes geographic accessibility only. It does not imply
    facility capacity, staffing, vehicle availability, or live status.
    """

    facility_id: str
    facility_type: str
    facility_name: str | None
    origin_zone_id: str
    destination_zone_id: str
    accessible: bool
    total_distance_km: float | None
    total_travel_time_min: float | None
    zone_path: tuple[str, ...] = ()
    road_path: tuple[str, ...] = ()
