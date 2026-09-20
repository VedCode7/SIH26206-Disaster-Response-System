from backend.app.domain.models.resources import ResourceFacility
from backend.app.domain.models.routing import Road
from backend.app.engines.facility_accessibility import (
    rank_facility_accessibility,
)
from backend.app.engines.routing_graph import RoutingGraph


def _facility(
    facility_id: str,
    zone_id: str,
    resource_type: str = "hospital",
) -> ResourceFacility:
    return ResourceFacility(
        id=facility_id,
        resource_type=resource_type,
        current_zone_id=zone_id,
        name=facility_id,
        latitude=13.0,
        longitude=80.0,
        source="OpenStreetMap",
    )


def _graph() -> RoutingGraph:
    return RoutingGraph(
        [
            Road(
                id="R1",
                from_zone_id="W1",
                to_zone_id="W2",
                distance_km=2.0,
                travel_time_min=4.0,
                accessibility_percent=100.0,
                blocked=False,
            ),
            Road(
                id="R2",
                from_zone_id="W1",
                to_zone_id="W3",
                distance_km=1.0,
                travel_time_min=2.0,
                accessibility_percent=100.0,
                blocked=False,
            ),
        ]
    )


def test_ranks_accessible_facilities_by_route_time():
    facilities = [
        _facility("F2", "W2"),
        _facility("F3", "W3"),
    ]

    results = rank_facility_accessibility(
        origin_zone_id="W1",
        facilities=facilities,
        routing_graph=_graph(),
    )

    assert [result.facility_id for result in results] == ["F3", "F2"]
    assert results[0].accessible is True
    assert results[0].total_travel_time_min == 2.0


def test_facility_type_filter_is_applied():
    facilities = [
        _facility("H1", "W2", "hospital"),
        _facility("P1", "W3", "police_station"),
    ]

    results = rank_facility_accessibility(
        origin_zone_id="W1",
        facilities=facilities,
        routing_graph=_graph(),
        facility_type="police_station",
    )

    assert [result.facility_id for result in results] == ["P1"]


def test_blocked_route_is_reported_as_inaccessible():
    graph = RoutingGraph(
        [
            Road(
                id="R1",
                from_zone_id="W1",
                to_zone_id="W2",
                distance_km=2.0,
                travel_time_min=4.0,
                accessibility_percent=0.0,
                blocked=True,
            )
        ]
    )

    results = rank_facility_accessibility(
        origin_zone_id="W1",
        facilities=[_facility("F2", "W2")],
        routing_graph=graph,
    )

    assert len(results) == 1
    assert results[0].accessible is False
    assert results[0].total_travel_time_min is None
