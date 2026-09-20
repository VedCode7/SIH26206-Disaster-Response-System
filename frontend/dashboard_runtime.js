/*
 * Production dashboard runtime.
 *
 * This is the single owner of the real Chennai dashboard bootstrap. It
 * deliberately replaces the old demo/real-dashboard race with one guarded
 * initialization pipeline and a shared geography cache.
 */

const DASHBOARD_RUNTIME = {
    overview: null,
    wards: null,
    roads: null,
    bootstrapPromise: null,
    selectedZoneId: null,
    assessments: new Map(),
};

const DASHBOARD_TIMEOUT_MS = 20000;

function dashboardRuntimeError(message) {
    const error = new Error(message);
    error.name = "DashboardRuntimeError";
    return error;
}

async function dashboardRuntimeFetch(endpoint, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DASHBOARD_TIMEOUT_MS);

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        });

        if (!response.ok) {
            let message = `${response.status} ${response.statusText}`;
            try {
                const body = await response.json();
                if (body?.detail) message = body.detail;
            } catch (_) {}
            throw dashboardRuntimeError(`${endpoint}: ${message}`);
        }

        return await response.json();
    } catch (error) {
        if (error?.name === "AbortError") {
            throw dashboardRuntimeError(`${endpoint}: request timed out after ${DASHBOARD_TIMEOUT_MS / 1000}s`);
        }
        if (error?.name === "DashboardRuntimeError") throw error;
        throw dashboardRuntimeError(`${endpoint}: ${error?.message || "request failed"}`);
    } finally {
        clearTimeout(timeout);
    }
}

function dashboardRuntimeSetText(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
}

function dashboardRuntimeSetStatus(text, state = "ready") {
    const status = document.querySelector(".status-text");
    const description = document.querySelector(".stat-card:nth-child(4) .stat-description");
    const mapStatus = document.querySelector(".map-status");

    if (status) {
        status.textContent = text;
        status.classList.remove("loading", "error", "ready");
        status.classList.add(state);
    }
    if (description) {
        description.textContent = state === "ready"
            ? "Routing system operational"
            : state === "error"
                ? "Backend or geographic data unavailable"
                : "Initializing routing system";
    }
    if (mapStatus && state === "error") {
        mapStatus.textContent = "● CHENNAI GEOGRAPHY UNAVAILABLE";
    }
}

function dashboardRuntimeShowError(error) {
    const message = error?.message || "Unknown dashboard initialization error.";
    console.error("Chennai dashboard initialization failed:", error);

    dashboardRuntimeSetStatus("ERROR", "error");

    const mapArea = document.querySelector(".map-area");
    if (mapArea) {
        mapArea.innerHTML = `
            <div class="dashboard-map-loading dashboard-map-error" role="alert">
                <div class="dashboard-map-loading-card">
                    <div class="dashboard-map-error-icon">!</div>
                    <div>
                        <strong>Chennai map unavailable</strong>
                        <span>${escapeHTML(message)}</span>
                        <button type="button" class="dashboard-runtime-retry">Retry dashboard</button>
                    </div>
                </div>
            </div>`;

        const retry = mapArea.querySelector(".dashboard-runtime-retry");
        if (retry) retry.addEventListener("click", () => initializeRealDashboard(true));
    }

    const badge = document.querySelector(".risk-badge");
    if (badge) {
        badge.textContent = "UNAVAILABLE";
        badge.classList.remove("normal", "watch", "high", "critical");
    }

    const facilityPanel = document.querySelector(".resources-panel");
    if (facilityPanel && !facilityPanel.dataset.facilityRendered) {
        facilityPanel.innerHTML = `
            <div class="panel-header">
                <div>
                    <p class="panel-kicker">FACILITY INTELLIGENCE</p>
                    <h3>Geographic context unavailable</h3>
                </div>
            </div>
            <div class="facility-empty facility-dashboard-error">
                Facility context will become available when the Chennai geography is connected.
            </div>`;
    }
}

function dashboardHighestRisk(overview) {
    const assessments = Array.isArray(overview?.assessments) ? overview.assessments : [];
    if (!assessments.length) return null;
    return assessments.reduce((highest, current) =>
        Number(current.risk_score ?? 0) > Number(highest.risk_score ?? 0) ? current : highest
    );
}

function dashboardRiskClass(assessment) {
    return String(assessment?.risk_level || "normal").toLowerCase();
}

