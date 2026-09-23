import json

from backend.app.domain.models.routing import Road, RouteResult
from backend.app.engines.osm_route_geometry import build_route_geometry


def _write_osm(tmp_path):
    data = {
        "version": 0.6,
        "elements": [
            {
                "type": "way",
                "id": 100,
                "tags": {"highway": "residential"},
                "geometry": [
                    {"lon": 0.0, "lat": 0.0},
                    {"lon": 1.0, "lat": 0.0},
                ],
            },
            {
                "type": "way",
                "id": 200,
                "tags": {"highway": "residential"},
                "geometry": [
                    {"lon": 1.0, "lat": 1.0},
                    {"lon": 2.0, "lat": 1.0},
                ],
            },
            {
                "type": "way",
                "id": 300,
                "tags": {"highway": "residential"},
                "geometry": [
                    {"lon": 1.0, "lat": 0.0},
                    {"lon": 1.0, "lat": 0.5},
                    {"lon": 1.0, "lat": 1.0},
                ],
            },
        ],
    }
    path = tmp_path / "roads.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


def test_build_route_geometry_uses_real_osm_connector(tmp_path):
    osm_path = _write_osm(tmp_path)

    roads = [
        Road(
            id="OSM100_0",
            from_zone_id="W1",
            to_zone_id="W2",
            distance_km=1.0,
            travel_time_min=1.0,
            path=((0.0, 0.0), (1.0, 0.0)),
        ),
        Road(
            id="OSM200_0",
            from_zone_id="W2",
            to_zone_id="W3",
            distance_km=1.0,
            travel_time_min=1.0,
            path=((1.0, 1.0), (2.0, 1.0)),
        ),
    ]

    route = RouteResult(
        origin_zone_id="W1",
        destination_zone_id="W3",
        zone_path=("W1", "W2", "W3"),
        road_path=("OSM100_0", "OSM200_0"),
        total_distance_km=2.0,
        total_travel_time_min=2.0,
    )

    geometry = build_route_geometry(route, roads, osm_path=osm_path)

    assert geometry is not None
    assert geometry["source"] == "osm-road-network"
    assert geometry["coordinates"] == [
        [0.0, 0.0],
        [1.0, 0.0],
        [1.0, 0.5],
        [1.0, 1.0],
        [2.0, 1.0],
    ]


def test_build_route_geometry_respects_oneway_connectors(tmp_path):
    data = {
        "elements": [
            {
                "type": "way",
                "id": 100,
                "tags": {"highway": "residential"},
                "geometry": [
                    {"lon": 0.0, "lat": 0.0},
                    {"lon": 1.0, "lat": 0.0},
                ],
            },
            {
                "type": "way",
                "id": 200,
                "tags": {"highway": "residential"},
                "geometry": [
                    {"lon": 1.0, "lat": 1.0},
                    {"lon": 2.0, "lat": 1.0},
                ],
            },
            {
                "type": "way",
                "id": 300,
                "tags": {"highway": "residential", "oneway": "yes"},
                "geometry": [
                    {"lon": 1.0, "lat": 1.0},
                    {"lon": 1.0, "lat": 0.5},
                    {"lon": 1.0, "lat": 0.0},
                ],
            },
        ]
    }
    path = tmp_path / "roads-oneway.json"
    path.write_text(json.dumps(data), encoding="utf-8")

    roads = [
        Road(
            id="OSM100_0",
            from_zone_id="W1",
            to_zone_id="W2",
            distance_km=1.0,
            travel_time_min=1.0,
            path=((0.0, 0.0), (1.0, 0.0)),
        ),
        Road(
            id="OSM200_0",
            from_zone_id="W2",
            to_zone_id="W3",
            distance_km=1.0,
            travel_time_min=1.0,
            path=((1.0, 1.0), (2.0, 1.0)),
        ),
    ]

    route = RouteResult(
        origin_zone_id="W1",
        destination_zone_id="W3",
        zone_path=("W1", "W2", "W3"),
        road_path=("OSM100_0", "OSM200_0"),
        total_distance_km=2.0,
        total_travel_time_min=2.0,
    )

    assert build_route_geometry(route, roads, osm_path=path) is None


def test_build_route_geometry_returns_none_without_local_osm_source(tmp_path):
    roads = [
        Road(
            id="OSM100_0",
            from_zone_id="W1",
            to_zone_id="W2",
            distance_km=1.0,
            travel_time_min=1.0,
            path=((0.0, 0.0), (1.0, 0.0)),
        )
    ]
    route = RouteResult(
        origin_zone_id="W1",
        destination_zone_id="W2",
        zone_path=("W1", "W2"),
        road_path=("OSM100_0",),
        total_distance_km=1.0,
        total_travel_time_min=1.0,
    )

    assert build_route_geometry(
        route,
        roads,
        osm_path=tmp_path / "missing.json",
    ) is None
