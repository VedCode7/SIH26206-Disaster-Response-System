from dataclasses import dataclass


@dataclass(frozen=True)
class ResourceFacility:
    """A real-world emergency-relevant facility mapped to a Chennai ward."""

    id: str
    name: str
    resource_type: str
    zone_id: str
    latitude: float
    longitude: float
    source: str = "OpenStreetMap"
    osm_type: str | None = None
    osm_id: int | str | None = None
    emergency_capable: bool | None = None

    def __post_init__(self):
        if not self.id:
            raise ValueError("facility id cannot be empty")
        if not self.name:
            raise ValueError("facility name cannot be empty")
        if not self.resource_type:
            raise ValueError("resource_type cannot be empty")
        if not self.zone_id:
            raise ValueError("zone_id cannot be empty")
        if not -90 <= self.latitude <= 90:
            raise ValueError("latitude must be between -90 and 90")
        if not -180 <= self.longitude <= 180:
            raise ValueError("longitude must be between -180 and 180")
