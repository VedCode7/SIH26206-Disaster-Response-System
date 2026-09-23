from backend.app.domain.models.resources import (
    Resource,
    ResourceProvenance,
    ResourceStatus,
)
from backend.app.engines.resource_registry import ResourceRegistry


def operational_resource(resource_id, resource_type, zone, status):
    return Resource(
        id=resource_id,
        resource_type=resource_type,
        current_zone_id=zone,
        status=status,
        provenance=ResourceProvenance.VERIFIED_OPERATIONAL,
        source="test operator registry",
    )


def test_registry_excludes_non_operational_records_from_live_pool():
    registry = ResourceRegistry(
        [
            Resource(
                id="SCENARIO-AMB-001",
                resource_type="ambulance",
                current_zone_id="W18901",
                quantity=2,
                provenance=ResourceProvenance.SCENARIO,
                status=ResourceStatus.AVAILABLE,
            ),
            operational_resource(
                "AMB-CHN-001",
                "ambulance",
                "W18901",
                ResourceStatus.AVAILABLE,
            ),
        ]
    )

    live = registry.available("ambulance")

    assert [resource.id for resource in live] == ["AMB-CHN-001"]


def test_registry_update_changes_operational_state():
    registry = ResourceRegistry(
        [
            operational_resource(
                "AMB-CHN-001",
                "ambulance",
                "W18901",
                ResourceStatus.AVAILABLE,
            )
        ]
    )

    updated = registry.update(
        "AMB-CHN-001",
        status=ResourceStatus.DISPATCHED,
        current_zone_id="W18887",
    )

    assert updated.status == ResourceStatus.DISPATCHED
    assert updated.current_zone_id == "W18887"
    assert registry.available("ambulance") == []


def test_registry_summary_counts_only_operational_resources():
    registry = ResourceRegistry(
        [
            operational_resource(
                "AMB-001",
                "ambulance",
                "W18901",
                ResourceStatus.AVAILABLE,
            ),
            operational_resource(
                "AMB-002",
                "ambulance",
                "W18902",
                ResourceStatus.DISPATCHED,
            ),
            Resource(
                id="SCENARIO-BOAT-001",
                resource_type="boat",
                current_zone_id="W18901",
                provenance=ResourceProvenance.SCENARIO,
                status=ResourceStatus.AVAILABLE,
            ),
        ]
    )

    assert registry.summary() == {
        "total": 2,
        "available": 1,
        "reserved": 0,
        "dispatched": 1,
        "en_route": 0,
        "on_scene": 0,
        "unavailable": 0,
        "maintenance": 0,
        "unknown": 0,
    }
