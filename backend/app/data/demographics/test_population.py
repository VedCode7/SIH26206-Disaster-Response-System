import pytest

from backend.app.data.demographics.population import (
    WardPopulation,
)


def test_valid_population():
    population = WardPopulation(
        ward_id="W001",
        population=5000,
        vulnerable_population=1200,
        source_year=2011,
    )

    assert population.ward_id == "W001"
    assert population.population == 5000
    assert population.vulnerable_population == 1200
    assert population.source_year == 2011


def test_population_cannot_be_negative():
    with pytest.raises(ValueError):
        WardPopulation(
            ward_id="W001",
            population=-1,
        )


def test_vulnerable_population_cannot_exceed_population():
    with pytest.raises(ValueError):
        WardPopulation(
            ward_id="W001",
            population=100,
            vulnerable_population=101,
        )