import pytest

from backend.app.domain.models.routing import Road
from backend.app.state.road_network_store import (
    RoadNetworkStore,
)


def make_roads():
    return [
        Road(
            id="R001",
            from_zone_id="Z001",
            to_zone_id="Z002",
            distance_km=5.0,
            travel_time_min=10.0,
        ),
        Road(
            id="R002",
            from_zone_id="Z002",
            to_zone_id="Z003",
            distance_km=4.0,
            travel_time_min=8.0,
        ),
    ]


def test_store_returns_initial_roads():
    store = RoadNetworkStore(make_roads())

    roads = store.get_roads()

    assert len(roads) == 2
    assert roads[0].id == "R001"
    assert roads[1].id == "R002"


def test_get_road_returns_matching_road():
    store = RoadNetworkStore(make_roads())

    road = store.get_road("R001")

    assert road is not None
    assert road.id == "R001"


def test_get_unknown_road_returns_none():
    store = RoadNetworkStore(make_roads())

    assert store.get_road("UNKNOWN") is None


def test_update_accessibility():
    store = RoadNetworkStore(make_roads())

    updated = store.update_road(
        "R001",
        accessibility_percent=40.0,
    )

    assert updated.accessibility_percent == 40.0
    assert updated.blocked is False
    assert updated.distance_km == 5.0
    assert updated.travel_time_min == 10.0


def test_update_blocked_status():
    store = RoadNetworkStore(make_roads())

    updated = store.update_road(
        "R001",
        blocked=True,
    )

    assert updated.blocked is True
    assert updated.accessibility_percent == 100.0


def test_update_keeps_unspecified_values():
    store = RoadNetworkStore(
        [
            Road(
                id="R001",
                from_zone_id="Z001",
                to_zone_id="Z002",
                distance_km=5.0,
                travel_time_min=10.0,
                accessibility_percent=40.0,
                blocked=True,
            )
        ]
    )

    updated = store.update_road(
        "R001",
        accessibility_percent=60.0,
    )

    assert updated.accessibility_percent == 60.0
    assert updated.blocked is True


def test_update_unknown_road_raises_error():
    store = RoadNetworkStore(make_roads())

    with pytest.raises(
        ValueError,
        match="Road 'UNKNOWN' not found",
    ):
        store.update_road(
            "UNKNOWN",
            blocked=True,
        )


def test_replace_roads():
    store = RoadNetworkStore(make_roads())

    replacement = [
        Road(
            id="R100",
            from_zone_id="Z010",
            to_zone_id="Z011",
            distance_km=2.0,
            travel_time_min=3.0,
        )
    ]

    store.replace_roads(replacement)

    roads = store.get_roads()

    assert len(roads) == 1
    assert roads[0].id == "R100"