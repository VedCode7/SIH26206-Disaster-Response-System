from pydantic import BaseModel, Field

from backend.app.domain.models.zone import RiskLevel


class RiskFactors(BaseModel):
    """
    Normalized 0-100 contribution scores for each risk factor.
    """

    water: float = Field(..., ge=0, le=100)
    rainfall: float = Field(..., ge=0, le=100)
    vulnerability: float = Field(..., ge=0, le=100)
    population: float = Field(..., ge=0, le=100)
    accessibility: float = Field(..., ge=0, le=100)


class RiskAssessment(BaseModel):
    """
    Result produced by the Risk Engine for a single zone.
    """

    zone_id: str = Field(
        ...,
        description="ID of the assessed zone.",
    )

    risk_score: float = Field(
        ...,
        ge=0,
        le=100,
        description="Overall operational risk score.",
    )

    risk_level: RiskLevel = Field(
        ...,
        description="Classification derived from the risk score.",
    )

    factors: RiskFactors = Field(
        ...,
        description="Normalized scores contributing to the final risk.",
    )