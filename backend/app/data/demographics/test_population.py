import pytest

from backend.app.data.demographics.population import (
    WardPopulation,
)


def test_valid_population():
    population = WardPopulation(
        ward_id="W001",
        population=5000,
        vulnerable_population=1200,
        source="GCC",
        source_year=2025,
        confidence="high",
    )

    assert population.ward_id == "W001"
    assert population.population == 5000
    assert population.vulnerable_population == 1200
    assert population.source == "GCC"
    assert population.source_year == 2025
    assert population.confidence == "high"


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


def test_source_cannot_be_empty():
    with pytest.raises(ValueError):
        WardPopulation(
            ward_id="W001",
            population=100,
            source="",
        )


def test_confidence_cannot_be_empty():
    with pytest.raises(ValueError):
        WardPopulation(
            ward_id="W001",
            population=100,
            confidence="",
        )


def test_source_year_can_be_unknown():
    population = WardPopulation(
        ward_id="W001",
        population=100,
        source="historical-census",
        source_year=None,
    )

    assert population.source_year is None