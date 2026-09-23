import json
from pathlib import Path

from backend.app.domain.models.resources import Resource, ResourceProvenance

DEFAULT_OPERATIONAL_RESOURCE_REGISTRY = (
    Path(__file__).resolve().parent / "chennai_operational_resources.json"
)


def load_operational_resources(
    path: str | Path = DEFAULT_OPERATIONAL_RESOURCE_REGISTRY,
) -> list[Resource]:
    """Load operator-supplied, individually tracked operational resources."""
    registry_path = Path(path)

    if not registry_path.exists():
        raise FileNotFoundError(
            f"Operational resource registry not found: {registry_path}"
        )

    with registry_path.open("r", encoding="utf-8") as file:
        data = json.load(file)

    if data.get("schema_version") != 1:
        raise ValueError("Unsupported operational resource registry schema")

    if data.get("status") != "operational":
        raise ValueError(
            "Operational resource registry must be marked operational."
        )

    resources = data.get("resources")
    if not isinstance(resources, list):
        raise ValueError(
            "Operational resource registry must contain a resources list."
        )

    loaded = [
        Resource(
            **resource,
            provenance=ResourceProvenance.VERIFIED_OPERATIONAL,
        )
        for resource in resources
    ]

    ids = [resource.id for resource in loaded]
    if len(ids) != len(set(ids)):
        raise ValueError("Operational resource IDs must be unique")

    return loaded
