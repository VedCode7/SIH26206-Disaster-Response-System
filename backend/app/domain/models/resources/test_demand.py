import pytest

from backend.app.domain.models.resources import ResourceDemand


def test_resource_demand_can_be_created():
    demand = ResourceDemand(
        zone_id="Z001",
        resource_type="ambulance",
        quantity=2,
        priority=1,
    )

    assert demand.zone_id == "Z001"
    assert demand.resource_type == "ambulance"
    assert demand.quantity == 2
    assert demand.priority == 1


def test_zero_quantity_is_rejected():
    with pytest.raises(ValueError):
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=0,
            priority=1,
        )


def test_invalid_priority_is_rejected():
    with pytest.raises(ValueError):
        ResourceDemand(
            zone_id="Z001",
            resource_type="ambulance",
            quantity=2,
            priority=0,
        )


def test_empty_zone_id_is_rejected():
    with pytest.raises(ValueError):
        ResourceDemand(
            zone_id="",
            resource_type="ambulance",
            quantity=2,
            priority=1,
        )