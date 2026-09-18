from backend.app.data.demographics.population_loader import (
    get_population,
    load_population,
)


def test_load_population_contains_200_wards():
    population = load_population()

    assert len(population) == 200


def test_population_contains_known_wards():
    population = load_population()

    assert population["1"] == 18400
    assert population["200"] == 26106


def test_population_values_are_non_negative():
    population = load_population()

    assert all(value >= 0 for value in population.values())


def test_get_population_accepts_string_and_integer():
    assert get_population("1") == 18400
    assert get_population(1) == 18400


def test_get_population_rejects_unknown_ward():
    try:
        get_population(999)
        assert False, "Expected KeyError"
    except KeyError:
        pass

def test_get_population_handles_leading_zeroes():
    assert get_population("004") == get_population(4)