"""Application entrypoint with a raw world-state endpoint for the dashboard."""

from backend.app.main_core import *  # noqa: F401,F403


@app.get("/world/zones")
def get_zones():
    """Return the current raw zone measurements.

    These are physical/input values, not normalized risk-factor scores.
    """
    world_state = world_state_store.get_state()
    return {
        "zones": world_state.zones,
        "current_time": world_state.current_time,
        "disaster_active": world_state.disaster_active,
    }
