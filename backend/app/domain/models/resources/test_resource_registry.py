from backend.app.domain.models.resources import (
    Resource,
    ResourceProvenance,
    ResourceStatus,
)


VERIFICATION_METADATA = {
    "source": "operator registry",
    "last_verified_at": "2026-09-23T12:00:00+05:30",
}


def test_verified_operational_resource_is_individually_tracked():
    resource = Resource(
        id="AMB-CHN-001",
        resource_type="ambulance",
        current_zone_id="W18887",
        status=ResourceStatus.AVAILABLE,
        provenance=ResourceProvenance.VERIFIED_OPERATIONAL,
        **VERIFICATION_METADATA,
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
            **VERIFICATION_METADATA,
        )
    except ValueError as exc:
        assert "individually tracked" in str(exc)
    else:
        raise AssertionError("Expected aggregate operational inventory to fail")


def test_verified_operational_resource_requires_source():
    try:
        Resource(
            id="AMB-CHN-002",
            resource_type="ambulance",
            current_zone_id="W18887",
            status=ResourceStatus.AVAILABLE,
            provenance=ResourceProvenance.VERIFIED_OPERATIONAL,
            last_verified_at=VERIFICATION_METADATA["last_verified_at"],
        )
    except ValueError as exc:
        assert "source" in str(exc)
    else:
        raise AssertionError("Expected missing source metadata to fail")


def test_verified_operational_resource_requires_verification_timestamp():
    try:
        Resource(
            id="AMB-CHN-003",
            resource_type="ambulance",
            current_zone_id="W18887",
            status=ResourceStatus.AVAILABLE,
            provenance=ResourceProvenance.VERIFIED_OPERATIONAL,
            source=VERIFICATION_METADATA["source"],
        )
    except ValueError as exc:
        assert "last_verified_at" in str(exc)
    else:
        raise AssertionError(
            "Expected missing verification timestamp to fail"
        )


def test_verified_operational_resource_cannot_have_unknown_status():
    try:
        Resource(
            id="AMB-CHN-004",
            resource_type="ambulance",
            current_zone_id="W18887",
            status=ResourceStatus.UNKNOWN,
            provenance=ResourceProvenance.VERIFIED_OPERATIONAL,
            **VERIFICATION_METADATA,
        )
    except ValueError as exc:
        assert "known status" in str(exc)
    else:
        raise AssertionError("Expected unknown operational status to fail")
