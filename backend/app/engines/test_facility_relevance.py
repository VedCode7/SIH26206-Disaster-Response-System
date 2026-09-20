from backend.app.domain.models.resources.resource_facility import ResourceFacility
from backend.app.domain.models.risk import RiskLevel
from backend.app.engines.facility_relevance import (
    filter_relevant_facilities,
    relevant_facility_types,
)


def facility(resource_type: str) -> ResourceFacility:
    return ResourceFacility(
        id=f"OSMN-{resource_type}",
        resource_type=resource_type,
        current_zone_id="W19022",
        name=f"Test {resource_type}",
        latitude=13.04,
        longitude=80.20,
        source="OpenStreetMap",
    )


def test_high_risk_prioritises_emergency_facility_categories():
    assert relevant_facility_types(RiskLevel.HIGH) == (
        "hospital",
        "fire_station",
        "police_station",
        "shelter",
        "clinic",
    )


def test_relevance_filter_does_not_change_facility_data():
    hospitals = [facility("hospital")]
    result = filter_relevant_facilities(hospitals, RiskLevel.HIGH)
    assert result == hospitals
    assert not hasattr(result[0], "quantity")


def test_relevance_filter_excludes_unknown_facility_types():
    facilities = [facility("hospital"), facility("restaurant")]
    result = filter_relevant_facilities(facilities, RiskLevel.HIGH)
    assert [item.resource_type for item in result] == ["hospital"]
