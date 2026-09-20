from dataclasses import dataclass


@dataclass(frozen=True)
class ResourceFacility:
    """A geographically mapped real-world facility.

    A facility is not an operational resource unit. In particular, this model
    intentionally has no quantity field: the presence of a hospital, fire
    station, police station, shelter, etc. does not establish how many
    deployable units or personnel are currently available there.
    """

    id: str
    resource_type: str
    current_zone_id: str
    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    source: str | None = None

    def __post_init__(self):
        if not self.id:
            raise ValueError("Facility id cannot be empty")
        if not self.resource_type:
            raise ValueError("resource_type cannot be empty")
        if not self.current_zone_id:
            raise ValueError("current_zone_id cannot be empty")
        if self.latitude is not None and not -90 <= self.latitude <= 90:
            raise ValueError("latitude must be between -90 and 90")
        if self.longitude is not None and not -180 <= self.longitude <= 180:
            raise ValueError("longitude must be between -180 and 180")
