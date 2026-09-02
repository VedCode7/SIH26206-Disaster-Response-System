from dataclasses import dataclass


@dataclass(frozen=True)
class ResourceAllocation:
    """
    Represents an allocation of a resource to a disaster zone.
    """

    resource_id: str
    resource_type: str
    source_zone_id: str
    destination_zone_id: str
    quantity: int
    priority: int

    def __post_init__(self):
        if not self.resource_id:
            raise ValueError("resource_id cannot be empty")

        if not self.resource_type:
            raise ValueError("resource_type cannot be empty")

        if not self.source_zone_id:
            raise ValueError("source_zone_id cannot be empty")

        if not self.destination_zone_id:
            raise ValueError("destination_zone_id cannot be empty")

        if self.quantity <= 0:
            raise ValueError("quantity must be greater than zero")

        if self.priority < 1:
            raise ValueError("priority must be at least 1")