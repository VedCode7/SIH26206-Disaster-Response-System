import pytest

from backend.app.domain.models.resources import Resource


def test_resource_can_be_created():
    resource = Resource(
        id="AMB001",
        resource_type="ambulance",
        current_zone_id="Z001",
    )

    assert resource.id == "AMB001"
    assert resource.resource_type == "ambulance"
    assert resource.current_zone_id == "Z001"
    assert resource.quantity == 1


def test_resource_can_have_multiple_units():
    resource = Resource(
        id="MED001",
        resource_type="medical_kit",
        current_zone_id="Z002",
        quantity=25,
    )

    assert resource.quantity == 25


def test_resource_can_store_real_geographic_metadata():
    resource = Resource(
        id="OSM-HOSPITAL-123",
        resource_type="hospital",
        current_zone_id="W18887",
        name="Example Hospital",
        latitude=13.0827,
        longitude=80.2707,
        source="OpenStreetMap",
    )

    assert resource.name == "Example Hospital"
    assert resource.latitude == 13.0827
    assert resource.longitude == 80.2707
    assert resource.source == "OpenStreetMap"


def test_invalid_latitude_is_rejected():
    with pytest.raises(ValueError):
        Resource(
            id="HOSP001",
            resource_type="hospital",
            current_zone_id="W18887",
            latitude=91,
        )


def test_invalid_longitude_is_rejected():
    with pytest.raises(ValueError):
        Resource(
            id="HOSP001",
            resource_type="hospital",
            current_zone_id="W18887",
            longitude=181,
        )


def test_empty_resource_id_is_rejected():
    with pytest.raises(ValueError):
        Resource(
            id="",
            resource_type="ambulance",
            current_zone_id="Z001",
        )


def test_empty_resource_type_is_rejected():
    with pytest.raises(ValueError):
        Resource(
            id="AMB001",
            resource_type="",
            current_zone_id="Z001",
        )


def test_zero_quantity_is_rejected():
    with pytest.raises(ValueError):
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z001",
            quantity=0,
        )
