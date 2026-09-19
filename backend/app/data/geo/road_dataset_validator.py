import json
from pathlib import Path
from typing import Any, Iterable



def validate_road_geojson(
    data: dict[str, Any],
    valid_zone_ids: Iterable[str] | None = None,
) -> dict[str, Any]:
    """Validate the structural and semantic contract of a road GeoJSON dataset."""

    if not isinstance(data, dict):
        raise ValueError("Road dataset must be a JSON object.")

    if data.get("type") != "FeatureCollection":
        raise ValueError("Road dataset must be a FeatureCollection.")

    features = data.get("features")
    if not isinstance(features, list):
        raise ValueError("Road dataset must contain a features list.")

    allowed_zones = None if valid_zone_ids is None else set(valid_zone_ids)
    road_ids: set[str] = set()

    for index, feature in enumerate(features):
        if not isinstance(feature, dict):
            raise ValueError(f"Road feature {index} must be an object.")

        if feature.get("type") != "Feature":
            raise ValueError(f"Road feature {index} must have type 'Feature'.")

        properties = feature.get("properties")
        if not isinstance(properties, dict):
            raise ValueError(f"Road feature {index} must contain properties.")

        road_id = properties.get("road_id")
        from_zone_id = properties.get("from_zone_id")
        to_zone_id = properties.get("to_zone_id")

        if not isinstance(road_id, str) or not road_id.strip():
            raise ValueError(f"Road feature {index} must have a road_id.")

        if road_id in road_ids:
            raise ValueError(f"Duplicate road_id: {road_id}")
        road_ids.add(road_id)

        if not isinstance(from_zone_id, str) or not from_zone_id.strip():
            raise ValueError(f"Road {road_id} must have from_zone_id.")

        if not isinstance(to_zone_id, str) or not to_zone_id.strip():
            raise ValueError(f"Road {road_id} must have to_zone_id.")

        if from_zone_id == to_zone_id:
            raise ValueError(f"Road {road_id} cannot connect a zone to itself.")

        if allowed_zones is not None:
            if from_zone_id not in allowed_zones:
                raise ValueError(
                    f"Road {road_id} references unknown from_zone_id: {from_zone_id}"
                )
            if to_zone_id not in allowed_zones:
                raise ValueError(
                    f"Road {road_id} references unknown to_zone_id: {to_zone_id}"
                )

        distance_km = properties.get("distance_km")
        travel_time_min = properties.get("travel_time_min")

        if not _positive_number(distance_km):
            raise ValueError(f"Road {road_id} must have positive distance_km.")

        if not _positive_number(travel_time_min):
            raise ValueError(f"Road {road_id} must have positive travel_time_min.")

        geometry = feature.get("geometry")
        if not isinstance(geometry, dict):
            raise ValueError(f"Road {road_id} must contain geometry.")

        if geometry.get("type") != "LineString":
            raise ValueError(f"Road {road_id} must use LineString geometry.")

        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            raise ValueError(
                f"Road {road_id} must contain at least two coordinates."
            )

        for coordinate in coordinates:
            if (
                not isinstance(coordinate, (list, tuple))
                or len(coordinate) < 2
                or not _finite_number(coordinate[0])
                or not _finite_number(coordinate[1])
            ):
                raise ValueError(
                    f"Road {road_id} contains an invalid coordinate."
                )

    return data



def validate_road_file(
    path: str | Path,
    valid_zone_ids: Iterable[str] | None = None,
) -> dict[str, Any]:
    """Load and validate a road GeoJSON file."""

    road_path = Path(path)

    if not road_path.exists():
        raise FileNotFoundError(f"Road dataset not found: {road_path}")

    with road_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    return validate_road_geojson(data, valid_zone_ids=valid_zone_ids)



def _finite_number(value: Any) -> bool:
    if isinstance(value, bool):
        return False

    try:
        number = float(value)
    except (TypeError, ValueError):
        return False

    return number == number and abs(number) != float("inf")



def _positive_number(value: Any) -> bool:
    return _finite_number(value) and float(value) > 0
