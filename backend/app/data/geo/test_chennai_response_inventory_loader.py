from backend.app.data.geo.chennai_response_inventory_loader import (
    load_chennai_response_inventory,
)


def test_load_chennai_response_inventory():
    resources = load_chennai_response_inventory()

    assert resources
    assert all(resource.source == "SIH26206 scenario inventory" for resource in resources)
    assert {resource.resource_type for resource in resources} == {
        "ambulance",
        "rescue_team",
        "boat",
    }
    assert {resource.id for resource in resources} == {
        "CHN-AMB-001",
        "CHN-AMB-002",
        "CHN-RES-001",
        "CHN-RES-002",
        "CHN-BOAT-001",
        "CHN-BOAT-002",
    }


def test_inventory_resources_have_explicit_simulation_identity():
    resources = load_chennai_response_inventory()

    for resource in resources:
        assert resource.id.startswith("CHN-")
        assert resource.current_zone_id == "W18901"
        assert resource.quantity > 0
