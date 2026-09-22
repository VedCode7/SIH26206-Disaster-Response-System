import json
from pathlib import Path

from backend.app.domain.models.resources import Resource

DEFAULT_RESPONSE_INVENTORY = (
    Path(__file__).resolve().parent / "chennai_response_inventory.json"
)


def load_chennai_response_inventory(
    path: str | Path = DEFAULT_RESPONSE_INVENTORY,
) -> list[Resource]:
    """Load explicitly simulated Chennai response inventory."""
    inventory_path = Path(path)

    if not inventory_path.exists():
        raise FileNotFoundError(
            f"Chennai response inventory not found: {inventory_path}"
        )

    with inventory_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if data.get("scenario") != "chennai_floods_2015":
        raise ValueError(
            "Chennai response inventory must target the chennai_floods_2015 scenario."
        )

    if data.get("status") != "simulated":
        raise ValueError(
            "Chennai response inventory must be explicitly marked simulated."
        )

    resources = data.get("resources")
    if not isinstance(resources, list):
        raise ValueError(
            "Chennai response inventory must contain a resources list."
        )

    return [Resource(**resource) for resource in resources]
