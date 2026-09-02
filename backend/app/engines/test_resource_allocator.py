from backend.app.domain.models.resources import (
    Resource,
    ResourceDemand,
)
from backend.app.engines.resource_allocator import (
    allocate_resources,
)


def test_allocates_matching_resource():
    resources = [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z002",
            quantity=2,
        )
    ]

    demands = [
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=1,
            priority=1,
        )
    ]

    allocations = allocate_resources(
        resources,
        demands,
    )

    assert len(allocations) == 1

    allocation = allocations[0]

    assert allocation.resource_type == "ambulance"
    assert allocation.source_zone_id == "Z002"
    assert allocation.destination_zone_id == "Z001"
    assert allocation.quantity == 1
    assert allocation.priority == 1


def test_does_not_allocate_more_than_available():
    resources = [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z002",
            quantity=2,
        )
    ]

    demands = [
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=5,
            priority=1,
        )
    ]

    allocations = allocate_resources(
        resources,
        demands,
    )

    assert len(allocations) == 1
    assert allocations[0].quantity == 2


def test_higher_priority_demand_is_served_first():
    resources = [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z003",
            quantity=2,
        )
    ]

    demands = [
        ResourceDemand(
            zone_id="Z002",
            resource_type="ambulance",
            quantity=2,
            priority=2,
        ),
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=2,
            priority=1,
        ),
    ]

    allocations = allocate_resources(
        resources,
        demands,
    )

    assert len(allocations) == 1
    assert allocations[0].destination_zone_id == "Z001"
    assert allocations[0].quantity == 2
    assert allocations[0].priority == 1


def test_does_not_allocate_wrong_resource_type():
    resources = [
        Resource(
            id="BOAT001",
            resource_type="boat",
            current_zone_id="Z002",
            quantity=2,
        )
    ]

    demands = [
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=1,
            priority=1,
        )
    ]

    allocations = allocate_resources(
        resources,
        demands,
    )

    assert allocations == []


def test_returns_empty_list_when_no_resources_exist():
    demands = [
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=1,
            priority=1,
        )
    ]

    allocations = allocate_resources(
        [],
        demands,
    )

    assert allocations == []