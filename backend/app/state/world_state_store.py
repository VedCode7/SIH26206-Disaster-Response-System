from backend.app.domain.world_state import WorldState
from backend.app.engines.world_state_updater import (
    update_zone_conditions,
)


class WorldStateStore:
    """
    In-memory store containing the current operational world state.
    """

    def __init__(self, initial_state: WorldState | None = None):
        self._state = initial_state or WorldState()

    def get_state(self) -> WorldState:
        """
        Return the current world state.
        """
        return self._state

    def replace_state(self, state: WorldState) -> None:
        """
        Replace the current world state.
        """
        self._state = state

    def update_zone_conditions(
        self,
        zone_id: str,
        *,
        water_depth_m: float | None = None,
        rainfall_mm_per_hr: float | None = None,
        accessibility_percent: float | None = None,
    ) -> WorldState:
        """
        Update environmental conditions for a zone
        and make the updated state the current state.
        """

        updated_state = update_zone_conditions(
            self._state,
            zone_id,
            water_depth_m=water_depth_m,
            rainfall_mm_per_hr=rainfall_mm_per_hr,
            accessibility_percent=accessibility_percent,
        )

        self._state = updated_state

        return self._state