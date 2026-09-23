from dataclasses import replace
from threading import RLock

from backend.app.domain.models.resources.resource import (
    Resource,
    ResourceProvenance,
    ResourceStatus,
)


class ResourceRegistry:
    """
    In-memory registry for deployable resources.

    The registry is intentionally separate from mapped facilities and from
    historical scenario inventory. Only records explicitly marked as
    ``verified_operational`` are eligible for live allocation.
    """

    def __init__(self, resources: list[Resource] | None = None):
        self._lock = RLock()
        self._resources: dict[str, Resource] = {}
        for resource in resources or []:
            self.add(resource)

    def add(self, resource: Resource) -> Resource:
        with self._lock:
            if resource.id in self._resources:
                raise ValueError(f"Resource '{resource.id}' already exists")
            self._resources[resource.id] = resource
            return resource

    def upsert(self, resource: Resource) -> Resource:
        with self._lock:
            self._resources[resource.id] = resource
            return resource

    def get(self, resource_id: str) -> Resource | None:
        with self._lock:
            return self._resources.get(resource_id)

    def list(
        self,
        *,
        operational_only: bool = False,
        status: str | None = None,
        resource_type: str | None = None,
    ) -> list[Resource]:
        with self._lock:
            resources = list(self._resources.values())

        if operational_only:
            resources = [
                resource
                for resource in resources
                if resource.provenance
                == ResourceProvenance.VERIFIED_OPERATIONAL
            ]

        if status is not None:
            resources = [
                resource for resource in resources if resource.status == status
            ]

        if resource_type is not None:
            resources = [
                resource
                for resource in resources
                if resource.resource_type == resource_type
            ]

        return sorted(resources, key=lambda resource: resource.id)

    def available(
        self,
        resource_type: str | None = None,
    ) -> list[Resource]:
        return self.list(
            operational_only=True,
            status=ResourceStatus.AVAILABLE,
            resource_type=resource_type,
        )

    def update(
        self,
        resource_id: str,
        **changes,
    ) -> Resource:
        with self._lock:
            resource = self._resources.get(resource_id)
            if resource is None:
                raise KeyError(resource_id)

            updated = replace(resource, **changes)
            self._resources[resource_id] = updated
            return updated

    def replace_all(self, resources: list[Resource]) -> None:
        with self._lock:
            self._resources = {}
            for resource in resources:
                if resource.id in self._resources:
                    raise ValueError(
                        f"Resource '{resource.id}' already exists"
                    )
                self._resources[resource.id] = resource

    def summary(self) -> dict[str, int]:
        resources = self.list(operational_only=True)
        return {
            "total": len(resources),
            "available": sum(
                resource.status == ResourceStatus.AVAILABLE
                for resource in resources
            ),
            "reserved": sum(
                resource.status == ResourceStatus.RESERVED
                for resource in resources
            ),
            "dispatched": sum(
                resource.status == ResourceStatus.DISPATCHED
                for resource in resources
            ),
            "en_route": sum(
                resource.status == ResourceStatus.EN_ROUTE
                for resource in resources
            ),
            "on_scene": sum(
                resource.status == ResourceStatus.ON_SCENE
                for resource in resources
            ),
            "unavailable": sum(
                resource.status == ResourceStatus.UNAVAILABLE
                for resource in resources
            ),
            "maintenance": sum(
                resource.status == ResourceStatus.MAINTENANCE
                for resource in resources
            ),
            "unknown": sum(
                resource.status == ResourceStatus.UNKNOWN
                for resource in resources
            ),
        }
