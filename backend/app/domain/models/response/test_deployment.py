import pytest

from backend.app.domain.models.resources import ResourceAllocation
from backend.app.domain.models.response import ResourceDeployment
from backend.app.domain.models.routing import RouteResult


def make_allocation():
    return ResourceAllocation(
        resource_id="AMBULANCE-ALLOC-001",
        resource_type="ambulance",
        source_zone_id="Z002",
        destination_zone_id="Z001",
        quantity=1,
        priority=2,
    )


def make_route():
    return RouteResult(
        origin_zone_id="Z002",
        destination_zone_id="Z001",
        zone_path=("Z002", "Z001"),
        road_path=("R001",),
        total_distance_km=5.0,
        total_travel_time_min=10.0,
    )


def test_resource_deployment_combines_allocation_and_route():
    allocation = make_allocation()
    route = make_route()

    deployment = ResourceDeployment(
        allocation=allocation,
        route=route,
    )

    assert deployment.allocation == allocation
    assert deployment.route == route


def test_deployment_requires_matching_source_zone():
    allocation = make_allocation()

    route = RouteResult(
        origin_zone_id="Z003",
        destination_zone_id="Z001",
        zone_path=("Z003", "Z001"),
        road_path=("R001",),
        total_distance_km=5.0,
        total_travel_time_min=10.0,
    )

    with pytest.raises(
        ValueError,
        match="source zone",
    ):
        ResourceDeployment(
            allocation=allocation,
            route=route,
        )


def test_deployment_requires_matching_destination_zone():
    allocation = make_allocation()

    route = RouteResult(
        origin_zone_id="Z002",
        destination_zone_id="Z004",
        zone_path=("Z002", "Z004"),
        road_path=("R002",),
        total_distance_km=7.0,
        total_travel_time_min=15.0,
    )

    with pytest.raises(
        ValueError,
        match="destination zone",
    ):
        ResourceDeployment(
            allocation=allocation,
            route=route,
        )