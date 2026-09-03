from backend.app.domain.models.resources import ResourceAllocation
from backend.app.domain.models.routing import Road
from backend.app.engines.deployment_engine import (
    create_deployments,
)
from backend.app.engines.routing_graph import RoutingGraph


def make_allocation(
    source_zone_id: str = "Z002",
    destination_zone_id: str = "Z001",
) -> ResourceAllocation:
    return ResourceAllocation(
        resource_id="AMBULANCE-ALLOC-001",
        resource_type="ambulance",
        source_zone_id=source_zone_id,
        destination_zone_id=destination_zone_id,
        quantity=1,
        priority=2,
    )


def make_graph() -> RoutingGraph:
    roads = [
        Road(
            id="R001",
            from_zone_id="Z002",
            to_zone_id="Z001",
            distance_km=5.0,
            travel_time_min=10.0,
        )
    ]

    return RoutingGraph(roads)


def test_create_deployment_for_reachable_allocation():
    allocation = make_allocation()
    graph = make_graph()

    deployments = create_deployments(
        allocations=[allocation],
        graph=graph,
    )

    assert len(deployments) == 1

    deployment = deployments[0]

    assert deployment.allocation == allocation
    assert deployment.route.origin_zone_id == "Z002"
    assert deployment.route.destination_zone_id == "Z001"
    assert deployment.route.zone_path == (
        "Z002",
        "Z001",
    )
    assert deployment.route.road_path == ("R001",)


def test_skip_allocation_when_destination_is_unreachable():
    allocation = make_allocation(
        source_zone_id="Z002",
        destination_zone_id="Z003",
    )

    graph = make_graph()

    deployments = create_deployments(
        allocations=[allocation],
        graph=graph,
    )

    assert deployments == []


def test_create_multiple_deployments():
    allocations = [
        make_allocation(
            source_zone_id="Z002",
            destination_zone_id="Z001",
        ),
        ResourceAllocation(
            resource_id="RESCUE-ALLOC-002",
            resource_type="rescue_team",
            source_zone_id="Z002",
            destination_zone_id="Z001",
            quantity=1,
            priority=2,
        ),
    ]

    graph = make_graph()

    deployments = create_deployments(
        allocations=allocations,
        graph=graph,
    )

    assert len(deployments) == 2

    assert (
        deployments[0].allocation.resource_type
        == "ambulance"
    )

    assert (
        deployments[1].allocation.resource_type
        == "rescue_team"
    )


def test_empty_allocations_produce_no_deployments():
    graph = make_graph()

    deployments = create_deployments(
        allocations=[],
        graph=graph,
    )

    assert deployments == []

def test_deployment_uses_route_avoiding_degraded_road():
    allocation = make_allocation()

    graph = RoutingGraph(
        [
            Road(
                id="R001",
                from_zone_id="Z002",
                to_zone_id="Z001",
                distance_km=3.0,
                travel_time_min=5.0,
                accessibility_percent=20.0,
            ),
            Road(
                id="R002",
                from_zone_id="Z002",
                to_zone_id="Z003",
                distance_km=4.0,
                travel_time_min=6.0,
                accessibility_percent=100.0,
            ),
            Road(
                id="R003",
                from_zone_id="Z003",
                to_zone_id="Z001",
                distance_km=4.0,
                travel_time_min=6.0,
                accessibility_percent=100.0,
            ),
        ]
    )

    deployments = create_deployments(
        allocations=[allocation],
        graph=graph,
    )

    assert len(deployments) == 1

    deployment = deployments[0]

    assert deployment.route.zone_path == (
        "Z002",
        "Z003",
        "Z001",
    )

    assert deployment.route.road_path == (
        "R002",
        "R003",
    )