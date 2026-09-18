from dataclasses import dataclass


@dataclass(frozen=True)
class WardPopulation:
    """
    Population information associated with a GCC ward.

    The source metadata is retained explicitly because
    demographic datasets may use different boundary years.
    """

    ward_id: str
    population: int
    vulnerable_population: int = 0
    source: str = "unknown"
    source_year: int | None = None
    confidence: str = "unknown"

    def __post_init__(self) -> None:
        if self.population < 0:
            raise ValueError("population cannot be negative")

        if self.vulnerable_population < 0:
            raise ValueError(
                "vulnerable_population cannot be negative"
            )

        if self.vulnerable_population > self.population:
            raise ValueError(
                "vulnerable_population cannot exceed population"
            )

        if self.source_year is not None and self.source_year <= 0:
            raise ValueError(
                "source_year must be a positive year"
            )

        if not self.source.strip():
            raise ValueError(
                "source cannot be empty"
            )

        if not self.confidence.strip():
            raise ValueError(
                "confidence cannot be empty"
            )