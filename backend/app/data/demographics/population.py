from dataclasses import dataclass


@dataclass(frozen=True)
class WardPopulation:
    """
    Demographic information associated with a ward.

    The source year is kept explicitly because demographic
    boundaries and populations may not correspond to the
    current GCC ward boundaries.
    """

    ward_id: str
    population: int
    vulnerable_population: int = 0
    source_year: int = 2011

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

        if self.source_year <= 0:
            raise ValueError(
                "source_year must be a positive year"
            )