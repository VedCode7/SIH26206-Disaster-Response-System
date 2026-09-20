/*
 * Real Chennai Dashboard integration.
 *
 * The dashboard used to update its counters from the real Chennai
 * risk overview while leaving the original four-zone demo SVG in place.
 * This module now replaces that demo visualization with the persisted
 * Chennai ward boundaries and real OSM road paths, and explicitly
 * initializes the live dashboard so it cannot fall back to Z001-Z004.
 */

let realDashboardGeoCache = null;
let realDashboardAssessments = new Map();
let selectedZoneId = null;

function getHighestRiskAssessment(overview) {
    const assessments = Array.isArray(overview?.assessments) ? overview.assessments : [];
    if (!assessments.length) return null;
    return assessments.reduce((highest, current) =>
        Number(current.risk_score ?? 0) > Number(highest.risk_score ?? 0) ? current : highest
    );
}

function updateDashboard(overview) {
    const assessments = Array.isArray(overview?.assessments) ? overview.assessments : [];

    realDashboardAssessments = new Map(
        assessments.map((assessment) => [assessment.zone_id, assessment])
    );

    setText(".stat-card:nth-child(1) .stat-value", overview?.total_zones ?? assessments.length);
    setText(".stat-card:nth-child(2) .stat-value", overview?.critical_count ?? 0);

    const highest = getHighestRiskAssessment(overview);
    const selected = selectedZoneId ? realDashboardAssessments.get(selectedZoneId) : null;
    if (selected) {
        updateHighestRisk(selected);
    } else if (highest) {
        selectedZoneId = highest.zone_id;
        updateHighestRisk(highest);
    }

    renderRealChennaiMap(assessments).catch((error) => {
        console.error("Could not render Chennai dashboard map:", error);
    });
}

