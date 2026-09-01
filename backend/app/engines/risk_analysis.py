from backend.app.domain.models import RiskLevel
from backend.app.domain.models.risk import RiskAssessment, RiskOverview
from backend.app.domain.world_state import WorldState

from backend.app.engines.risk_engine import calculate_risk


def analyze_world_risk(world_state: WorldState) -> RiskOverview:
    """
    Calculate risk assessments for every zone in the current world state
    and produce an aggregated operational risk overview.
    """

    assessments: list[RiskAssessment] = []

    normal_count = 0
    watch_count = 0
    high_count = 0
    critical_count = 0

    for zone in world_state.zones:
        assessment = calculate_risk(zone)

        assessments.append(assessment)

        if assessment.risk_level == RiskLevel.NORMAL:
            normal_count += 1

        elif assessment.risk_level == RiskLevel.WATCH:
            watch_count += 1

        elif assessment.risk_level == RiskLevel.HIGH:
            high_count += 1

        elif assessment.risk_level == RiskLevel.CRITICAL:
            critical_count += 1

    if assessments:
        highest_risk = max(
            assessments,
            key=lambda assessment: assessment.risk_score,
        )

        highest_risk_zone_id = highest_risk.zone_id
        highest_risk_score = highest_risk.risk_score

    else:
        highest_risk_zone_id = None
        highest_risk_score = None

    return RiskOverview(
        total_zones=len(world_state.zones),
        normal_count=normal_count,
        watch_count=watch_count,
        high_count=high_count,
        critical_count=critical_count,
        assessments=assessments,
        highest_risk_zone_id=highest_risk_zone_id,
        highest_risk_score=highest_risk_score,
    )