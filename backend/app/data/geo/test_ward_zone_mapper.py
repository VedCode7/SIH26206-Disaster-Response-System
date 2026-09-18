from backend.app.data.geo.ward_loader import load_wards
from backend.app.data.geo.ward_zone_mapper import (
    ward_feature_to_zone,
    wards_to_zones,
)


def test_ward_feature_to_zone():
    ward = load_wards()[0]

    zone = ward_feature_to_zone(ward)

    assert zone.id.startswith("W")
    assert zone.name.startswith("Ward ")
    assert zone.population == 44859
    assert zone.vulnerable_population == 0
    assert zone.geometry is not None
    assert zone.geometry["type"] == "Polygon"


def test_wards_to_zones():
    wards = load_wards()

    zones = wards_to_zones(wards)

    assert len(zones) == 200
    assert all(zone.geometry is not None for zone in zones)
    assert len({zone.id for zone in zones}) == 200