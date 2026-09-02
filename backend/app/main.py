from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from backend.app.domain.models import Zone
from backend.app.engines.disaster_simulator import (
    create_flood_simulation,
)
from backend.app.engines.risk_analysis import analyze_world_risk
from backend.app.engines.response_coordinator import (
    create_response_plan,
)
from backend.app.engines.simulation_analysis import (
    analyze_simulation,
)
from backend.app.state.initial_state import (
    create_demo_world_state,
)
from backend.app.state.world_state_store import (
    WorldStateStore,
)


app = FastAPI(
    title="SIH26206 Disaster Response System",
    description=(
        "Prototype disaster response and "
        "decision-support backend."
    ),
    version="0.1.0",
)


world_state_store = WorldStateStore(
    create_demo_world_state()
)


class ZoneUpdateRequest(BaseModel):
    water_depth_m: float | None = Field(
        default=None,
        ge=0,
    )

    rainfall_mm_per_hr: float | None = Field(
        default=None,
        ge=0,
    )

    accessibility_percent: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "disaster-response-backend",
    }


@app.get("/risk/overview")
def get_risk_overview():
    world_state = world_state_store.get_state()

    return analyze_world_risk(world_state)


@app.get("/response/plan/{zone_id}")
def get_response_plan(zone_id: str):
    world_state = world_state_store.get_state()

    overview = analyze_world_risk(
        world_state
    )

    assessment = next(
        (
            item
            for item in overview.assessments
            if item.zone_id == zone_id
        ),
        None,
    )

    if assessment is None:
        raise HTTPException(
            status_code=404,
            detail=f"Zone '{zone_id}' not found",
        )

    resources = create_demo_resources()

    plan = create_response_plan(
        assessment=assessment,
        resources=resources,
    )

    return plan


@app.post("/world/zones/{zone_id}/update")
def update_zone(
    zone_id: str,
    update: ZoneUpdateRequest,
):
    world_state = world_state_store.get_state()

    zone = world_state.get_zone(zone_id)

    if zone is None:
        raise HTTPException(
            status_code=404,
            detail=f"Zone '{zone_id}' not found",
        )

    updated_values = zone.model_dump()

    if update.water_depth_m is not None:
        updated_values["water_depth_m"] = (
            update.water_depth_m
        )

    if update.rainfall_mm_per_hr is not None:
        updated_values["rainfall_mm_per_hr"] = (
            update.rainfall_mm_per_hr
        )

    if update.accessibility_percent is not None:
        updated_values["accessibility_percent"] = (
            update.accessibility_percent
        )

    updated_zone = Zone(**updated_values)

    updated_zones = [
        updated_zone
        if current_zone.id == zone_id
        else current_zone
        for current_zone in world_state.zones
    ]

    from backend.app.domain.world_state import WorldState

    updated_world_state = WorldState(
        current_time=world_state.current_time,
        disaster_active=world_state.disaster_active,
        zones=updated_zones,
    )

    world_state_store.replace_state(
        updated_world_state
    )

    return {
    "status": "updated",
    "zone": updated_zone,
    }


@app.post("/simulation/flood")
def run_flood_simulation():
    """
    Run the predefined flood escalation scenario
    and return risk progression for each step.
    """

    initial_state = create_demo_world_state()

    steps = create_flood_simulation()

    snapshots = analyze_simulation(
        initial_state,
        steps,
    )

    return {
        "simulation": "flood_escalation",
        "zone_id": "Z001",
        "steps": [
            {
                "step": snapshot.step_name,
                "risk_score": (
                    snapshot.assessment.risk_score
                ),
                "risk_level": (
                    snapshot.assessment.risk_level
                ),
                "factors": (
                    snapshot.assessment.factors
                ),
            }
            for snapshot in snapshots
        ],
    }


def create_demo_resources():
    from backend.app.domain.models.resources import (
        Resource,
    )

    return [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z002",
            quantity=2,
        ),
        Resource(
            id="RES001",
            resource_type="rescue_team",
            current_zone_id="Z002",
            quantity=2,
        ),
        Resource(
            id="BOAT001",
            resource_type="boat",
            current_zone_id="Z002",
            quantity=1,
        ),
    ]