async function renderRealChennaiMap(assessments) {
    const mapArea = getElement(".map-area");
    if (!mapArea) return;

    if (!realDashboardGeoCache) {
        const [wardGeoJSON, roadData] = await Promise.all([
            fetchJSON("/world/wards"),
            fetchJSON("/world/roads"),
        ]);
        realDashboardGeoCache = {
            wards: Array.isArray(wardGeoJSON?.features) ? wardGeoJSON.features : [],
            roads: Array.isArray(roadData?.roads) ? roadData.roads : [],
        };
    }

    const { wards, roads } = realDashboardGeoCache;
    if (!wards.length || !roads.length) {
        throw new Error("Real Chennai ward or road geometry is unavailable.");
    }

    const assessmentByZone = new Map(
        assessments.map((assessment) => [assessment.zone_id, assessment])
    );
    realDashboardAssessments = assessmentByZone;

    const allPoints = [];
    roads.forEach((road) => {
        if (Array.isArray(road.path)) {
            road.path.forEach((point) => {
                if (Array.isArray(point) && point.length >= 2) {
                    allPoints.push([Number(point[0]), Number(point[1])]);
                }
            });
        }
    });

    if (!allPoints.length) {
        throw new Error("Real Chennai road geometry contains no coordinates.");
    }

    const width = 900;
    const height = 330;
    const padding = 18;

    const longitudes = allPoints.map((point) => point[0]);
    const latitudes = allPoints.map((point) => point[1]);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);

    const lonSpan = Math.max(maxLon - minLon, 0.000001);
    const latSpan = Math.max(maxLat - minLat, 0.000001);
    const scale = Math.min(
        (width - padding * 2) / lonSpan,
        (height - padding * 2) / latSpan
    );

    const drawnWidth = lonSpan * scale;
    const drawnHeight = latSpan * scale;
    const offsetX = (width - drawnWidth) / 2;
    const offsetY = (height - drawnHeight) / 2;

    const project = (lon, lat) => [
        offsetX + (Number(lon) - minLon) * scale,
        height - (offsetY + (Number(lat) - minLat) * scale),
    ];

    const pathFromCoordinates = (coordinates) => {
        if (!Array.isArray(coordinates) || coordinates.length < 2) return "";
        return coordinates.map((point, index) => {
            const [x, y] = project(point[0], point[1]);
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(" ");
    };

    const polygonPath = (rings) => {
        if (!Array.isArray(rings)) return "";
        return rings.map((ring) => {
            const path = pathFromCoordinates(ring);
            return path ? `${path} Z` : "";
        }).filter(Boolean).join(" ");
    };

    const geometryPath = (geometry) => {
        if (!geometry) return "";
        if (geometry.type === "Polygon") return polygonPath(geometry.coordinates);
        if (geometry.type === "MultiPolygon") {
            return geometry.coordinates
                .map((polygon) => polygonPath(polygon))
                .filter(Boolean)
                .join(" ");
        }
        return "";
    };

    const wardId = (ward) => {
        const raw = ward?.properties?.ward_id ?? ward?.properties?.ward;
        return raw === undefined || raw === null ? null : `W${raw}`;
    };

    const centroid = (geometry) => {
        const points = [];
        const collect = (value) => {
            if (!Array.isArray(value)) return;
            if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
                points.push([Number(value[0]), Number(value[1])]);
                return;
            }
            value.forEach(collect);
        };
        collect(geometry?.coordinates);
        if (!points.length) return null;
        const lon = points.reduce((sum, point) => sum + point[0], 0) / points.length;
        const lat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
        return project(lon, lat);
    };

    const riskClass = (assessment) => String(assessment?.risk_level || "normal").toLowerCase();

    const wardPaths = wards.map((ward) => {
        const id = wardId(ward);
        const assessment = id ? assessmentByZone.get(id) : null;
        const d = geometryPath(ward.geometry);
        if (!d) return "";
        const selectedClass = id === selectedZoneId ? " selected" : "";
        return `<path class="real-ward ${escapeHTML(riskClass(assessment))}${selectedClass}" data-zone-id="${escapeHTML(id || "")}" d="${d}" />`;
    }).filter(Boolean).join("");

    const roadPaths = roads.map((road) => {
        if (!Array.isArray(road.path) || road.path.length < 2) return "";
        const d = pathFromCoordinates(road.path);
        if (!d) return "";
        const stateClass = road.blocked
            ? "blocked"
            : Number(road.accessibility_percent ?? 100) < 50
                ? "restricted"
                : "open";
        return `<path class="real-road ${stateClass}" data-road-id="${escapeHTML(road.id)}" d="${d}" />`;
    }).filter(Boolean).join("");

    const wardMarkers = wards.map((ward) => {
        const id = wardId(ward);
        const assessment = id ? assessmentByZone.get(id) : null;
        const point = centroid(ward.geometry);
        if (!id || !point) return "";
        const [x, y] = point;
        const level = riskClass(assessment);
        const selectedClass = id === selectedZoneId ? " selected" : "";
        return `<circle class="real-ward-marker ${escapeHTML(level)}${selectedClass}" data-zone-id="${escapeHTML(id)}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.2" />`;
    }).filter(Boolean).join("");

    mapArea.innerHTML = `
        <svg class="network-map real-chennai-map" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-label="Real Chennai ward and road network">
            <style>
                .real-chennai-map .real-ward { fill: rgba(93, 155, 255, 0.035); stroke: rgba(93, 155, 255, 0.20); stroke-width: 0.45; vector-effect: non-scaling-stroke; cursor: pointer; transition: fill .18s, stroke .18s; }
                .real-chennai-map .real-ward.normal { fill: rgba(53, 208, 127, 0.025); stroke: rgba(53, 208, 127, 0.18); }
                .real-chennai-map .real-ward.watch { fill: rgba(255, 183, 56, 0.055); stroke: rgba(255, 183, 56, 0.28); }
                .real-chennai-map .real-ward.high { fill: rgba(255, 125, 72, 0.075); stroke: rgba(255, 125, 72, 0.35); }
                .real-chennai-map .real-ward.critical { fill: rgba(255, 76, 96, 0.10); stroke: rgba(255, 76, 96, 0.45); }
                .real-chennai-map .real-ward.selected { fill: rgba(75, 166, 255, 0.22); stroke: rgba(75, 166, 255, 0.98); stroke-width: 1.8; }
                .real-chennai-map .real-road { fill: none; stroke: rgba(123, 145, 178, 0.42); stroke-width: 0.7; vector-effect: non-scaling-stroke; pointer-events: none; }
                .real-chennai-map .real-road.restricted { stroke: rgba(255, 171, 65, 0.82); }
                .real-chennai-map .real-road.blocked { stroke: rgba(255, 76, 96, 0.95); stroke-width: 1.15; }
                .real-chennai-map .real-ward-marker { stroke: #0d1219; stroke-width: 0.6; vector-effect: non-scaling-stroke; pointer-events: none; }
                .real-chennai-map .real-ward-marker.normal { fill: #35d07f; }
                .real-chennai-map .real-ward-marker.watch { fill: #ffb738; }
                .real-chennai-map .real-ward-marker.high { fill: #ff7d48; }
                .real-chennai-map .real-ward-marker.critical { fill: #ff4c60; }
                .real-chennai-map .real-ward-marker.selected { fill: #4ba6ff; r: 4; }
            </style>
            <g class="real-ward-layer">${wardPaths}</g>
            <g class="real-road-layer">${roadPaths}</g>
            <g class="real-ward-marker-layer">${wardMarkers}</g>
        </svg>`;

    mapArea.querySelectorAll(".real-ward").forEach((wardElement) => {
        wardElement.addEventListener("click", () => {
            selectDashboardZone(wardElement.dataset.zoneId);
        });
    });

    setText(".map-status", `● ${wards.length} WARDS · ${roads.length.toLocaleString()} ROADS`);
}

