from backend.app.domain.models.resources import (
    Resource,
    ResourceDemand,
)
from backend.app.domain.models.routing import Road
from backend.app.engines.resource_allocator import (
    allocate_resources,
)
from backend.app.engines.routing_graph import RoutingGraph


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

    assert allocation.resource_id == "AMB001"
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
    assert allocations[0].resource_id == "AMB001"
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
    assert allocations[0].resource_id == "AMB001"
    assert allocations[0].destination_zone_id == "Z001"
    assert allocations[0].quantity == 2
    assert allocations[0].priority == 1


def test_preserves_real_resource_identity_when_multiple_resources_match():
    resources = [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z002",
            quantity=1,
        ),
        Resource(
            id="AMB002",
            resource_type="ambulance",
            current_zone_id="Z003",
            quantity=1,
        ),
    ]

    demands = [
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=1,
            priority=1,
        ),
        ResourceDemand(
            zone_id="Z004",
            resource_type="ambulance",
            quantity=1,
            priority=2,
        ),
    ]

    allocations = allocate_resources(
        resources,
        demands,
    )

    assert [allocation.resource_id for allocation in allocations] == [
        "AMB001",
        "AMB002",
    ]
    assert [allocation.source_zone_id for allocation in allocations] == [
        "Z002",
        "Z003",
    ]


def test_can_split_one_real_resource_across_demands():
    resources = [
        Resource(
            id="MED001",
            resource_type="medical_unit",
            current_zone_id="Z002",
            quantity=3,
        )
    ]

    demands = [
        ResourceDemand(
            zone_id="Z001",
            resource_type="medical_unit",
            quantity=2,
            priority=1,
        ),
        ResourceDemand(
            zone_id="Z003",
            resource_type="medical_unit",
            quantity=2,
            priority=2,
        ),
    ]

    allocations = allocate_resources(
        resources,
        demands,
    )

    assert len(allocations) == 2
    assert allocations[0].resource_id == "MED001"
    assert allocations[0].quantity == 2
    assert allocations[1].resource_id == "MED001"
    assert allocations[1].quantity == 1


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


def test_route_aware_allocation_rejects_unreachable_resource():
    resources = [
        Resource(
            id="AMB_BLOCKED",
            resource_type="ambulance",
            current_zone_id="Z002",
        ),
        Resource(
            id="AMB_REACHABLE",
            resource_type="ambulance",
            current_zone_id="Z003",
        ),
    ]

    graph = RoutingGraph(
        [
            Road(
                id="R_BLOCKED",
                from_zone_id="Z002",
                to_zone_id="Z001",
                distance_km=1.0,
                travel_time_min=2.0,
                blocked=True,
            ),
            Road(
                id="R_OPEN",
                from_zone_id="Z003",
                to_zone_id="Z001",
                distance_km=3.0,
                travel_time_min=6.0,
            ),
        ]
    )

    allocations = allocate_resources(
        resources,
        [
            ResourceDemand(
                zone_id="Z001",
                resource_type="ambulance",
                quantity=1,
                priority=1,
            )
        ],
        routing_graph=graph,
    )

    assert [allocation.resource_id for allocation in allocations] == [
        "AMB_REACHABLE"
    ]


def test_route_cost_prefers_less_accessibility_penalty_over_raw_distance():
    resources = [
        Resource(
            id="AMB_SLOW_ACCESS",
            resource_type="ambulance",
            current_zone_id="Z002",
        ),
        Resource(
            id="AMB_CLEAR",
            resource_type="ambulance",
            current_zone_id="Z003",
        ),
    ]

    graph = RoutingGraph(
        [
            Road(
                id="R_LOW_ACCESS",
                from_zone_id="Z002",
                to_zone_id="Z001",
                distance_km=1.0,
                travel_time_min=5.0,
                accessibility_percent=25.0,
            ),
            Road(
                id="R_CLEAR",
                from_zone_id="Z003",
                to_zone_id="Z001",
                distance_km=4.0,
                travel_time_min=8.0,
                accessibility_percent=100.0,
            ),
        ]
    )

    allocations = allocate_resources(
        resources,
        [
            ResourceDemand(
                zone_id="Z001",
                resource_type="ambulance",
                quantity=1,
                priority=1,
            )
        ],
        routing_graph=graph,
    )

    assert allocations[0].resource_id == "AMB_CLEAR"


def test_same_priority_scarce_route_is_served_before_broader_option():
    resources = [
        Resource(
            id="AMB_Z2",
            resource_type="ambulance",
            current_zone_id="Z2",
        ),
        Resource(
            id="AMB_Z3",
            resource_type="ambulance",
            current_zone_id="Z3",
        ),
    ]

    graph = RoutingGraph(
        [
            Road(
                id="R_Z2_TO_Z9",
                from_zone_id="Z2",
                to_zone_id="Z9",
                distance_km=1.0,
                travel_time_min=2.0,
            ),
            Road(
                id="R_Z2_TO_Z1",
                from_zone_id="Z2",
                to_zone_id="Z1",
                distance_km=1.0,
                travel_time_min=2.0,
                blocked=True,
            ),
            Road(
                id="R_Z3_TO_Z9",
                from_zone_id="Z3",
                to_zone_id="Z9",
                distance_km=2.0,
                travel_time_min=4.0,
            ),
            Road(
                id="R_Z3_TO_Z1",
                from_zone_id="Z3",
                to_zone_id="Z1",
                distance_km=2.0,
                travel_time_min=4.0,
            ),
        ]
    )

    allocations = allocate_resources(
        resources,
        [
            ResourceDemand(
                zone_id="Z1",
                resource_type="ambulance",
                quantity=1,
                priority=1,
            ),
            ResourceDemand(
                zone_id="Z9",
                resource_type="ambulance",
                quantity=1,
                priority=1,
            ),
        ],
        routing_graph=graph,
    )

    assert [allocation.destination_zone_id for allocation in allocations] == [
        "Z9",
        "Z1",
    ]
    assert [allocation.resource_id for allocation in allocations] == [
        "AMB_Z2",
        "AMB_Z3",
    ]
