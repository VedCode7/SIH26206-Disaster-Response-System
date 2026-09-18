import json
from pathlib import Path


DATA_FILE = Path(__file__).with_name("ward_population.json")


def _normalize_ward_id(ward_id: str | int) -> str:
    """Normalize a ward ID to its canonical numeric string form."""
    try:
        return str(int(str(ward_id).strip()))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid ward ID: {ward_id!r}") from exc


def load_population() -> dict[str, int]:
    """Load ward population data keyed by normalized ward ID."""
    with DATA_FILE.open("r", encoding="utf-8") as file:
        records = json.load(file)

    return {
        _normalize_ward_id(record["ward_id"]): int(record["population"])
        for record in records
    }


def get_population(ward_id: str | int) -> int:
    """Return the population for a ward."""
    population = load_population()
    key = _normalize_ward_id(ward_id)

    if key not in population:
        raise KeyError(f"Population data not found for ward {ward_id}")

    return population[key]