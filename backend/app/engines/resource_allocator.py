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

    Resources are allocated only when their resource type
    matches the requested demand.
    """

    available: dict[str, int] = {}
    resource_locations: dict[str, str] = {}

    for resource in resources:
        available[resource.resource_type] = (
            available.get(resource.resource_type, 0)
            + resource.quantity
        )

        resource_locations.setdefault(
            resource.resource_type,
            resource.current_zone_id,
        )

    allocations: list[ResourceAllocation] = []

    sorted_demands = sorted(
        demands,
        key=lambda demand: demand.priority,
    )

    allocation_counter = 1

    for demand in sorted_demands:
        available_quantity = available.get(
            demand.resource_type,
            0,
        )

        if available_quantity <= 0:
            continue

        allocated_quantity = min(
            demand.quantity,
            available_quantity,
        )

        allocation = ResourceAllocation(
            resource_id=(
                f"{demand.resource_type.upper()}"
                f"-ALLOC-{allocation_counter:03d}"
            ),
            resource_type=demand.resource_type,
            source_zone_id=resource_locations[
                demand.resource_type
            ],
            destination_zone_id=demand.zone_id,
            quantity=allocated_quantity,
            priority=demand.priority,
        )

        allocations.append(allocation)

        available[demand.resource_type] -= allocated_quantity

        allocation_counter += 1

    return allocations