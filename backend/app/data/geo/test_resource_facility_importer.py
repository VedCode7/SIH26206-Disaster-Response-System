from backend.app.data.geo.resource_facility_importer import (
    build_resource_query,
    resources_from_osm,
)


def _ward(ward_id: int, coordinates: list[list[list[float]]]):
    return {
        "type": "Feature",
        "properties": {"ward_id": ward_id},
        "geometry": {
            "type": "Polygon",
            "coordinates": coordinates,
        },
    }


def test_resource_query_requests_real_emergency_facilities():
    query = build_resource_query()

    assert '"amenity"="hospital"' in query
    assert '"amenity"="police"' in query
    assert '"amenity"="fire_station"' in query
    assert '"amenity"="shelter"' in query
    assert '"emergency"="ambulance_station"' in query
    assert "out center tags" in query


def test_resources_are_mapped_to_their_actual_ward():
    wards = [
        _ward(1, [[[80.10, 12.80], [80.20, 12.80], [80.20, 12.90], [80.10, 12.90], [80.10, 12.80]]]),
        _ward(2, [[[80.20, 12.80], [80.30, 12.80], [80.30, 12.90], [80.20, 12.90], [80.20, 12.80]]]),
    ]

    osm = {
        "elements": [
            {
                "type": "node",
                "id": 101,
                "lat": 12.85,
                "lon": 80.15,
                "tags": {"amenity": "hospital", "name": "Example Hospital"},
            },
            {
                "type": "node",
                "id": 102,
                "lat": 12.85,
                "lon": 80.25,
                "tags": {"amenity": "fire_station", "name": "Example Fire Station"},
            },
        ]
    }

    resources = resources_from_osm(osm, wards)

    assert len(resources) == 2
    assert resources[0]["id"] == "OSMN101"
    assert resources[0]["resource_type"] == "hospital"
    assert resources[0]["current_zone_id"] == "W1"
    assert resources[0]["source"] == "OpenStreetMap"
    assert resources[1]["resource_type"] == "fire_station"
    assert resources[1]["current_zone_id"] == "W2"
    assert all("quantity" not in resource for resource in resources)


def test_unmapped_facilities_are_not_assigned_to_a_fake_zone():
    wards = [
        _ward(1, [[[80.10, 12.80], [80.20, 12.80], [80.20, 12.90], [80.10, 12.90], [80.10, 12.80]]]),
    ]
    osm = {
        "elements": [
            {
                "type": "node",
                "id": 103,
                "lat": 13.00,
                "lon": 80.50,
                "tags": {"amenity": "hospital"},
            }
        ]
    }

    assert resources_from_osm(osm, wards) == []
