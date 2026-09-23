from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from backend.app.domain.models.resources import (
    Resource,
    ResourceProvenance,
    ResourceStatus,
)
from backend.app.engines.response_coordinator import operational_resource_registry


router = APIRouter(
    prefix="/resources/operational",
    tags=["operational resources"],
)


class OperationalResourceCreateRequest(BaseModel):
    """Operator-supplied metadata required to register a live resource."""

    id: str = Field(min_length=1)
    resource_type: str = Field(min_length=1)
    current_zone_id: str = Field(min_length=1)
    name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    source: str = Field(min_length=1)
    status: str = ResourceStatus.AVAILABLE
    last_verified_at: str = Field(min_length=1)
    operator: str = Field(min_length=1)
    capacity: int | None = Field(default=None, gt=0)
    notes: str | None = None


class OperationalResourceUpdateRequest(BaseModel):
    """Mutable fields for an already verified operational resource."""

    current_zone_id: str | None = Field(default=None, min_length=1)
    name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    source: str | None = Field(default=None, min_length=1)
    status: str | None = None
    last_verified_at: str | None = Field(default=None, min_length=1)
    operator: str | None = Field(default=None, min_length=1)
    capacity: int | None = Field(default=None, gt=0)
    notes: str | None = None


def _zone_exists(zone_id: str) -> bool:
    """Validate against the application's current geographic world state."""
    from backend.app.main import world_state_store

    return world_state_store.get_state().get_zone(zone_id) is not None


def _validate_status(resource_status: str) -> None:
    if resource_status not in ResourceStatus.ALL:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported resource status: {resource_status}",
        )


@router.get("")
def list_operational_resources(
    resource_type: str | None = Query(default=None),
    resource_status: str | None = Query(default=None, alias="status"),
):
    """List verified operational resources, with optional filters."""
    if resource_status is not None:
        _validate_status(resource_status)

    return {
        "resources": operational_resource_registry.list(
            operational_only=True,
            status=resource_status,
            resource_type=resource_type,
        )
    }


@router.get("/summary")
def get_operational_resource_summary():
    """Return lifecycle counts for verified operational resources only."""
    return operational_resource_registry.summary()


@router.get("/{resource_id}")
def get_operational_resource(resource_id: str):
    """Return one verified operational resource by its stable ID."""
    resource = operational_resource_registry.get(resource_id)

    if resource is None or resource.provenance != ResourceProvenance.VERIFIED_OPERATIONAL:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operational resource '{resource_id}' not found",
        )

    return resource


@router.post("", status_code=status.HTTP_201_CREATED)
def register_operational_resource(
    request: OperationalResourceCreateRequest,
):
    """
    Register one individually tracked, verified operational resource.

    The API deliberately does not accept provenance or aggregate quantity.
    Registration always creates a quantity=1 verified-operational record.
    Authentication/authorization is not implemented by this endpoint yet;
    ``operator`` is currently audit metadata supplied by the caller.
    """
    if not _zone_exists(request.current_zone_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone '{request.current_zone_id}' not found",
        )

    if operational_resource_registry.get(request.id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Resource '{request.id}' already exists",
        )

    try:
        resource = Resource(
            id=request.id,
            resource_type=request.resource_type,
            current_zone_id=request.current_zone_id,
            quantity=1,
            name=request.name,
            latitude=request.latitude,
            longitude=request.longitude,
            source=request.source,
            status=request.status,
            provenance=ResourceProvenance.VERIFIED_OPERATIONAL,
            last_verified_at=request.last_verified_at,
            operator=request.operator,
            capacity=request.capacity,
            notes=request.notes,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    operational_resource_registry.add(resource)

    return {
        "status": "registered",
        "resource": resource,
    }


@router.patch("/{resource_id}")
def update_operational_resource(
    resource_id: str,
    request: OperationalResourceUpdateRequest,
):
    """Update lifecycle/location/verification metadata without changing identity."""
    resource = operational_resource_registry.get(resource_id)

    if resource is None or resource.provenance != ResourceProvenance.VERIFIED_OPERATIONAL:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operational resource '{resource_id}' not found",
        )

    changes = request.model_dump(exclude_unset=True)

    if "current_zone_id" in changes and not _zone_exists(changes["current_zone_id"]):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Zone '{changes['current_zone_id']}' not found",
        )

    if "status" in changes:
        _validate_status(changes["status"])

    if not changes:
        return resource

    try:
        updated = operational_resource_registry.update(resource_id, **changes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return {
        "status": "updated",
        "resource": updated,
    }
