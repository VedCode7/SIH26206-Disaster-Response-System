from __future__ import annotations

from collections.abc import Iterable

from backend.app.domain.models.resources.resource_facility import ResourceFacility
from backend.app.domain.models.zone import RiskLevel


# Facility classes that are useful to expose for each risk level. This is a
# relevance filter only: it does not claim that a facility has capacity or is
# currently operational.
_FACILITY_TYPES_BY_RISK: dict[RiskLevel, tuple[str, ...]] = {
    RiskLevel.NORMAL: ("hospital", "clinic", "fire_station", "police_station", "shelter"),
    RiskLevel.WATCH: ("hospital", "clinic", "fire_station", "police_station", "shelter"),
    RiskLevel.HIGH: ("hospital", "fire_station", "police_station", "shelter", "clinic"),
    RiskLevel.CRITICAL: ("hospital", "fire_station", "police_station", "shelter", "clinic"),
}


def relevant_facility_types(risk_level: RiskLevel) -> tuple[str, ...]:
    """Return facility categories relevant to the current risk level."""
    return _FACILITY_TYPES_BY_RISK.get(risk_level, _FACILITY_TYPES_BY_RISK[RiskLevel.NORMAL])


def filter_relevant_facilities(
    facilities: Iterable[ResourceFacility],
    risk_level: RiskLevel,
) -> list[ResourceFacility]:
    """Filter real facilities by relevance without inventing operational state."""
    allowed = set(relevant_facility_types(risk_level))
    return [facility for facility in facilities if facility.resource_type in allowed]
