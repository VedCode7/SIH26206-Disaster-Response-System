from dataclasses import dataclass


@dataclass(frozen=True)
class RouteResult:
    """
    Represents a calculated route through the disaster road network.
    """

    origin_zone_id: str
    destination_zone_id: str
    zone_path: tuple[str, ...]
    road_path: tuple[str, ...]
    total_distance_km: float
    total_travel_time_min: float