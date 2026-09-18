import json
from pathlib import Path
from typing import Any


DEFAULT_WARD_GEOJSON = (
    Path(__file__).resolve().parent / "wards.geojson"
)


def load_ward_geojson(
    path: str | Path = DEFAULT_WARD_GEOJSON,
) -> dict[str, Any]:
    """
    Load the Chennai ward GeoJSON FeatureCollection.

    The source is the Greater Chennai Corporation's ward
    boundary dataset. The loader intentionally preserves the
    original GeoJSON structure so the frontend can consume
    the geometry directly later.
    """
    geojson_path = Path(path)

    if not geojson_path.exists():
        raise FileNotFoundError(
            f"Ward GeoJSON not found: {geojson_path}"
        )

    with geojson_path.open(
        "r",
        encoding="utf-8",
    ) as file:
        data = json.load(file)

    if data.get("type") != "FeatureCollection":
        raise ValueError(
            "Ward GeoJSON must be a FeatureCollection."
        )

    features = data.get("features")

    if not isinstance(features, list):
        raise ValueError(
            "Ward GeoJSON must contain a features list."
        )

    return data


def load_wards(
    path: str | Path = DEFAULT_WARD_GEOJSON,
) -> list[dict[str, Any]]:
    """
    Load individual Chennai ward features.
    """
    data = load_ward_geojson(path)
    return data["features"]