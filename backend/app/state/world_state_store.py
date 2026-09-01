from backend.app.domain.world_state import WorldState


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