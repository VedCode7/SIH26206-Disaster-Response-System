from fastapi import FastAPI, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.app.domain.models import Zone
from backend.app.domain.world_state import WorldState

from backend.app.engines.chennai_2015_response import (
    run_chennai_2015_response_simulation,
)
from backend.app.engines.disaster_simulator import create_flood_simulation
from backend.app.engines.facility_accessibility import rank_facility_accessibility
from backend.app.engines.response_coordinator import create_response_plan
from backend.app.engines.risk_analysis import analyze_world_risk
from backend.app.engines.routing_engine import calculate_route
from backend.app.engines.routing_graph import RoutingGraph
from backend.app.engines.simulation_analysis import analyze_simulation
from backend.app.engines.osm_route_geometry import build_route_geometry
from backend.app.state.initial_state import (
    create_demo_world_state,
    create_chennai_world_state,
)
from backend.app.state.road_network_store import RoadNetworkStore
from backend.app.state.world_state_store import WorldStateStore
from backend.app.data.geo.resource_facility_loader import load_resource_facilities
from backend.app.data.geo.chennai_response_inventory_loader import (
    load_chennai_response_inventory,
)
from backend.app.data.geo.road_loader import load_road_models
from backend.app.data.geo.ward_loader import load_ward_geojson
from backend.app.api.resource_registry import router as resource_registry_router


app = FastAPI(
    title="SIH26206 Disaster Response System",
    description=(
        "Prototype disaster response and "
        "decision-support backend."
    ),
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(resource_registry_router)


world_state_store = WorldStateStore(create_chennai_world_state())
road_network_store = RoadNetworkStore(load_road_models())
resource_facilities = load_resource_facilities()
chennai_response_resources = load_chennai_response_inventory()
routing_graph = RoutingGraph(road_network_store.get_roads())
routing_graph_signature = None


def _road_network_signature(roads):
    """Return a cheap immutable signature for route-affecting road state."""
    return hash(
        tuple(
            (road.id, road.blocked, road.accessibility_percent)
            for road in roads
        )
    )


def get_routing_graph() -> RoutingGraph:
    """Return a cached graph, rebuilding only after a road-state change."""
    global routing_graph, routing_graph_signature

    roads = road_network_store.get_roads()
    signature = _road_network_signature(roads)

    if routing_graph_signature != signature:
        routing_graph = RoutingGraph(roads)
        routing_graph_signature = signature

    return routing_graph


routing_graph_signature = _road_network_signature(
    road_network_store.get_roads()
)


class ZoneUpdateRequest(BaseModel):
    water_depth_m: float | None = Field(default=None, ge=0)
    rainfall_mm_per_hr: float | None = Field(default=None, ge=0)
    accessibility_percent: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )


class RoadUpdateRequest(BaseModel):
    accessibility_percent: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )
    blocked: bool | None = None


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "disaster-response-backend",
    }


@app.get("/risk/overview")
def get_risk_overview():
    return analyze_world_risk(world_state_store.get_state())


@app.get("/world/wards")
def get_wards():
    """Return the persisted Chennai ward boundaries as GeoJSON."""
    return load_ward_geojson()


@app.get("/world/facilities")
def get_facilities():
    """Return real geographically mapped Chennai facilities."""
    return {"facilities": resource_facilities}


