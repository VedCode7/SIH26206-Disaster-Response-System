from fastapi import FastAPI

from backend.app.engines.risk_analysis import analyze_world_risk
from backend.app.state.initial_state import create_demo_world_state
from backend.app.state.world_state_store import WorldStateStore


app = FastAPI(
    title="SIH26206 Disaster Response System",
    description="Prototype disaster response and decision-support backend.",
    version="0.1.0",
)


world_state_store = WorldStateStore(
    create_demo_world_state()
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