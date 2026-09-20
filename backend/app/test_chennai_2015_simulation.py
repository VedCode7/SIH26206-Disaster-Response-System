from backend.app.domain.models import Zone
from backend.app.domain.models.routing import Road
from backend.app.domain.world_state import WorldState
from backend.app.engines.chennai_2015_simulation import (
    CHENNAI_2015_STAGES,
    run_chennai_2015_simulation,
)


def _zone(zone_id: str, lat: float, lng: float) -> Zone:
    return Zone(
        id=zone_id,
        name=zone_id,
        population=5000,
        vulnerable_population=0,
        lat=lat,
        lng=lng,
        geometry={
            "type": "Polygon",
            "coordinates": [[
                [lng - 0.002, lat - 0.002],
                [lng + 0.002, lat - 0.002],
                [lng + 0.002, lat + 0.002],
                [lng - 0.002, lat + 0.002],
                [lng - 0.002, lat - 0.002],
            ]],
        },
    )


def test_historical_scenario_has_five_stages():
    assert len(CHENNAI_2015_STAGES) == 5
    assert CHENNAI_2015_STAGES[2].id == "2015-12-02"
    assert CHENNAI_2015_STAGES[2].observed_rainfall_24h_mm == 294.1
    assert CHENNAI_2015_STAGES[1].reservoir_release_cusecs == 29000.0


def test_historical_simulation_is_deterministic_and_non_mutating():
    state = WorldState(
        disaster_active=False,
        zones=[
            _zone("W18901", 13.005, 80.240),
            _zone("W18902", 13.150, 80.300),
        ],
    )
    roads = [
        Road(
            id="R1",
            from_zone_id="W18901",
            to_zone_id="W18902",
            distance_km=5.0,
            travel_time_min=10.0,
        )
    ]

    first = run_chennai_2015_simulation(state, roads)
    second = run_chennai_2015_simulation(state, roads)

    assert len(first) == len(CHENNAI_2015_STAGES)
    assert first[2]["assessments"] == second[2]["assessments"]
    assert state.zones[0].water_depth_m == 0.0
    assert roads[0].blocked is False


def test_peak_stage_drives_risk_and_road_degradation():
    state = WorldState(
        disaster_active=False,
        zones=[
            _zone("W18901", 13.005, 80.240),
            _zone("W18902", 13.030, 80.225),
        ],
    )
    roads = [
        Road(
            id="R1",
            from_zone_id="W18901",
            to_zone_id="W18902",
            distance_km=5.0,
            travel_time_min=10.0,
        )
    ]

    snapshots = run_chennai_2015_simulation(state, roads)

    onset = snapshots[0]
    peak = snapshots[2]

    assert peak["highest_risk"].risk_score >= onset["highest_risk"].risk_score
    assert peak["road_summary"]["restricted"] >= onset["road_summary"]["restricted"]
    assert peak["response"]["priority_zones"]
