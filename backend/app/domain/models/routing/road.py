from dataclasses import dataclass


@dataclass(frozen=True)
class Road:
    """
    Represents a traversable connection between two disaster-response zones.
    """

    id: str
    from_zone_id: str
    to_zone_id: str
    distance_km: float
    travel_time_min: float
    accessibility_percent: float = 100.0
    blocked: bool = False

    path: tuple[tuple[float, float], ...] | None = None
    capacity: float | None = None
    road_type: str | None = None

    def __post_init__(self):
        if self.distance_km < 0:
            raise ValueError("distance_km cannot be negative")

        if self.travel_time_min < 0:
            raise ValueError("travel_time_min cannot be negative")

        if not 0 <= self.accessibility_percent <= 100:
            raise ValueError(
                "accessibility_percent must be between 0 and 100"
            )

        if self.from_zone_id == self.to_zone_id:
            raise ValueError("A road must connect two different zones")