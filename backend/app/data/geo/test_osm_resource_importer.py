from backend.app.data.geo.osm_resource_importer import resources_from_osm


WARD_FEATURES = [
    {
        "type": "Feature",
        "properties": {"ward_id": 1},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[80.10, 12.90], [80.20, 12.90], [80.20, 13.00], [80.10, 13.00], [80.10, 12.90]]],
        },
    }
]


def test_imports_emergency_facilities_and_maps_them_to_ward():
    data = {
        "elements": [
            {
                "type": "node",
                "id": 101,
                "lat": 12.95,
                "lon": 80.15,
                "tags": {"amenity": "hospital", "name": "Example Hospital"},
            },
            {
                "type": "node",
                "id": 102,
                "lat": 12.96,
                "lon": 80.16,
                "tags": {"amenity": "fire_station", "name": "Example Fire Station"},
            },
        ]
    }

    result = resources_from_osm(data, WARD_FEATURES)

    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) == 2
    assert {f["properties"]["resource_type"] for f in result["features"]} == {
        "hospital",
        "fire_station",
    }
    assert {f["properties"]["zone_id"] for f in result["features"]} == {"W1"}


def test_ignores_facilities_outside_loaded_wards():
    data = {
        "elements": [
            {
                "type": "node",
                "id": 101,
                "lat": 13.10,
                "lon": 80.15,
                "tags": {"amenity": "hospital", "name": "Outside"},
            }
        ]
    }

    result = resources_from_osm(data, WARD_FEATURES)

    assert result["features"] == []


def test_does_not_infer_operational_unit_counts():
    data = {
        "elements": [
            {
                "type": "node",
                "id": 101,
                "lat": 12.95,
                "lon": 80.15,
                "tags": {"amenity": "hospital", "name": "Example Hospital"},
            }
        ]
    }

    result = resources_from_osm(data, WARD_FEATURES)
    properties = result["features"][0]["properties"]

    assert "quantity" not in properties
    assert properties["source"] == "OpenStreetMap"
