from dataclasses import dataclass

from backend.app.domain.models.routing import RouteResult
from backend.app.domain.models.resources import ResourceAllocation


@dataclass(frozen=True)
class ResourceDeployment:
    """
    Represents a resource allocation together with
    the route required to deploy that resource.
    """

    allocation: ResourceAllocation
    route: RouteResult

    def __post_init__(self):
        if (
            self.allocation.source_zone_id
            != self.route.origin_zone_id
        ):
            raise ValueError(
                "Allocation source zone must match route origin zone"
            )

        if (
            self.allocation.destination_zone_id
            != self.route.destination_zone_id
        ):
            raise ValueError(
                "Allocation destination zone must match route destination zone"
            )