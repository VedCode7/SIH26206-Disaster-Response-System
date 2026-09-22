from backend.app.domain.models.resources import (
    Resource,
    ResourceAllocation,
    ResourceDemand,
)


def allocate_resources(
    resources: list[Resource],
    demands: list[ResourceDemand],
) -> list[ResourceAllocation]:
    """
    Allocate available resources to disaster-zone demands.

    Demands are handled in priority order, where priority 1
    is the most urgent.

    Resources are allocated individually so the resulting
    allocation preserves the real resource ID and source zone.
    A resource's quantity may be split across multiple demands.
    """

    remaining: dict[str, int] = {
        resource.id: resource.quantity
        for resource in resources
    }

    allocations: list[ResourceAllocation] = []

    sorted_demands = sorted(
        demands,
        key=lambda demand: demand.priority,
    )

    for demand in sorted_demands:
        for resource in resources:
            if resource.resource_type != demand.resource_type:
                continue

            available_quantity = remaining.get(resource.id, 0)

            if available_quantity <= 0:
                continue

            allocated_quantity = min(
                demand.quantity,
                available_quantity,
            )

            allocations.append(
                ResourceAllocation(
                    resource_id=resource.id,
                    resource_type=resource.resource_type,
                    source_zone_id=resource.current_zone_id,
                    destination_zone_id=demand.zone_id,
                    quantity=allocated_quantity,
                    priority=demand.priority,
                )
            )

            remaining[resource.id] -= allocated_quantity

            # One demand has been fully satisfied. Move on to the
            # next demand rather than consuming another resource.
            break

    return allocations
