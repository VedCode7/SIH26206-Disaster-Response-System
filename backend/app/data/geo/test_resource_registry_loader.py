from backend.app.data.geo.resource_registry_loader import load_operational_resources
from backend.app.domain.models.resources import ResourceProvenance


def test_operational_registry_is_empty_until_verified_resources_are_supplied():
    resources = load_operational_resources()

    assert resources == []


def test_loaded_operational_resources_are_marked_verified():
    resources = load_operational_resources()

    for resource in resources:
        assert resource.provenance == ResourceProvenance.VERIFIED_OPERATIONAL
