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
