from backend.app.domain.models.zone import RiskLevel
from backend.app.engines.response_planner import (
    generate_response_actions,
)


def test_critical_zone_generates_immediate_response():
    actions = generate_response_actions(
        "Z001",
        RiskLevel.CRITICAL,
    )

    assert len(actions) == 2

    assert actions[0].action_type == "evacuate"
    assert actions[0].priority == 1

    assert actions[1].action_type == "deploy_rescue"
    assert actions[1].priority == 1


def test_high_risk_zone_generates_preparation_actions():
    actions = generate_response_actions(
        "Z002",
        RiskLevel.HIGH,
    )

    assert len(actions) == 2

    assert actions[0].action_type == "prepare_evacuation"
    assert actions[0].priority == 2

    assert actions[1].action_type == "deploy_rescue"
    assert actions[1].priority == 2


def test_watch_zone_generates_monitoring_action():
    actions = generate_response_actions(
        "Z003",
        RiskLevel.WATCH,
    )

    assert len(actions) == 1

    assert actions[0].action_type == "monitor"
    assert actions[0].priority == 3


def test_normal_zone_generates_routine_monitoring():
    actions = generate_response_actions(
        "Z004",
        RiskLevel.NORMAL,
    )

    assert len(actions) == 1

    assert actions[0].action_type == "monitor"
    assert actions[0].priority == 4