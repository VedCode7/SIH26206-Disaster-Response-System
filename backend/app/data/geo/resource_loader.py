import json
from pathlib import Path
from typing import Any

from backend.app.domain.models.resources import Resource

DEFAULT_RESOURCE_FILE = Path(__file__).resolve().parent / "chennai_resources.json"


def load_resource_data(
    path: str | Path = DEFAULT_RESOURCE_FILE,
) -> dict[str, Any]:
    resource_path = Path(path)
    if not resource_path.exists():
        raise FileNotFoundError(
            f"Resource dataset not found: {resource_path}"
        )

    with resource_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if data.get("source") != "OpenStreetMap":
        raise ValueError("Resource dataset source must be OpenStreetMap.")

    resources = data.get("resources")
    if not isinstance(resources, list):
        raise ValueError("Resource dataset must contain a resources list.")

    return data


def load_resources(
    path: str | Path = DEFAULT_RESOURCE_FILE,
) -> list[Resource]:
    return [
        Resource(**item)
        for item in load_resource_data(path)["resources"]
    ]
