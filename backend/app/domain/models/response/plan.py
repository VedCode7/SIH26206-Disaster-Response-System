from dataclasses import dataclass
from typing import Tuple

from backend.app.domain.models.response.action import ResponseAction
from backend.app.domain.models.response.deployment import (
    ResourceDeployment,
)
from backend.app.domain.models.resources.allocation import (
    ResourceAllocation,
)
from backend.app.domain.models.resources.demand import ResourceDemand
from backend.app.domain.models.resources.facility_accessibility import (
    FacilityAccessibility,
)
from backend.app.domain.models.resources.resource import Resource
from backend.app.domain.models.resources.resource_facility import (
    ResourceFacility,
)


@dataclass(frozen=True)
class ResponsePlan:
    """
    Combined response decision for a disaster zone.

    A response plan contains the operational demand, verified live resource
    inventory, resulting allocations, routes for deploying allocated
    resources, geographically mapped facilities relevant to the assessed
    zone, and routing-aware facility recommendations.

    Facilities are descriptive geographic context only; they do not imply
    operational capacity or availability.
    """

    zone_id: str
    risk_level: str
    actions: Tuple[ResponseAction, ...]
    allocations: Tuple[ResourceAllocation, ...]
    demands: Tuple[ResourceDemand, ...] = ()
    resource_inventory: Tuple[Resource, ...] = ()
    deployments: Tuple[ResourceDeployment, ...] = ()
    facilities: Tuple[ResourceFacility, ...] = ()
    facility_recommendations: Tuple[FacilityAccessibility, ...] = ()

    def __post_init__(self):
        if not self.zone_id:
            raise ValueError("zone_id cannot be empty")

        if not self.risk_level:
            raise ValueError("risk_level cannot be empty")
