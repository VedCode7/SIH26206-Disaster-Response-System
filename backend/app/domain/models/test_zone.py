from backend.app.domain.models import RiskLevel, Zone


def test_zone_creation():
    zone = Zone(
        id="Z001",
        name="Test Zone",
        population=2500,
        vulnerable_population=400,
        water_depth_m=1.2,
        rainfall_mm_per_hr=85.0,
        accessibility_percent=60.0,
        risk_score=78.0,
        risk_level=RiskLevel.HIGH,
    )

    assert zone.id == "Z001"
    assert zone.population == 2500
    assert zone.risk_score == 78.0
    assert zone.risk_level == RiskLevel.HIGH


def test_zone_defaults():
    zone = Zone(
        id="Z002",
        name="Safe Zone",
        population=1000,
        vulnerable_population=100,
    )

    assert zone.water_depth_m == 0.0
    assert zone.rainfall_mm_per_hr == 0.0
    assert zone.accessibility_percent == 100.0
    assert zone.risk_score == 0.0
    assert zone.risk_level == RiskLevel.NORMAL