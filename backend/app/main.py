from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from backend.app.domain.models.resources import (
    Resource,
    ResourceDemand,
)
from backend.app.engines.response_coordinator import (
    create_response_plan,
)
from backend.app.engines.risk_analysis import (
    analyze_world_risk,
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


class ZoneConditionUpdate(BaseModel):
    """
    Environmental measurements used to update a zone.
    """

    water_depth_m: float | None = Field(
        default=None,
        ge=0,
        description="Current flood-water depth in metres.",
    )

    rainfall_mm_per_hr: float | None = Field(
        default=None,
        ge=0,
        description="Current rainfall intensity.",
    )

    accessibility_percent: float | None = Field(
        default=None,
        ge=0,
        le=100,
        description="Percentage of normal access available.",
    )


def create_demo_resources() -> list[Resource]:
    """
    Create demo emergency resources.
    """

    return [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z003",
            quantity=2,
        ),
        Resource(
            id="RES001",
            resource_type="rescue_team",
            current_zone_id="Z002",
            quantity=1,
        ),
        Resource(
            id="BOAT001",
            resource_type="boat",
            current_zone_id="Z003",
            quantity=1,
        ),
    ]


def create_demo_demands(
    zone_id: str,
) -> list[ResourceDemand]:
    """
    Create demo resource demands for a zone.
    """

    return [
        ResourceDemand(
            zone_id=zone_id,
            resource_type="ambulance",
            quantity=1,
            priority=1,
        ),
        ResourceDemand(
            zone_id=zone_id,
            resource_type="rescue_team",
            quantity=1,
            priority=1,
        ),
    ]


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

    overview = analyze_world_risk(world_state)

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
    demands = create_demo_demands(zone_id)

    plan = create_response_plan(
        assessment=assessment,
        resources=resources,
        demands=demands,
    )

    return plan


@app.post("/world/zones/{zone_id}/update")
def update_zone(
    zone_id: str,
    update: ZoneConditionUpdate,
):
    try:
        updated_state = world_state_store.update_zone_conditions(
            zone_id,
            water_depth_m=update.water_depth_m,
            rainfall_mm_per_hr=update.rainfall_mm_per_hr,
            accessibility_percent=update.accessibility_percent,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc

    zone = updated_state.get_zone(zone_id)

    return {
        "status": "updated",
        "zone": zone,
        "current_time": updated_state.current_time,
    }