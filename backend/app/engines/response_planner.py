from backend.app.domain.models.response import ResponseAction
from backend.app.domain.models.zone import RiskLevel


def generate_response_actions(
    zone_id: str,
    risk_level: RiskLevel,
) -> list[ResponseAction]:
    """
    Generate operational response actions for a zone
    based on its current risk level.

    Priority 1 is the most urgent.
    """

    if risk_level == RiskLevel.CRITICAL:
        return [
            ResponseAction(
                zone_id=zone_id,
                risk_level=risk_level.value,
                action_type="evacuate",
                priority=1,
                description=(
                    f"Initiate immediate evacuation of {zone_id}"
                ),
            ),
            ResponseAction(
                zone_id=zone_id,
                risk_level=risk_level.value,
                action_type="deploy_rescue",
                priority=1,
                description=(
                    f"Deploy emergency rescue resources to {zone_id}"
                ),
            ),
        ]

    if risk_level == RiskLevel.HIGH:
        return [
            ResponseAction(
                zone_id=zone_id,
                risk_level=risk_level.value,
                action_type="prepare_evacuation",
                priority=2,
                description=(
                    f"Prepare evacuation for {zone_id}"
                ),
            ),
            ResponseAction(
                zone_id=zone_id,
                risk_level=risk_level.value,
                action_type="deploy_rescue",
                priority=2,
                description=(
                    f"Deploy rescue resources to {zone_id}"
                ),
            ),
        ]

    if risk_level == RiskLevel.WATCH:
        return [
            ResponseAction(
                zone_id=zone_id,
                risk_level=risk_level.value,
                action_type="monitor",
                priority=3,
                description=(
                    f"Closely monitor conditions in {zone_id}"
                ),
            )
        ]

    return [
        ResponseAction(
            zone_id=zone_id,
            risk_level=risk_level.value,
            action_type="monitor",
            priority=4,
            description=(
                f"Continue routine monitoring of {zone_id}"
            ),
        )
    ]