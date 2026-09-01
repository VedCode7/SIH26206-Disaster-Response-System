from backend.app.domain.models import RiskLevel, Zone
from backend.app.domain.world_state import WorldState


def test_world_state_creation():
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

    world_state = WorldState(
        disaster_active=True,
        zones=[zone],
    )

    assert world_state.disaster_active is True
    assert len(world_state.zones) == 1
    assert world_state.zones[0].id == "Z001"


def test_get_zone():
    zone = Zone(
        id="Z002",
        name="Second Zone",
        population=1000,
        vulnerable_population=100,
    )

    world_state = WorldState(
        zones=[zone],
    )

    found_zone = world_state.get_zone("Z002")

    assert found_zone is not None
    assert found_zone.id == "Z002"


def test_get_missing_zone():
    world_state = WorldState()

    found_zone = world_state.get_zone("DOES_NOT_EXIST")

    assert found_zone is None