function dashboardUpdateIncident(assessment) {
    if (!assessment) return;

    DASHBOARD_RUNTIME.selectedZoneId = assessment.zone_id;
    dashboardRuntimeSetText(".incident-id", assessment.zone_id);

    const score = Number(assessment.risk_score ?? 0);
    const riskElement = document.querySelector(".incident-risk");
    if (riskElement) {
        riskElement.innerHTML = `${escapeHTML(score.toFixed(2))}<span>/ 100</span>`;
    }

    const level = dashboardRiskClass(assessment);
    const badge = document.querySelector(".risk-badge");
    if (badge) {
        badge.textContent = level.toUpperCase();
        badge.classList.remove("normal", "watch", "high", "critical");
        badge.classList.add(level);
    }

    const fill = document.querySelector(".risk-progress-fill");
    if (fill) fill.style.width = `${Math.min(Math.max(score, 0), 100)}%`;

    const factors = assessment.factors || {};
    const conditions = document.querySelectorAll(".condition strong");
    if (conditions.length >= 4) {
        const water = Number(factors.water_depth_m ?? factors.water ?? 0);
        const rainfall = Number(factors.rainfall_mm_per_hr ?? factors.rainfall ?? 0);
        const accessibilityRisk = Number(factors.accessibility_risk ?? 0);
        const accessibility = factors.accessibility_percent !== undefined
            ? Number(factors.accessibility_percent)
            : Math.max(0, 100 - accessibilityRisk);

        conditions[0].textContent = `${water.toFixed(2)} m`;
        conditions[1].textContent = `${rainfall.toFixed(0)} mm/hr`;
        conditions[2].textContent = `${accessibility.toFixed(0)}%`;
        conditions[3].textContent = level === "critical" || level === "high" ? "REQUIRED" : "MONITOR";
    }
}

function dashboardRenderOverview(overview) {
    DASHBOARD_RUNTIME.overview = overview;
    DASHBOARD_RUNTIME.assessments = new Map(
        (overview?.assessments || []).map((assessment) => [assessment.zone_id, assessment])
    );

    dashboardRuntimeSetText(
        ".stat-card:nth-child(1) .stat-value",
        Number(overview?.total_zones ?? DASHBOARD_RUNTIME.assessments.size).toLocaleString()
    );
    dashboardRuntimeSetText(
        ".stat-card:nth-child(2) .stat-value",
        Number(overview?.critical_count ?? 0).toLocaleString()
    );

    const highest = DASHBOARD_RUNTIME.selectedZoneId
        ? DASHBOARD_RUNTIME.assessments.get(DASHBOARD_RUNTIME.selectedZoneId)
        : dashboardHighestRisk(overview);

    if (highest) dashboardUpdateIncident(highest);
}

function dashboardWardId(feature) {
    const raw = feature?.properties?.ward_id ?? feature?.properties?.ward;
    return raw === undefined || raw === null ? null : `W${raw}`;
}

function dashboardCollectCoordinates(value, points) {
    if (!Array.isArray(value)) return;
    if (
        value.length >= 2 &&
        Number.isFinite(Number(value[0])) &&
        Number.isFinite(Number(value[1]))
    ) {
        points.push([Number(value[0]), Number(value[1])]);
        return;
    }
    value.forEach((child) => dashboardCollectCoordinates(child, points));
}

