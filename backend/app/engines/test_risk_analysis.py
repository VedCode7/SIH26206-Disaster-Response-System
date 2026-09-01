from backend.app.domain.models import RiskLevel, Zone
from backend.app.domain.models.risk import RiskOverview
from backend.app.domain.world_state import WorldState
from backend.app.engines.risk_analysis import analyze_world_risk


def test_analyze_world_risk_counts_levels():
    zones = [
        Zone(
            id="Z_NORMAL",
            name="Normal Zone",
            population=500,
            vulnerable_population=25,
            water_depth_m=0.0,
            rainfall_mm_per_hr=5.0,
            accessibility_percent=100.0,
        ),
        Zone(
            id="Z_HIGH",
            name="High Zone",
            population=3000,
            vulnerable_population=900,
            water_depth_m=1.2,
            rainfall_mm_per_hr=100.0,
            accessibility_percent=50.0,
        ),
        Zone(
            id="Z_CRITICAL",
            name="Critical Zone",
            population=5000,
            vulnerable_population=2000,
            water_depth_m=2.5,
            rainfall_mm_per_hr=150.0,
            accessibility_percent=15.0,
        ),
    ]

    world_state = WorldState(
        disaster_active=True,
        zones=zones,
    )

    overview = analyze_world_risk(world_state)

    assert isinstance(overview, RiskOverview)
    assert overview.total_zones == 3
    assert overview.normal_count == 1
    assert overview.critical_count == 1
    assert overview.highest_risk_zone_id == "Z_CRITICAL"


def test_analyze_empty_world():
    world_state = WorldState(
        disaster_active=False,
        zones=[],
    )

    overview = analyze_world_risk(world_state)

    assert overview.total_zones == 0
    assert overview.normal_count == 0
    assert overview.watch_count == 0
    assert overview.high_count == 0
    assert overview.critical_count == 0
    assert overview.assessments == []
    assert overview.highest_risk_zone_id is None
    assert overview.highest_risk_score is None


def test_assessments_are_returned_for_all_zones():
    zones = [
        Zone(
            id="Z001",
            name="Zone 1",
            population=1000,
            vulnerable_population=100,
        ),
        Zone(
            id="Z002",
            name="Zone 2",
            population=2000,
            vulnerable_population=300,
        ),
    ]

    world_state = WorldState(zones=zones)

    overview = analyze_world_risk(world_state)

    assert len(overview.assessments) == 2
    assert overview.assessments[0].zone_id == "Z001"
    assert overview.assessments[1].zone_id == "Z002"