import pytest

from backend.app.domain.models.response import ResponseAction


def test_response_action_can_be_created():
    action = ResponseAction(
        zone_id="Z001",
        risk_level="critical",
        action_type="evacuate",
        priority=1,
        description="Evacuate residents from Z001",
    )

    assert action.zone_id == "Z001"
    assert action.risk_level == "critical"
    assert action.action_type == "evacuate"
    assert action.priority == 1
    assert action.description == "Evacuate residents from Z001"


def test_empty_zone_id_is_rejected():
    with pytest.raises(ValueError):
        ResponseAction(
            zone_id="",
            risk_level="critical",
            action_type="evacuate",
            priority=1,
            description="Evacuate residents",
        )


def test_invalid_priority_is_rejected():
    with pytest.raises(ValueError):
        ResponseAction(
            zone_id="Z001",
            risk_level="critical",
            action_type="evacuate",
            priority=0,
            description="Evacuate residents",
        )


def test_empty_description_is_rejected():
    with pytest.raises(ValueError):
        ResponseAction(
            zone_id="Z001",
            risk_level="critical",
            action_type="evacuate",
            priority=1,
            description="",
        )