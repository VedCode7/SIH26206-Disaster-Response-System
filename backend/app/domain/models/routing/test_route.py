from backend.app.domain.models.routing import RouteResult


def test_route_result_can_be_created():
    route = RouteResult(
        origin_zone_id="Z001",
        destination_zone_id="Z003",
        zone_path=("Z001", "Z002", "Z003"),
        road_path=("R001", "R002"),
        total_distance_km=7.0,
        total_travel_time_min=12.0,
    )

    assert route.origin_zone_id == "Z001"
    assert route.destination_zone_id == "Z003"
    assert route.zone_path == ("Z001", "Z002", "Z003")
    assert route.road_path == ("R001", "R002")
    assert route.total_distance_km == 7.0
    assert route.total_travel_time_min == 12.0