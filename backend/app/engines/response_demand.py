from backend.app.domain.models.resources import ResourceDemand
from backend.app.domain.models.risk import RiskAssessment
from backend.app.domain.models.zone import RiskLevel


def generate_resource_demands(
    assessment: RiskAssessment,
) -> list[ResourceDemand]:
    """
    Generate resource demands for a zone based on its
    current risk level.

    Higher-risk zones receive more urgent resource demands.
    """

    if assessment.risk_level == RiskLevel.CRITICAL:
        return [
            ResourceDemand(
                zone_id=assessment.zone_id,
                resource_type="ambulance",
                quantity=2,
                priority=1,
            ),
            ResourceDemand(
                zone_id=assessment.zone_id,
                resource_type="rescue_team",
                quantity=2,
                priority=1,
            ),
            ResourceDemand(
                zone_id=assessment.zone_id,
                resource_type="boat",
                quantity=1,
                priority=1,
            ),
        ]

    if assessment.risk_level == RiskLevel.HIGH:
        return [
            ResourceDemand(
                zone_id=assessment.zone_id,
                resource_type="ambulance",
                quantity=1,
                priority=2,
            ),
            ResourceDemand(
                zone_id=assessment.zone_id,
                resource_type="rescue_team",
                quantity=1,
                priority=2,
            ),
        ]

    if assessment.risk_level == RiskLevel.WATCH:
        return [
            ResourceDemand(
                zone_id=assessment.zone_id,
                resource_type="rescue_team",
                quantity=1,
                priority=3,
            )
        ]

    return []