@app.get("/world/facilities/accessible/{origin_zone_id}")
def get_accessible_facilities(
    origin_zone_id: str,
    facility_type: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Rank real facilities by accessibility from a Chennai ward."""
    if world_state_store.get_state().get_zone(origin_zone_id) is None:
        raise HTTPException(
            status_code=404,
            detail=f"Zone '{origin_zone_id}' not found",
        )

    return {
        "origin_zone_id": origin_zone_id,
        "facility_type": facility_type,
        "facilities": rank_facility_accessibility(
            origin_zone_id=origin_zone_id,
            facilities=resource_facilities,
            routing_graph=get_routing_graph(),
            facility_type=facility_type,
            limit=limit,
        ),
    }


@app.get("/world/facilities/{zone_id}")
def get_zone_facilities(zone_id: str):
    """Return real facilities mapped to a specific Chennai ward."""
    if world_state_store.get_state().get_zone(zone_id) is None:
        raise HTTPException(
            status_code=404,
            detail=f"Zone '{zone_id}' not found",
        )

    return {
        "zone_id": zone_id,
        "facilities": [
            facility
            for facility in resource_facilities
            if facility.current_zone_id == zone_id
        ],
    }


@app.get("/response/inventory/chennai-2015")
def get_chennai_response_inventory():
    """Return the explicitly simulated Chennai response inventory."""
    return {
        "scenario": "chennai_floods_2015",
        "status": "simulated",
        "resources": chennai_response_resources,
        "mapped_facilities": resource_facilities,
    }


@app.get("/response/plan/{zone_id}")
def get_response_plan(zone_id: str):
    world_state = world_state_store.get_state()
    overview = analyze_world_risk(world_state)

    assessment = next(
        (
            item
            for item in overview.assessments
            if item.zone_id == zone_id
        ),
        None,
    )

    if assessment is None:
        raise HTTPException(
            status_code=404,
            detail=f"Zone '{zone_id}' not found",
        )

    resources = (
        chennai_response_resources
        if zone_id.startswith("W")
        else create_demo_resources()
    )

    return create_response_plan(
        assessment=assessment,
        resources=resources,
        routing_graph=get_routing_graph(),
        facilities=resource_facilities,
    )


@app.post("/world/zones/{zone_id}/update")
def update_zone(
    zone_id: str,
    update: ZoneUpdateRequest,
):
    world_state = world_state_store.get_state()
    zone = world_state.get_zone(zone_id)

    if zone is None:
        raise HTTPException(
            status_code=404,
            detail=f"Zone '{zone_id}' not found",
        )

    updated_values = zone.model_dump()

    if update.water_depth_m is not None:
        updated_values["water_depth_m"] = update.water_depth_m

    if update.rainfall_mm_per_hr is not None:
        updated_values["rainfall_mm_per_hr"] = update.rainfall_mm_per_hr

    if update.accessibility_percent is not None:
        updated_values["accessibility_percent"] = (
            update.accessibility_percent
        )

    updated_zone = Zone(**updated_values)

    updated_zones = [
        (
            updated_zone
            if current_zone.id == zone_id
            else current_zone
        )
        for current_zone in world_state.zones
    ]

    world_state_store.replace_state(
        WorldState(
            current_time=world_state.current_time,
            disaster_active=world_state.disaster_active,
            zones=updated_zones,
        )
    )

    return {
        "status": "updated",
        "zone": updated_zone,
    }


@app.post("/world/roads/{road_id}/update")
def update_road(
    road_id: str,
    update: RoadUpdateRequest,
):
    global routing_graph, routing_graph_signature

    road = road_network_store.get_road(road_id)

    if road is None:
        raise HTTPException(
            status_code=404,
            detail=f"Road '{road_id}' not found",
        )

    updated_road = road_network_store.update_road(
        road_id,
        accessibility_percent=update.accessibility_percent,
        blocked=update.blocked,
    )
    routing_graph = RoutingGraph(road_network_store.get_roads())
    routing_graph_signature = _road_network_signature(
        road_network_store.get_roads()
    )

    return {
        "status": "updated",
        "road": updated_road,
    }


@app.get("/world/roads")
def get_roads():
    return {"roads": road_network_store.get_roads()}


@app.get("/route/{origin_zone_id}/{destination_zone_id}")
def get_route(
    origin_zone_id: str,
    destination_zone_id: str,
):
    route = calculate_route(
        get_routing_graph(),
        origin_zone_id,
        destination_zone_id,
    )

    if route is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No route available from "
                f"'{origin_zone_id}' to "
                f"'{destination_zone_id}'"
            ),
        )

    return route


@app.get("/route/{origin_zone_id}/{destination_zone_id}/geometry")
def get_route_geometry(
    origin_zone_id: str,
    destination_zone_id: str,
):
    """
    Return the physical OSM road LineString for an existing disaster-aware route.

    The authoritative route selection remains the normal /route endpoint.
    This endpoint only reconstructs the visual path through the local raw OSM
    network, including real road connections inside intermediate wards.
    """
    route = calculate_route(
        get_routing_graph(),
        origin_zone_id,
        destination_zone_id,
    )

    if route is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No route available from "
                f"'{origin_zone_id}' to "
                f"'{destination_zone_id}'"
            ),
        )

    ward_data = load_ward_geojson()
    geometry = build_route_geometry(
        route=route,
        roads=road_network_store.get_roads(),
        ward_features=ward_data.get("features", []),
    )

    if geometry is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Real OSM route geometry is unavailable. "
                "The local chennai_roads_osm.json source is required."
            ),
        )

    return {
        "origin_zone_id": route.origin_zone_id,
        "destination_zone_id": route.destination_zone_id,
        "geometry": geometry,
    }


@app.post("/simulation/flood")
def run_flood_simulation():
    """Run the predefined demo flood escalation scenario."""
    initial_state = create_demo_world_state()
    steps = create_flood_simulation()
    snapshots = analyze_simulation(initial_state, steps)

    return {
        "simulation": "flood_escalation",
        "zone_id": "Z001",
        "steps": [
            {
                "step": snapshot.step_name,
                "risk_score": snapshot.assessment.risk_score,
                "risk_level": snapshot.assessment.risk_level,
                "factors": snapshot.assessment.factors,
            }
            for snapshot in snapshots
        ],
    }


def create_demo_resources():
    from backend.app.domain.models.resources import Resource

    return [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z002",
            quantity=2,
        ),
        Resource(
            id="RES001",
            resource_type="rescue_team",
            current_zone_id="Z002",
            quantity=2,
        ),
        Resource(
            id="BOAT001",
            resource_type="boat",
            current_zone_id="Z002",
            quantity=1,
        ),
    ]


@app.post("/simulation/flood/response")
def run_flood_response_simulation():
    """Run the demo flood escalation and generate response plans."""
    from backend.app.engines.simulation_response import (
        analyze_simulation_response,
    )

    initial_state = create_demo_world_state()
    steps = create_flood_simulation()
    resources = create_demo_resources()

    snapshots = analyze_simulation_response(
        initial_state=initial_state,
        steps=steps,
        resources=resources,
        routing_graph=get_routing_graph(),
    )

    return {
        "simulation": "flood_escalation",
        "zone_id": "Z001",
        "steps": [
            {
                "step": snapshot.step_name,
                "risk_score": snapshot.assessment.risk_score,
                "risk_level": snapshot.assessment.risk_level,
                "factors": snapshot.assessment.factors,
                "actions": snapshot.response_plan.actions,
                "allocations": snapshot.response_plan.allocations,
                "deployments": snapshot.response_plan.deployments,
            }
            for snapshot in snapshots
        ],
    }


@app.post("/simulation/chennai-2015/response")
def run_chennai_2015_response():
    """
    Replay the December 2015 Chennai flood event against the
    current 200-ward geography and road network.

    Historical anchors are used as scenario inputs; ward-level
    flood depths and road impacts are deterministic model outputs,
    not claimed historical observations. Operational resource
    quantities come from the explicitly simulated scenario inventory.
    """
    initial_state = create_chennai_world_state()

    snapshots = run_chennai_2015_response_simulation(
        initial_state=initial_state,
        roads=road_network_store.get_roads(),
        resources=chennai_response_resources,
        facilities=resource_facilities,
    )

    return {
        "simulation": "chennai_floods_2015",
        "title": "Chennai Floods — December 2015",
        "historical_context": {
            "november_2015_rainfall_mm": 1049.0,
            "peak_24h_rainfall_mm": 294.1,
            "peak_date": "2 Dec 2015",
            "chembarambakkam_release_cusecs": 29000,
            "model_note": (
                "Historical anchors are combined with current Chennai "
                "ward geometry and OSM routing data. Ward-level impacts "
                "are deterministic reconstruction outputs. Operational "
                "resource quantities are explicit simulation assumptions."
            ),
        },
        "stages": jsonable_encoder(snapshots),
    }
