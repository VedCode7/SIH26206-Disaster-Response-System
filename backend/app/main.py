from fastapi import FastAPI, HTTPException

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


def create_demo_resources() -> list[Resource]:
    """
    Create demo emergency resources.

    These represent resources currently available
    to the disaster-response system.
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