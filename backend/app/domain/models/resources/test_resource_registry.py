from backend.app.domain.models.resources import (
    Resource,
    ResourceProvenance,
    ResourceStatus,
)


def test_verified_operational_resource_is_individually_tracked():
    resource = Resource(
        id="AMB-CHN-001",
        resource_type="ambulance",
        current_zone_id="W18887",
        source="operator registry",
        status=ResourceStatus.AVAILABLE,
        provenance=ResourceProvenance.VERIFIED_OPERATIONAL,
    )

    assert resource.quantity == 1
    assert resource.status == ResourceStatus.AVAILABLE
    assert resource.provenance == ResourceProvenance.VERIFIED_OPERATIONAL


def test_verified_operational_resource_cannot_use_aggregate_quantity():
    try:
        Resource(
            id="AMB-CHN-FLEET",
            resource_type="ambulance",
            current_zone_id="W18887",
            quantity=3,
            status=ResourceStatus.AVAILABLE,
            provenance=ResourceProvenance.VERIFIED_OPERATIONAL,
        )
    except ValueError as exc:
        assert "individually tracked" in str(exc)
    else:
        raise AssertionError("Expected aggregate operational inventory to fail")
