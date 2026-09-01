from backend.app.domain.models import RiskLevel
from backend.app.domain.models.risk import RiskAssessment, RiskFactors


def test_risk_factors_accept_valid_values():
    factors = RiskFactors(
        water=80.0,
        rainfall=60.0,
        vulnerability=70.0,
        population=50.0,
        accessibility=90.0,
    )

    assert factors.water == 80.0
    assert factors.accessibility == 90.0


def test_risk_assessment_creation():
    factors = RiskFactors(
        water=90.0,
        rainfall=75.0,
        vulnerability=80.0,
        population=60.0,
        accessibility=85.0,
    )

    assessment = RiskAssessment(
        zone_id="Z001",
        risk_score=82.5,
        risk_level=RiskLevel.CRITICAL,
        factors=factors,
    )

    assert assessment.zone_id == "Z001"
    assert assessment.risk_score == 82.5
    assert assessment.risk_level == RiskLevel.CRITICAL


def test_risk_factors_reject_values_above_100():
    try:
        RiskFactors(
            water=101.0,
            rainfall=50.0,
            vulnerability=50.0,
            population=50.0,
            accessibility=50.0,
        )
        assert False, "Expected validation error"
    except ValueError:
        assert True