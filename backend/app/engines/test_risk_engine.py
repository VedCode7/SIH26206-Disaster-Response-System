from backend.app.domain.models import RiskLevel, Zone
from backend.app.engines.risk_engine import calculate_risk


def test_safe_zone_has_low_risk():
    zone = Zone(
        id="Z_SAFE",
        name="Safe Zone",
        population=1000,
        vulnerable_population=50,
        water_depth_m=0.0,
        rainfall_mm_per_hr=5.0,
        accessibility_percent=100.0,
    )

    assessment = calculate_risk(zone)

    assert assessment.zone_id == "Z_SAFE"
    assert 0 <= assessment.risk_score <= 100
    assert assessment.risk_level == RiskLevel.NORMAL


def test_severe_flood_has_critical_risk():
    zone = Zone(
        id="Z_CRITICAL",
        name="Critical Zone",
        population=5000,
        vulnerable_population=2000,
        water_depth_m=2.5,
        rainfall_mm_per_hr=150.0,
        accessibility_percent=15.0,
    )

    assessment = calculate_risk(zone)

    assert assessment.zone_id == "Z_CRITICAL"
    assert assessment.risk_score >= 75
    assert assessment.risk_level == RiskLevel.CRITICAL


def test_higher_water_increases_risk():
    low_water_zone = Zone(
        id="Z_LOW",
        name="Low Water",
        population=2000,
        vulnerable_population=200,
        water_depth_m=0.3,
        rainfall_mm_per_hr=50.0,
        accessibility_percent=90.0,
    )

    high_water_zone = Zone(
        id="Z_HIGH",
        name="High Water",
        population=2000,
        vulnerable_population=200,
        water_depth_m=1.5,
        rainfall_mm_per_hr=50.0,
        accessibility_percent=90.0,
    )

    low_assessment = calculate_risk(low_water_zone)
    high_assessment = calculate_risk(high_water_zone)

    assert high_assessment.risk_score > low_assessment.risk_score