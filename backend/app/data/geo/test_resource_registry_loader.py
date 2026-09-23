from backend.app.data.geo.resource_registry_loader import load_operational_resources
from backend.app.domain.models.resources import ResourceProvenance


def test_operational_registry_loads_demo_resources_for_demonstration():
    resources = load_operational_resources()

    assert len(resources) == 5
    assert {resource.resource_type for resource in resources} == {
        "ambulance",
        "rescue_team",
        "boat",
    }


def test_loaded_operational_resources_are_marked_verified():
    resources = load_operational_resources()

    for resource in resources:
        assert resource.provenance == ResourceProvenance.VERIFIED_OPERATIONAL


def test_demo_response_units_are_staged_outside_w18887_for_route_demo():
    resources = load_operational_resources()

    staged_units = {
        resource.resource_type
        for resource in resources
        if resource.current_zone_id == "W19022"
    }

    assert "ambulance" in staged_units
    assert "rescue_team" in staged_units
