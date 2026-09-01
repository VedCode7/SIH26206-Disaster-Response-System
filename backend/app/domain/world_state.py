from datetime import datetime, timezone

from pydantic import BaseModel, Field

from backend.app.domain.models import Zone


class WorldState(BaseModel):
    """
    Represents the current operational state of the disaster environment.
    """

    current_time: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp representing the current world state.",
    )

    disaster_active: bool = Field(
        default=False,
        description="Whether a disaster is currently active.",
    )

    zones: list[Zone] = Field(
        default_factory=list,
        description="All zones currently tracked by the system.",
    )

    def get_zone(self, zone_id: str) -> Zone | None:
        """
        Return a zone by its unique ID.
        """
        for zone in self.zones:
            if zone.id == zone_id:
                return zone

        return None