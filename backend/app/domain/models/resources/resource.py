from dataclasses import dataclass


class ResourceStatus:
    """Operational lifecycle states for individually tracked resources."""

    AVAILABLE = "available"
    RESERVED = "reserved"
    DISPATCHED = "dispatched"
    EN_ROUTE = "en_route"
    ON_SCENE = "on_scene"
    UNAVAILABLE = "unavailable"
    MAINTENANCE = "maintenance"
    UNKNOWN = "unknown"

    ALL = {
        AVAILABLE,
        RESERVED,
        DISPATCHED,
        EN_ROUTE,
        ON_SCENE,
        UNAVAILABLE,
        MAINTENANCE,
        UNKNOWN,
    }


class ResourceProvenance:
    """Declares how a resource record entered the system."""

    VERIFIED_OPERATIONAL = "verified_operational"
    SCENARIO = "scenario"
    UNKNOWN = "unknown"

    ALL = {
        VERIFIED_OPERATIONAL,
        SCENARIO,
        UNKNOWN,
    }


@dataclass(frozen=True)
class Resource:
    """
    A deployable disaster-response resource.

    A resource is deliberately separate from a mapped facility. Facility
    records describe geographic presence; this model describes something
    that may actually be allocated to an incident.

    ``provenance`` prevents scenario inventory from silently becoming live
    operational inventory. Individually tracked operational resources must
    use quantity=1 so an allocation can always identify the exact unit.
    """

    id: str
    resource_type: str
    current_zone_id: str
    quantity: int = 1
    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    source: str | None = None
    status: str = ResourceStatus.UNKNOWN
    provenance: str = ResourceProvenance.UNKNOWN
    last_verified_at: str | None = None
    operator: str | None = None
    capacity: int | None = None
    notes: str | None = None

    def __post_init__(self):
        if not self.id:
            raise ValueError("Resource id cannot be empty")

        if not self.resource_type:
            raise ValueError("resource_type cannot be empty")

        if not self.current_zone_id:
            raise ValueError("current_zone_id cannot be empty")

        if self.quantity <= 0:
            raise ValueError("quantity must be greater than zero")

        if self.latitude is not None and not -90 <= self.latitude <= 90:
            raise ValueError("latitude must be between -90 and 90")

        if self.longitude is not None and not -180 <= self.longitude <= 180:
            raise ValueError("longitude must be between -180 and 180")

        if self.status not in ResourceStatus.ALL:
            raise ValueError(f"Unsupported resource status: {self.status}")

        if self.provenance not in ResourceProvenance.ALL:
            raise ValueError(
                f"Unsupported resource provenance: {self.provenance}"
            )

        if self.provenance == ResourceProvenance.VERIFIED_OPERATIONAL:
            if self.quantity != 1:
                raise ValueError(
                    "Verified operational resources must be individually "
                    "tracked with quantity=1"
                )

        if self.capacity is not None and self.capacity <= 0:
            raise ValueError("capacity must be greater than zero")