function selectDashboardZone(zoneId) {
    const assessment = realDashboardAssessments.get(zoneId);
    if (!assessment) return;

    selectedZoneId = zoneId;
    updateHighestRisk(assessment);

    document.querySelectorAll(".real-ward.selected, .real-ward-marker.selected")
        .forEach((element) => element.classList.remove("selected"));

    document.querySelectorAll(`[data-zone-id="${CSS.escape(zoneId)}"]`)
        .forEach((element) => element.classList.add("selected"));

    setText(".map-status", `● SELECTED ${zoneId} · ${String(assessment.risk_level || "normal").toUpperCase()}`);
}

function updateHighestRisk(assessment) {
    if (!assessment) return;

    setText(".incident-id", assessment.zone_id);

    const riskScore = getElement(".incident-risk");
    if (riskScore) {
        riskScore.innerHTML = `${escapeHTML(Number(assessment.risk_score ?? 0).toFixed(2))}<span>/ 100</span>`;
    }

    const riskBadge = getElement(".risk-badge");
    if (riskBadge) {
        const level = String(assessment.risk_level || "normal").toLowerCase();
        riskBadge.textContent = level.toUpperCase();
        riskBadge.classList.remove("normal", "watch", "high", "critical");
        riskBadge.classList.add(level);
    }

    const progressFill = getElement(".risk-progress-fill");
    if (progressFill) {
        progressFill.style.width = `${Math.min(Math.max(Number(assessment.risk_score ?? 0), 0), 100)}%`;
    }

    const factors = assessment.factors || {};
    const conditions = document.querySelectorAll(".condition");
    if (conditions.length >= 4) {
        const water = Number(factors.water_depth_m ?? factors.water ?? 0);
        const rainfall = Number(factors.rainfall_mm_per_hr ?? factors.rainfall ?? 0);
        const accessibilityRisk = Number(factors.accessibility_risk ?? 0);
        const accessibility = factors.accessibility_percent !== undefined
            ? Number(factors.accessibility_percent)
            : Math.max(0, 100 - accessibilityRisk);
        const level = String(assessment.risk_level || "normal").toLowerCase();

        conditions[0].querySelector("strong").textContent = `${water.toFixed(2)} m`;
        conditions[1].querySelector("strong").textContent = `${rainfall.toFixed(0)} mm/hr`;
        conditions[2].querySelector("strong").textContent = `${accessibility.toFixed(0)}%`;
        conditions[3].querySelector("strong").textContent =
            level === "critical" || level === "high" ? "REQUIRED" : "MONITOR";
    }
}

