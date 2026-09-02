from dataclasses import dataclass
from typing import Tuple

from backend.app.domain.models.response.action import ResponseAction
from backend.app.domain.models.response.deployment import (
    ResourceDeployment,
)
from backend.app.domain.models.resources.allocation import (
    ResourceAllocation,
)


@dataclass(frozen=True)
class ResponsePlan:
    """
    Combined response decision for a disaster zone.

    A response plan contains operational actions,
    resource allocations, and routes for deploying
    those allocated resources.
    """

    zone_id: str
    risk_level: str
    actions: Tuple[ResponseAction, ...]
    allocations: Tuple[ResourceAllocation, ...]
    deployments: Tuple[ResourceDeployment, ...] = ()

    def __post_init__(self):
        if not self.zone_id:
            raise ValueError("zone_id cannot be empty")

        if not self.risk_level:
            raise ValueError("risk_level cannot be empty")