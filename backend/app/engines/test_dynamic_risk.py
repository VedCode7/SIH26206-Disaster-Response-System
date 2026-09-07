from backend.app.engines.risk_analysis import analyze_world_risk
from backend.app.state.initial_state import create_demo_world_state
from backend.app.state.world_state_store import WorldStateStore


def test_risk_changes_after_water_level_update():
    world_state = create_demo_world_state()

    store = WorldStateStore(world_state)

    before = analyze_world_risk(
        store.get_state()
    )

    before_assessment = next(
        assessment
        for assessment in before.assessments
        if assessment.zone_id == "Z001"
    )

    store.update_zone_conditions(
        "Z001",
        water_depth_m=2.0,
    )

    after = analyze_world_risk(
        store.get_state()
    )

    after_assessment = next(
        assessment
        for assessment in after.assessments
        if assessment.zone_id == "Z001"
    )

    assert (
        after_assessment.factors.water
        > before_assessment.factors.water
    )

    assert (
        after_assessment.risk_score
        > before_assessment.risk_score
    )


def test_risk_changes_after_accessibility_decreases():
    world_state = create_demo_world_state()

    store = WorldStateStore(world_state)

    before = analyze_world_risk(
        store.get_state()
    )

    before_assessment = next(
        assessment
        for assessment in before.assessments
        if assessment.zone_id == "Z001"
    )

    store.update_zone_conditions(
        "Z001",
        accessibility_percent=20.0,
    )

    after = analyze_world_risk(
        store.get_state()
    )

    after_assessment = next(
        assessment
        for assessment in after.assessments
        if assessment.zone_id == "Z001"
    )

    assert (
        after_assessment.factors.accessibility_risk
        > before_assessment.factors.accessibility_risk
    )

    assert (
        after_assessment.risk_score
        > before_assessment.risk_score
    )


def test_risk_changes_after_rainfall_increases():
    world_state = create_demo_world_state()

    store = WorldStateStore(world_state)

    before = analyze_world_risk(
        store.get_state()
    )

    before_assessment = next(
        assessment
        for assessment in before.assessments
        if assessment.zone_id == "Z001"
    )

    store.update_zone_conditions(
        "Z001",
        rainfall_mm_per_hr=150.0,
    )

    after = analyze_world_risk(
        store.get_state()
    )

    after_assessment = next(
        assessment
        for assessment in after.assessments
        if assessment.zone_id == "Z001"
    )

    assert (
        after_assessment.factors.rainfall
        > before_assessment.factors.rainfall
    )

    assert (
        after_assessment.risk_score
        > before_assessment.risk_score
    )