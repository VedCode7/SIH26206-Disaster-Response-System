from backend.app.domain.models.resources import Resource, ResourceDemand
from backend.app.engines.resource_allocator import allocate_resources


def test_one_demand_can_use_multiple_real_resources():
    resources = [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="W18901",
            quantity=1,
        ),
        Resource(
            id="AMB002",
            resource_type="ambulance",
            current_zone_id="W18902",
            quantity=1,
        ),
    ]

    allocations = allocate_resources(
        resources,
        [
            ResourceDemand(
                zone_id="W18903",
                resource_type="ambulance",
                quantity=2,
                priority=1,
            )
        ],
    )

    assert [allocation.resource_id for allocation in allocations] == [
        "AMB001",
        "AMB002",
    ]
    assert [allocation.quantity for allocation in allocations] == [1, 1]
    assert [allocation.source_zone_id for allocation in allocations] == [
        "W18901",
        "W18902",
    ]
