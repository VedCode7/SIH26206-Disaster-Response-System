from backend.app.domain.models import Zone
from backend.app.domain.world_state import WorldState


def create_demo_world_state() -> WorldState:
    """
    Create a deterministic disaster scenario for development
    and demonstration purposes.
    """

    zones = [
        Zone(
            id="Z001",
            name="Riverside",
            population=5000,
            vulnerable_population=1200,
            water_depth_m=1.8,
            rainfall_mm_per_hr=120.0,
            accessibility_percent=35.0,
        ),
        Zone(
            id="Z002",
            name="Central District",
            population=3000,
            vulnerable_population=300,
            water_depth_m=0.4,
            rainfall_mm_per_hr=45.0,
            accessibility_percent=85.0,
        ),
        Zone(
            id="Z003",
            name="Hill View",
            population=1500,
            vulnerable_population=150,
            water_depth_m=0.1,
            rainfall_mm_per_hr=10.0,
            accessibility_percent=100.0,
        ),
        Zone(
            id="Z004",
            name="Lowland Colony",
            population=4500,
            vulnerable_population=1500,
            water_depth_m=1.2,
            rainfall_mm_per_hr=95.0,
            accessibility_percent=50.0,
        ),
    ]

    return WorldState(
        disaster_active=True,
        zones=zones,
    )