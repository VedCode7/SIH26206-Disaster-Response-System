import pytest

from backend.app.domain.models.routing import Road


def test_road_can_be_created():
    road = Road(
        id="R001",
        from_zone_id="Z001",
        to_zone_id="Z002",
        distance_km=4.2,
        travel_time_min=8.0,
    )

    assert road.id == "R001"
    assert road.from_zone_id == "Z001"
    assert road.to_zone_id == "Z002"
    assert road.distance_km == 4.2
    assert road.travel_time_min == 8.0
    assert road.accessibility_percent == 100.0
    assert road.blocked is False


def test_blocked_road_can_be_represented():
    road = Road(
        id="R002",
        from_zone_id="Z002",
        to_zone_id="Z003",
        distance_km=3.1,
        travel_time_min=6.0,
        accessibility_percent=20.0,
        blocked=True,
    )

    assert road.blocked is True
    assert road.accessibility_percent == 20.0


def test_negative_distance_is_rejected():
    with pytest.raises(ValueError):
        Road(
            id="R003",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=-1.0,
            travel_time_min=5.0,
        )


def test_invalid_accessibility_is_rejected():
    with pytest.raises(ValueError):
        Road(
            id="R004",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=2.0,
            travel_time_min=5.0,
            accessibility_percent=120.0,
        )


def test_road_cannot_connect_zone_to_itself():
    with pytest.raises(ValueError):
        Road(
            id="R005",
            from_zone_id="Z001",
            to_zone_id="Z001",
            distance_km=2.0,
            travel_time_min=5.0,
        )