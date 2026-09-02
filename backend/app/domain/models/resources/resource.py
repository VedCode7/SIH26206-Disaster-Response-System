from dataclasses import dataclass


@dataclass(frozen=True)
class Resource:
    """
    Represents a deployable disaster-response resource.
    """

    id: str
    resource_type: str
    current_zone_id: str
    quantity: int = 1

    def __post_init__(self):
        if not self.id:
            raise ValueError("Resource id cannot be empty")

        if not self.resource_type:
            raise ValueError("resource_type cannot be empty")

        if not self.current_zone_id:
            raise ValueError("current_zone_id cannot be empty")

        if self.quantity <= 0:
            raise ValueError("quantity must be greater than zero")