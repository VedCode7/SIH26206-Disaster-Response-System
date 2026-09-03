from backend.app.domain.models.routing import Road


class RoadNetworkStore:
    """
    In-memory store containing the current operational
    road network.
    """

    def __init__(self, initial_roads: list[Road] | None = None):
        self._roads = list(initial_roads or [])

    def get_roads(self) -> list[Road]:
        """
        Return the current road network.
        """
        return list(self._roads)

    def get_road(self, road_id: str) -> Road | None:
        """
        Return a road by ID, or None when it does not exist.
        """
        for road in self._roads:
            if road.id == road_id:
                return road

        return None

    def replace_roads(self, roads: list[Road]) -> None:
        """
        Replace the current road network.
        """
        self._roads = list(roads)

    def update_road(
        self,
        road_id: str,
        *,
        accessibility_percent: float | None = None,
        blocked: bool | None = None,
    ) -> Road:
        """
        Update the current condition of a road.

        Only explicitly supplied values are changed.
        """

        road = self.get_road(road_id)

        if road is None:
            raise ValueError(
                f"Road '{road_id}' not found"
            )

        updated_road = Road(
            id=road.id,
            from_zone_id=road.from_zone_id,
            to_zone_id=road.to_zone_id,
            distance_km=road.distance_km,
            travel_time_min=road.travel_time_min,
            accessibility_percent=(
                road.accessibility_percent
                if accessibility_percent is None
                else accessibility_percent
            ),
            blocked=(
                road.blocked
                if blocked is None
                else blocked
            ),
        )

        updated_roads = [
            updated_road
            if current_road.id == road_id
            else current_road
            for current_road in self._roads
        ]

        self._roads = updated_roads

        return updated_road