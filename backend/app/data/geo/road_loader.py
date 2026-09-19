import json
from pathlib import Path
from typing import Any

from backend.app.domain.models.routing import Road


DEFAULT_ROAD_GEOJSON = (
    Path(__file__).resolve().parent / "roads.geojson"
)


def load_road_geojson(
    path: str | Path = DEFAULT_ROAD_GEOJSON,
) -> dict[str, Any]:
    """Load the road network GeoJSON FeatureCollection."""

    geojson_path = Path(path)

    if not geojson_path.exists():
        raise FileNotFoundError(
            f"Road GeoJSON not found: {geojson_path}"
        )

    with geojson_path.open(
        "r",
        encoding="utf-8",
    ) as file:
        data = json.load(file)

    if data.get("type") != "FeatureCollection":
        raise ValueError(
            "Road GeoJSON must be a FeatureCollection."
        )

    features = data.get("features")

    if not isinstance(features, list):
        raise ValueError(
            "Road GeoJSON must contain a features list."
        )

    return data


def load_roads(
    path: str | Path = DEFAULT_ROAD_GEOJSON,
) -> list[dict[str, Any]]:
    """Load individual road features."""

    data = load_road_geojson(path)
    return data["features"]


def road_feature_to_model(
    feature: dict[str, Any],
) -> Road:
    """Convert one GeoJSON road feature into a Road model."""

    properties = feature.get("properties", {})
    geometry = feature.get("geometry")

    road_id = str(properties["road_id"])
    from_zone_id = str(properties["from_zone_id"])
    to_zone_id = str(properties["to_zone_id"])

    coordinates = geometry.get("coordinates", [])

    if geometry.get("type") != "LineString":
        raise ValueError(
            f"Road {road_id} must use LineString geometry."
        )

    path = tuple(
        (float(point[0]), float(point[1]))
        for point in coordinates
    )

    distance_km = float(properties["distance_km"])
    travel_time_min = float(properties["travel_time_min"])

    capacity = properties.get("capacity")
    road_type = properties.get("road_type")

    return Road(
        id=road_id,
        from_zone_id=from_zone_id,
        to_zone_id=to_zone_id,
        distance_km=distance_km,
        travel_time_min=travel_time_min,
        path=path,
        capacity=(
            None
            if capacity is None
            else float(capacity)
        ),
        road_type=(
            None
            if road_type is None
            else str(road_type)
        ),
    )


def load_road_models(
    path: str | Path = DEFAULT_ROAD_GEOJSON,
) -> list[Road]:
    """Load and convert all road features into Road models."""

    return [
        road_feature_to_model(feature)
        for feature in load_roads(path)
    ]