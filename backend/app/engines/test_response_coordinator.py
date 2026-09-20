from backend.app.domain.models.resources import Resource, ResourceFacility
from backend.app.domain.models.risk import (
    RiskAssessment,
    RiskFactors,
)
from backend.app.domain.models.routing import Road
from backend.app.domain.models.zone import RiskLevel
from backend.app.engines.response_coordinator import (
    create_response_plan,
)
from backend.app.engines.routing_graph import RoutingGraph


def make_assessment(
    zone_id: str,
    risk_level: RiskLevel,
) -> RiskAssessment:
    return RiskAssessment(
        zone_id=zone_id,
        risk_score=(
            90.0
            if risk_level == RiskLevel.CRITICAL
            else 60.0
        ),
        risk_level=risk_level,
        factors=RiskFactors(
            water=80.0,
            rainfall=70.0,
            vulnerability=30.0,
            population=50.0,
            accessibility_risk=60.0,
        ),
    )


def make_resources():
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


def make_graph():
    return RoutingGraph(
        [
            Road(
                id="R001",
                from_zone_id="Z002",
                to_zone_id="Z001",
                distance_km=5.0,
                travel_time_min=10.0,
            )
        ]
    )


def test_coordinator_combines_risk_actions_and_resources():
    assessment = make_assessment(
        "Z001",
        RiskLevel.CRITICAL,
    )

    plan = create_response_plan(
        assessment=assessment,
        resources=make_resources(),
    )

    assert plan.zone_id == "Z001"
    assert plan.risk_level == "critical"

    assert len(plan.actions) == 2
    assert len(plan.allocations) == 3
    assert plan.deployments == ()

    allocation_types = {
        allocation.resource_type
        for allocation in plan.allocations
    }

    assert "ambulance" in allocation_types
    assert "rescue_team" in allocation_types
    assert "boat" in allocation_types


def test_coordinator_creates_deployments_when_graph_is_provided():
    assessment = make_assessment(
        "Z001",
        RiskLevel.CRITICAL,
    )

    plan = create_response_plan(
        assessment=assessment,
        resources=make_resources(),
        routing_graph=make_graph(),
    )

    assert len(plan.allocations) == 3
    assert len(plan.deployments) == 3

    for deployment in plan.deployments:
        assert (
            deployment.allocation.destination_zone_id
            == "Z001"
        )

        assert (
            deployment.route.origin_zone_id
            == deployment.allocation.source_zone_id
        )

        assert (
            deployment.route.destination_zone_id
            == deployment.allocation.destination_zone_id
        )


def test_coordinator_only_includes_allocations_for_assessed_zone():
    assessment = make_assessment(
        "Z001",
        RiskLevel.HIGH,
    )

    resources = [
        Resource(
            id="AMB001",
            resource_type="ambulance",
            current_zone_id="Z003",
            quantity=3,
        ),
    ]

    plan = create_response_plan(
        assessment=assessment,
        resources=resources,
    )

    assert all(
        allocation.destination_zone_id == "Z001"
        for allocation in plan.allocations
    )


def test_coordinator_can_create_plan_without_resources():
    assessment = make_assessment(
        "Z001",
        RiskLevel.CRITICAL,
    )

    plan = create_response_plan(
        assessment=assessment,
        resources=[],
    )

    assert plan.zone_id == "Z001"
    assert plan.risk_level == "critical"
    assert len(plan.actions) == 2
    assert plan.allocations == ()
    assert plan.deployments == ()


def test_coordinator_attaches_only_facilities_in_assessed_zone():
    assessment = make_assessment(
        "Z001",
        RiskLevel.HIGH,
    )

    facilities = [
        ResourceFacility(
            id="OSMN001",
            resource_type="hospital",
            current_zone_id="Z001",
            name="Zone One Hospital",
            latitude=12.85,
            longitude=80.15,
            source="OpenStreetMap",
        ),
        ResourceFacility(
            id="OSMN002",
            resource_type="fire_station",
            current_zone_id="Z002",
            name="Zone Two Fire Station",
            latitude=12.86,
            longitude=80.25,
            source="OpenStreetMap",
        ),
    ]

    plan = create_response_plan(
        assessment=assessment,
        resources=[],
        facilities=facilities,
    )

    assert len(plan.facilities) == 1
    assert plan.facilities[0].id == "OSMN001"
    assert plan.facilities[0].current_zone_id == "Z001"
    assert not hasattr(plan.facilities[0], "quantity")


def test_coordinator_ranks_facilities_using_current_routing_graph():
    assessment = make_assessment(
        "Z001",
        RiskLevel.HIGH,
    )

    facilities = [
        ResourceFacility(
            id="OSMN001",
            resource_type="hospital",
            current_zone_id="Z001",
            name="Zone One Hospital",
            latitude=12.85,
            longitude=80.15,
            source="OpenStreetMap",
        ),
        ResourceFacility(
            id="OSMN002",
            resource_type="fire_station",
            current_zone_id="Z002",
            name="Zone Two Fire Station",
            latitude=12.86,
            longitude=80.25,
            source="OpenStreetMap",
        ),
    ]

    plan = create_response_plan(
        assessment=assessment,
        resources=[],
        routing_graph=make_graph(),
        facilities=facilities,
    )

    assert len(plan.facility_recommendations) == 2
    assert plan.facility_recommendations[0].facility_id == "OSMN001"
    assert plan.facility_recommendations[0].accessible is True
    assert plan.facility_recommendations[0].total_travel_time_min == 0.0
    assert plan.facility_recommendations[1].facility_id == "OSMN002"
    assert plan.facility_recommendations[1].accessible is True
    assert plan.facility_recommendations[1].total_distance_km == 5.0
    assert plan.facility_recommendations[1].total_travel_time_min == 10.0
