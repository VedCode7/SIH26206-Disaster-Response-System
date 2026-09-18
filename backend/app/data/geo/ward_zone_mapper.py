from typing import Any

from backend.app.domain.models.zone import Zone
from backend.app.data.demographics.population_loader import get_population

def ward_feature_to_zone(feature: dict[str, Any]) -> Zone:
    """
    Convert one GCC Chennai ward GeoJSON feature
    into the RADAR Zone model.

    Population and live flood conditions are intentionally
    left at neutral defaults for now. They will be populated
    by separate data sources later.
    """
    properties = feature.get("properties", {})
    geometry = feature.get("geometry")

    ward = str(properties["ward"])
    ward_id = str(properties["ward_id"])

    return Zone(
        id=f"W{ward_id}",
        name=f"Ward {ward}",
        population=get_population(ward),
        vulnerable_population=0,
        lat=None,
        lng=None,
        geometry=geometry,
    )


def wards_to_zones(
    features: list[dict[str, Any]],
) -> list[Zone]:
    """
    Convert a collection of ward GeoJSON features
    into RADAR Zone objects.
    """
    return [
        ward_feature_to_zone(feature)
        for feature in features
    ]