async function generateResponsePlan() {
    const button = getElement(".secondary-button");
    if (!button) return;

    button.disabled = true;
    button.textContent = "Generating...";

    try {
        const overview = await fetchJSON("/risk/overview");
        realDashboardAssessments = new Map(
            (overview.assessments || []).map((assessment) => [assessment.zone_id, assessment])
        );
        const target = realDashboardAssessments.get(selectedZoneId) || getHighestRiskAssessment(overview);
        if (!target?.zone_id) {
            throw new Error("No real Chennai ward is available for response planning.");
        }
        selectedZoneId = target.zone_id;

        const plan = await fetchJSON(`/response/plan/${encodeURIComponent(target.zone_id)}`);
        let html = `
            <div class="result-hero">
                <div>
                    <div class="result-label">RESPONSE PLAN · ${escapeHTML(target.zone_id)}</div>
                    <div class="result-risk">${escapeHTML(Number(target.risk_score ?? 0).toFixed(2))}<span>/ 100</span></div>
                </div>
                <div class="result-level">${escapeHTML(String(target.risk_level || "normal").toUpperCase())}</div>
            </div>`;

        if (plan.actions?.length) {
            html += `<div class="result-section"><div class="result-label">RESPONSE ACTIONS</div><div class="result-list">`;
            plan.actions.forEach((action) => {
                html += `<div class="result-item">${escapeHTML(action.action_type || action.action || action.name || "Action")}</div>`;
            });
            html += `</div></div>`;
        }

        if (plan.allocations?.length) {
            html += `<div class="result-section"><div class="result-label">RESOURCE ALLOCATIONS</div><div class="result-list">`;
            plan.allocations.forEach((allocation) => {
                html += `<div class="result-item"><strong>${escapeHTML(String(allocation.quantity ?? 0))}</strong> × ${escapeHTML(allocation.resource_type || "resource")} → ${escapeHTML(allocation.destination_zone_id || target.zone_id)}</div>`;
            });
            html += `</div></div>`;
        }

        if (plan.deployments?.length) {
            html += `<div class="result-section"><div class="result-label">DEPLOYMENTS</div><div class="result-list">`;
            plan.deployments.forEach((deployment) => {
                const allocation = deployment.allocation || deployment;
                const route = deployment.route || {};
                const source = allocation.source_zone_id || route.origin_zone_id || "source";
                const destination = allocation.destination_zone_id || route.destination_zone_id || target.zone_id;
                const quantity = allocation.quantity ?? 1;
                const resourceType = allocation.resource_type || allocation.resource_id || "Resource";
                const distance = route.total_distance_km;
                const time = route.total_travel_time_min;

                html += `<div class="deployment-result">
                    <div class="deployment-result-top"><strong>${escapeHTML(resourceType)}</strong><span>P${escapeHTML(String(allocation.priority ?? "—"))}</span></div>
                    <div class="deployment-result-route"><strong>${escapeHTML(source)}</strong><span>→</span><strong>${escapeHTML(destination)}</strong></div>
                    <div class="deployment-result-meta"><span>QUANTITY<strong>${escapeHTML(String(quantity))}</strong></span><span>ID<strong>${escapeHTML(allocation.resource_id || "deployment")}</strong></span></div>`;
                if (distance !== undefined || time !== undefined) {
                    html += `<div class="deployment-result-meta" style="margin-top:8px;border-top:none;padding-top:0;"><span>DISTANCE<strong>${escapeHTML(String(distance ?? "—"))} km</strong></span><span>TIME<strong>${escapeHTML(String(time ?? "—"))} min</strong></span></div>`;
                }
                html += `</div>`;
            });
            html += `</div></div>`;
        }

        if (!plan.actions?.length && !plan.allocations?.length && !plan.deployments?.length) {
            html += `<div class="result-section"><div class="result-label">RESPONSE PLAN</div><div class="result-item">No response actions were generated.</div></div>`;
        }

        showModal(`Response Plan — ${target.zone_id}`, html);
    } catch (error) {
        showMessage("Response plan failed", error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Generate Response Plan";
    }
}

// Explicit initialization prevents the dashboard from remaining on its
// original four-zone demo state if another frontend module initializes first.
async function initializeRealDashboard() {
    try {
        const overview = await fetchJSON("/risk/overview");
        updateDashboard(overview);
    } catch (error) {
        console.error("Could not initialize real Chennai dashboard:", error);
    }
}

document.addEventListener("DOMContentLoaded", initializeRealDashboard, { once: true });
