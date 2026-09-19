from typing import Any


class RoadZoneMappingError(ValueError):
    """Raised when a road cannot be mapped to two ward zones."""


def _point_in_ring(point: tuple[float, float], ring: list[list[float]]) -> bool:
    x, y = point
    inside = False

    if len(ring) < 3:
        return False

    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]

        intersects = ((yi > y) != (yj > y)) and (
            x < (xj - xi) * (y - yi) / (yj - yi) + xi
        )
        if intersects:
            inside = not inside
        j = i

    return inside


def _point_in_polygon(
    point: tuple[float, float],
    coordinates: list[list[list[float]]],
) -> bool:
    if not coordinates or not _point_in_ring(point, coordinates[0]):
        return False

    return not any(
        _point_in_ring(point, hole)
        for hole in coordinates[1:]
    )


def _point_in_multipolygon(
    point: tuple[float, float],
    coordinates: list[list[list[list[float]]]],
) -> bool:
    return any(
        _point_in_polygon(point, polygon)
        for polygon in coordinates
    )


def point_in_geometry(
    point: tuple[float, float],
    geometry: dict[str, Any],
) -> bool:
    """Return whether a longitude/latitude point lies in a GeoJSON polygon."""
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")

    if geometry_type == "Polygon":
        return _point_in_polygon(point, coordinates)

    if geometry_type == "MultiPolygon":
        return _point_in_multipolygon(point, coordinates)

    return False


def zone_for_point(
    point: tuple[float, float],
    ward_features: list[dict[str, Any]],
) -> str | None:
    """Return the RADAR zone ID containing a point, if one exists."""
    for feature in ward_features:
        geometry = feature.get("geometry")
        properties = feature.get("properties", {})

        if not isinstance(geometry, dict):
            continue

        if point_in_geometry(point, geometry):
            ward_id = properties.get("ward_id")
            if ward_id is None:
                return None
            return f"W{ward_id}"

    return None


def map_road_feature_to_zones(
    feature: dict[str, Any],
    ward_features: list[dict[str, Any]],
) -> tuple[str, str]:
    """Map a segmented GeoJSON road's endpoints to ward zone IDs."""
    geometry = feature.get("geometry") or {}
    if geometry.get("type") != "LineString":
        raise RoadZoneMappingError("Road geometry must be a LineString.")

    coordinates = geometry.get("coordinates") or []
    if len(coordinates) < 2:
        raise RoadZoneMappingError("Road LineString must contain at least two points.")

    start = (float(coordinates[0][0]), float(coordinates[0][1]))
    end = (float(coordinates[-1][0]), float(coordinates[-1][1]))

    from_zone_id = zone_for_point(start, ward_features)
    to_zone_id = zone_for_point(end, ward_features)

    if from_zone_id is None or to_zone_id is None:
        road_id = (feature.get("properties") or {}).get("road_id", "unknown")
        raise RoadZoneMappingError(
            f"Road {road_id} has an endpoint outside the ward geography."
        )

    if from_zone_id == to_zone_id:
        road_id = (feature.get("properties") or {}).get("road_id", "unknown")
        raise RoadZoneMappingError(
            f"Road {road_id} does not connect two distinct ward zones."
        )

    return from_zone_id, to_zone_id
