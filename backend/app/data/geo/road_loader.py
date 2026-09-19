import json
from pathlib import Path
from typing import Any


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