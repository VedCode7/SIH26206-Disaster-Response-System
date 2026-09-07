from backend.app.domain.models import RiskLevel, Zone
from backend.app.domain.models.risk import RiskAssessment, RiskFactors


def _normalize_water_depth(water_depth_m: float) -> float:
    """
    Convert water depth from 0-2+ metres to a 0-100 risk score.
    """
    return min(max(water_depth_m / 2.0 * 100.0, 0.0), 100.0)


def _normalize_rainfall(rainfall_mm_per_hr: float) -> float:
    """
    Convert rainfall intensity from 0-150+ mm/hr to a 0-100 risk score.
    """
    return min(max(rainfall_mm_per_hr / 150.0 * 100.0, 0.0), 100.0)


def _normalize_vulnerability(
    population: int,
    vulnerable_population: int,
) -> float:
    """
    Calculate the percentage of the population considered vulnerable.
    """
    if population <= 0:
        return 0.0

    return min(
        max(vulnerable_population / population * 100.0, 0.0),
        100.0,
    )


def _normalize_population(population: int) -> float:
    """
    Convert population exposure using 5,000 people as
    the v1 operational reference point.
    """
    return min(max(population / 5000.0 * 100.0, 0.0), 100.0)


def _normalize_accessibility(accessibility_percent: float) -> float:
    """
    Convert remaining accessibility into accessibility risk.
    """
    return min(
        max(100.0 - accessibility_percent, 0.0),
        100.0,
    )


def _classify_risk(score: float) -> RiskLevel:
    """
    Convert a 0-100 risk score into an operational risk level.
    """
    if score < 25:
        return RiskLevel.NORMAL

    if score < 50:
        return RiskLevel.WATCH

    if score < 75:
        return RiskLevel.HIGH

    return RiskLevel.CRITICAL


def calculate_risk(zone: Zone) -> RiskAssessment:
    """
    Calculate the operational flood risk for a zone.

    The engine is deterministic and does not modify the input Zone.
    """

    water_score = _normalize_water_depth(zone.water_depth_m)

    rainfall_score = _normalize_rainfall(
        zone.rainfall_mm_per_hr
    )

    vulnerability_score = _normalize_vulnerability(
        zone.population,
        zone.vulnerable_population,
    )

    population_score = _normalize_population(
        zone.population
    )

    accessibility_score = _normalize_accessibility(
        zone.accessibility_percent
    )

    risk_score = (
        water_score * 0.35
        + rainfall_score * 0.20
        + vulnerability_score * 0.20
        + population_score * 0.10
        + accessibility_score * 0.15
    )

    risk_score = min(max(risk_score, 0.0), 100.0)

    risk_level = _classify_risk(risk_score)

    factors = RiskFactors(
        water=water_score,
        rainfall=rainfall_score,
        vulnerability=vulnerability_score,
        population=population_score,
        accessibility_risk=accessibility_score,
    )

    return RiskAssessment(
        zone_id=zone.id,
        risk_score=round(risk_score, 2),
        risk_level=risk_level,
        factors=factors,
    )