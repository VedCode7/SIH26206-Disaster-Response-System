from enum import Enum

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    NORMAL = "normal"
    WATCH = "watch"
    HIGH = "high"
    CRITICAL = "critical"


class Zone(BaseModel):
    id: str = Field(..., description="Unique identifier for the zone.")
    name: str = Field(..., description="Human-readable zone name.")

    lat: float | None = Field(
        default=None,
        description="Latitude of the zone centroid.",
    )

    lng: float | None = Field(
        default=None,
        description="Longitude of the zone centroid.",
    )

    geometry: dict | None = Field(
        default=None,
        description="GeoJSON geometry representing the zone boundary.",
    )

    population: int = Field(
        ...,
        ge=0,
        description="Total population within the zone.",
    )

    vulnerable_population: int = Field(
        ...,
        ge=0,
        description="Population requiring additional assistance.",
    )

    water_depth_m: float = Field(
        default=0.0,
        ge=0,
        description="Current estimated flood-water depth in metres.",
    )

    rainfall_mm_per_hr: float = Field(
        default=0.0,
        ge=0,
        description="Current rainfall intensity.",
    )

    accessibility_percent: float = Field(
        default=100.0,
        ge=0,
        le=100,
        description="Percentage of normal access currently available.",
    )

    risk_score: float = Field(
        default=0.0,
        ge=0,
        le=100,
        description="Current calculated risk score.",
    )

    risk_level: RiskLevel = Field(
        default=RiskLevel.NORMAL,
        description="Current operational risk classification.",
    )