function dashboardGeometryPath(geometry, project) {
    if (!geometry) return "";

    const path = (coordinates) => {
        if (!Array.isArray(coordinates) || coordinates.length < 2) return "";
        return coordinates.map((point, index) => {
            const [x, y] = project(point[0], point[1]);
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(" ");
    };

    const polygon = (rings) => {
        if (!Array.isArray(rings)) return "";
        return rings.map((ring) => {
            const d = path(ring);
            return d ? `${d} Z` : "";
        }).filter(Boolean).join(" ");
    };

    if (geometry.type === "Polygon") return polygon(geometry.coordinates);
    if (geometry.type === "MultiPolygon") {
        return geometry.coordinates.map(polygon).filter(Boolean).join(" ");
    }
    return "";
}

function dashboardRenderMap() {
    const mapArea = document.querySelector(".map-area");
    if (!mapArea) return;

    const wards = DASHBOARD_RUNTIME.wards || [];
    const roads = DASHBOARD_RUNTIME.roads || [];
    const assessments = DASHBOARD_RUNTIME.assessments;

    if (!wards.length) throw dashboardRuntimeError("/world/wards: no ward features returned");
    if (!roads.length) throw dashboardRuntimeError("/world/roads: no road records returned");

    const points = [];
    roads.forEach((road) => dashboardCollectCoordinates(road.path, points));
    wards.forEach((ward) => dashboardCollectCoordinates(ward.geometry?.coordinates, points));

    if (!points.length) throw dashboardRuntimeError("Chennai geography contains no coordinates");

    const width = 900;
    const height = 330;
    const padding = 18;
    const lons = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
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

    const wardPaths = wards.map((ward) => {
        const id = dashboardWardId(ward);
        const d = dashboardGeometryPath(ward.geometry, project);
        if (!id || !d) return "";
        const selected = id === DASHBOARD_RUNTIME.selectedZoneId ? " selected" : "";
        const level = dashboardRiskClass(assessments.get(id));
        return `<path class="real-ward ${escapeHTML(level)}${selected}" data-zone-id="${escapeHTML(id)}" d="${d}" />`;
    }).filter(Boolean).join("");

    const roadPaths = roads.map((road) => {
        if (!Array.isArray(road.path) || road.path.length < 2) return "";
        const d = road.path.map((point, index) => {
            const [x, y] = project(point[0], point[1]);
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(" ");
        const stateClass = road.blocked
            ? "blocked"
            : Number(road.accessibility_percent ?? 100) < 50
                ? "restricted"
                : "open";
        return `<path class="real-road ${stateClass}" data-road-id="${escapeHTML(road.id)}" d="${d}" />`;
    }).filter(Boolean).join("");

    mapArea.innerHTML = `
        <svg class="network-map real-chennai-map" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-label="Real Chennai ward and road network">
            <style>
                .real-chennai-map .real-ward{fill:rgba(93,155,255,.035);stroke:rgba(93,155,255,.20);stroke-width:.45;vector-effect:non-scaling-stroke;cursor:pointer}
                .real-chennai-map .real-ward.normal{fill:rgba(53,208,127,.025);stroke:rgba(53,208,127,.18)}
                .real-chennai-map .real-ward.watch{fill:rgba(255,183,56,.055);stroke:rgba(255,183,56,.28)}
                .real-chennai-map .real-ward.high{fill:rgba(255,125,72,.075);stroke:rgba(255,125,72,.35)}
                .real-chennai-map .real-ward.critical{fill:rgba(255,76,96,.10);stroke:rgba(255,76,96,.45)}
                .real-chennai-map .real-ward.selected{fill:rgba(75,166,255,.22);stroke:rgba(75,166,255,.98);stroke-width:1.8}
                .real-chennai-map .real-road{fill:none;stroke:rgba(123,145,178,.42);stroke-width:.7;vector-effect:non-scaling-stroke;pointer-events:none}
                .real-chennai-map .real-road.restricted{stroke:rgba(255,171,65,.82)}
                .real-chennai-map .real-road.blocked{stroke:rgba(255,76,96,.95);stroke-width:1.15}
            </style>
            <g class="real-road-layer">${roadPaths}</g>
            <g class="real-ward-layer">${wardPaths}</g>
        </svg>`;

    mapArea.querySelectorAll(".real-ward").forEach((element) => {
        element.addEventListener("click", () => selectDashboardZone(element.dataset.zoneId));
    });

    dashboardRuntimeSetText(
        ".map-status",
        `● ${wards.length} WARDS · ${roads.length.toLocaleString()} ROADS`
    );
}

function selectDashboardZone(zoneId) {
    const assessment = DASHBOARD_RUNTIME.assessments.get(zoneId);
    if (!assessment) return;

    DASHBOARD_RUNTIME.selectedZoneId = zoneId;
    dashboardUpdateIncident(assessment);

    document.querySelectorAll(".real-ward.selected").forEach((element) => {
        element.classList.remove("selected");
    });

    document.querySelectorAll(`[data-zone-id="${CSS.escape(zoneId)}"]`).forEach((element) => {
        element.classList.add("selected");
    });

    dashboardRuntimeSetText(
        ".map-status",
        `● SELECTED ${zoneId} · ${String(assessment.risk_level || "normal").toUpperCase()}`
    );

    if (typeof window.refreshDashboardFacilityInsights === "function") {
        window.refreshDashboardFacilityInsights();
    }
}

async function loadDashboardGeography() {
    if (DASHBOARD_RUNTIME.wards && DASHBOARD_RUNTIME.roads) return;

    const [wardGeoJSON, roadData] = await Promise.all([
        dashboardRuntimeFetch("/world/wards"),
        dashboardRuntimeFetch("/world/roads"),
    ]);

    DASHBOARD_RUNTIME.wards = Array.isArray(wardGeoJSON?.features)
        ? wardGeoJSON.features
        : [];
    DASHBOARD_RUNTIME.roads = Array.isArray(roadData?.roads)
        ? roadData.roads
        : [];
}

async function initializeRealDashboard(force = false) {
    if (DASHBOARD_RUNTIME.bootstrapPromise && !force) {
        return DASHBOARD_RUNTIME.bootstrapPromise;
    }

    if (force) {
        DASHBOARD_RUNTIME.overview = null;
        DASHBOARD_RUNTIME.wards = null;
        DASHBOARD_RUNTIME.roads = null;
        DASHBOARD_RUNTIME.bootstrapPromise = null;
    }

    const run = (async () => {
        dashboardRuntimeSetStatus("LOADING", "loading");
        dashboardRuntimeSetText(".map-status", "● LOADING CHENNAI GEOGRAPHY");

        const overview = await dashboardRuntimeFetch("/risk/overview");
        dashboardRenderOverview(overview);

        await loadDashboardGeography();
        dashboardRenderMap();

        dashboardRuntimeSetStatus("READY", "ready");

        const highest = dashboardHighestRisk(overview);
        if (highest) dashboardUpdateIncident(
            DASHBOARD_RUNTIME.assessments.get(DASHBOARD_RUNTIME.selectedZoneId) || highest
        );

        return overview;
    })();

    DASHBOARD_RUNTIME.bootstrapPromise = run;

    try {
        return await run;
    } catch (error) {
        dashboardRuntimeShowError(error);
        throw error;
    } finally {
        if (DASHBOARD_RUNTIME.bootstrapPromise === run) {
            DASHBOARD_RUNTIME.bootstrapPromise = null;
        }
    }
}

/*
 * app.js calls these names during its legacy dashboard initialization.
 * Rebinding them here makes that older layer reuse the guarded runtime
 * instead of issuing a second expensive risk/road request.
 */
window.loadRiskOverview = async function loadRiskOverview() {
    try {
        return await initializeRealDashboard();
    } catch (_) {
        return null;
    }
};

window.loadRoadNetwork = async function loadRoadNetwork() {
    if (!DASHBOARD_RUNTIME.roads) return null;
    return DASHBOARD_RUNTIME.roads;
};

window.updateDashboard = dashboardRenderOverview;
window.updateHighestRisk = dashboardUpdateIncident;
window.selectDashboardZone = selectDashboardZone;
window.initializeRealDashboard = initializeRealDashboard;

async function generateResponsePlan() {
    const button = document.querySelector(".secondary-button");
    if (!button) return;

    button.disabled = true;
    button.textContent = "Generating...";

    try {
        if (!DASHBOARD_RUNTIME.overview) await initializeRealDashboard();

        const target = DASHBOARD_RUNTIME.assessments.get(DASHBOARD_RUNTIME.selectedZoneId)
            || dashboardHighestRisk(DASHBOARD_RUNTIME.overview);
        if (!target?.zone_id) {
            throw dashboardRuntimeError("No Chennai ward is available for response planning.");
        }

        DASHBOARD_RUNTIME.selectedZoneId = target.zone_id;
        dashboardUpdateIncident(target);

        const plan = await dashboardRuntimeFetch(
            `/response/plan/${encodeURIComponent(target.zone_id)}`
        );

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
                html += `<div class="deployment-result">
                    <div class="deployment-result-top"><strong>${escapeHTML(allocation.resource_type || allocation.resource_id || "Resource")}</strong><span>P${escapeHTML(String(allocation.priority ?? "—"))}</span></div>
                    <div class="deployment-result-route"><strong>${escapeHTML(allocation.source_zone_id || route.origin_zone_id || "source")}</strong><span>→</span><strong>${escapeHTML(allocation.destination_zone_id || route.destination_zone_id || target.zone_id)}</strong></div>
                    <div class="deployment-result-meta"><span>QUANTITY<strong>${escapeHTML(String(allocation.quantity ?? 1))}</strong></span><span>ID<strong>${escapeHTML(allocation.resource_id || "deployment")}</strong></span></div>
                </div>`;
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

window.generateResponsePlan = generateResponsePlan;

document.addEventListener("DOMContentLoaded", () => {
    initializeRealDashboard().catch(() => {});
}, { once: true });
