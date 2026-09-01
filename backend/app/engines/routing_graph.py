from collections import defaultdict

from backend.app.domain.models.routing import Road


class RoutingGraph:
    """
    In-memory graph representing the currently available road network.
    """

    def __init__(self, roads: list[Road]):
        self._roads = roads
        self._adjacency: dict[str, list[Road]] = defaultdict(list)

        self._build_graph()

    def _build_graph(self) -> None:
        for road in self._roads:
            if road.blocked:
                continue

            self._adjacency[road.from_zone_id].append(road)
            self._adjacency[road.to_zone_id].append(road)

    def neighbors(self, zone_id: str) -> list[Road]:
        """
        Return all currently traversable roads connected to a zone.
        """
        return list(self._adjacency.get(zone_id, []))

    def has_zone(self, zone_id: str) -> bool:
        """
        Return True if the zone exists in the graph.
        """
        return zone_id in self._adjacency