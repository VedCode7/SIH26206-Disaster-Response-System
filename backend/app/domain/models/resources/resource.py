from dataclasses import dataclass


@dataclass(frozen=True)
class Resource:
    """
    A real-world or operationally configured disaster-response resource.

    Geographic fields describe where the mapped resource is located. They are
    deliberately optional so existing demo resources remain compatible.
    """

    id: str
    resource_type: str
    current_zone_id: str
    quantity: int = 1
    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    source: str | None = None

    def __post_init__(self):
        if not self.id:
            raise ValueError("Resource id cannot be empty")

        if not self.resource_type:
            raise ValueError("resource_type cannot be empty")

        if not self.current_zone_id:
            raise ValueError("current_zone_id cannot be empty")

        if self.quantity <= 0:
            raise ValueError("quantity must be greater than zero")

        if self.latitude is not None and not -90 <= self.latitude <= 90:
            raise ValueError("latitude must be between -90 and 90")

        if self.longitude is not None and not -180 <= self.longitude <= 180:
            raise ValueError("longitude must be between -180 and 180")
