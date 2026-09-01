from pydantic import BaseModel, Field

from backend.app.domain.models import RiskLevel
from backend.app.domain.models.risk import RiskAssessment


class RiskOverview(BaseModel):
    """
    Aggregated risk picture across all monitored zones.
    """

    total_zones: int = Field(
        ...,
        ge=0,
        description="Total number of zones assessed.",
    )

    normal_count: int = Field(
        ...,
        ge=0,
        description="Number of zones classified as normal.",
    )

    watch_count: int = Field(
        ...,
        ge=0,
        description="Number of zones classified as watch.",
    )

    high_count: int = Field(
        ...,
        ge=0,
        description="Number of zones classified as high risk.",
    )

    critical_count: int = Field(
        ...,
        ge=0,
        description="Number of zones classified as critical.",
    )

    assessments: list[RiskAssessment] = Field(
        default_factory=list,
        description="Risk assessment for every monitored zone.",
    )

    highest_risk_zone_id: str | None = Field(
        default=None,
        description="ID of the zone with the highest risk.",
    )

    highest_risk_score: float | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Highest risk score among all zones.",
    )