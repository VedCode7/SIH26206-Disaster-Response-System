from dataclasses import dataclass


@dataclass(frozen=True)
class ResourceDemand:
    """
    Represents the resources currently required by a disaster zone.
    """

    zone_id: str
    resource_type: str
    quantity: int
    priority: int

    def __post_init__(self):
        if not self.zone_id:
            raise ValueError("zone_id cannot be empty")

        if not self.resource_type:
            raise ValueError("resource_type cannot be empty")

        if self.quantity <= 0:
            raise ValueError("quantity must be greater than zero")

        if self.priority < 1:
            raise ValueError("priority must be at least 1")