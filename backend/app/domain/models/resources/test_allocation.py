import pytest

from backend.app.domain.models.resources import ResourceAllocation


def test_resource_allocation_can_be_created():
    allocation = ResourceAllocation(
        resource_id="AMB001",
        resource_type="ambulance",
        source_zone_id="Z002",
        destination_zone_id="Z001",
        quantity=1,
        priority=1,
    )

    assert allocation.resource_id == "AMB001"
    assert allocation.resource_type == "ambulance"
    assert allocation.source_zone_id == "Z002"
    assert allocation.destination_zone_id == "Z001"
    assert allocation.quantity == 1
    assert allocation.priority == 1


def test_zero_quantity_is_rejected():
    with pytest.raises(ValueError):
        ResourceAllocation(
            resource_id="AMB001",
            resource_type="ambulance",
            source_zone_id="Z002",
            destination_zone_id="Z001",
            quantity=0,
            priority=1,
        )


def test_invalid_priority_is_rejected():
    with pytest.raises(ValueError):
        ResourceAllocation(
            resource_id="AMB001",
            resource_type="ambulance",
            source_zone_id="Z002",
            destination_zone_id="Z001",
            quantity=1,
            priority=0,
        )


def test_empty_destination_is_rejected():
    with pytest.raises(ValueError):
        ResourceAllocation(
            resource_id="AMB001",
            resource_type="ambulance",
            source_zone_id="Z002",
            destination_zone_id="",
            quantity=1,
            priority=1,
        )