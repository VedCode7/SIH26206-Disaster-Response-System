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

    The risk level is normalized through ``.value`` when the assessment
    contains a RiskLevel enum. This keeps demand generation robust when the
    assessment has crossed a serialization/deserialization boundary and the
    value is represented as the equivalent string.
    """

    risk_level = assessment.risk_level
    if isinstance(risk_level, RiskLevel):
        risk_level = risk_level.value
    else:
        risk_level = str(risk_level).lower()

    if risk_level == RiskLevel.CRITICAL.value:
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

    if risk_level == RiskLevel.HIGH.value:
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

    if risk_level == RiskLevel.WATCH.value:
        return [
            ResourceDemand(
                zone_id=assessment.zone_id,
                resource_type="rescue_team",
                quantity=1,
                priority=3,
            )
        ]

    return []
