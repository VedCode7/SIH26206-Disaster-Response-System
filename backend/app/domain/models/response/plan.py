from dataclasses import dataclass
from typing import Tuple

from backend.app.domain.models.response.action import ResponseAction
from backend.app.domain.models.response.deployment import (
    ResourceDeployment,
)
from backend.app.domain.models.resources.allocation import (
    ResourceAllocation,
)
from backend.app.domain.models.resources.resource_facility import (
    ResourceFacility,
)


@dataclass(frozen=True)
class ResponsePlan:
    """
    Combined response decision for a disaster zone.

    A response plan contains operational actions,
    resource allocations, routes for deploying
    allocated resources, and geographically mapped
    facilities relevant to the assessed zone.

    Facilities are descriptive geographic context only;
    they do not imply operational capacity or availability.
    """

    zone_id: str
    risk_level: str
    actions: Tuple[ResponseAction, ...]
    allocations: Tuple[ResourceAllocation, ...]
    deployments: Tuple[ResourceDeployment, ...] = ()
    facilities: Tuple[ResourceFacility, ...] = ()

    def __post_init__(self):
        if not self.zone_id:
            raise ValueError("zone_id cannot be empty")

        if not self.risk_level:
            raise ValueError("risk_level cannot be empty")
