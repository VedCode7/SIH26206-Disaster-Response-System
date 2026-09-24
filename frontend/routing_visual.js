/*
 * Disaster-aware routing visualisation.
 *
 * Geographic rendering rule:
 *   - the map is composed only of persisted OSM-derived road LineStrings;
 *   - no ward-to-ward connector is ever drawn;
 *   - the selected route is rendered from /route/.../geometry when available;
 *   - map fitting uses only validated Chennai road coordinates;
 *   - there is no CSS transform based auto-zoom.
 */
(function () {
    "use strict";

    const CHENNAI_BOUNDS = Object.freeze({
        minLon: 80.10,
        minLat: 12.80,
        maxLon: 80.40,
        maxLat: 13.23,
    });

    const STATE = {
        requestId: 0,
        wards: [],
        roads: [],
        route: null,
        routeGeometry: null,
        origin: null,
        destination: null,
        zoom: 1,
    };

    const esc = (value) => {
        if (typeof escapeHTML === "function") return escapeHTML(value);
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
        }[char]));
    };

    const num = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const formatDistance = (value) => `${num(value).toFixed(4)} km`;
    const formatTime = (value) => `${num(value).toFixed(2)} min`;

    async function requestJSON(endpoint, options = {}) {
        if (typeof fetchJSON === "function") return fetchJSON(endpoint, options);
        const response = await fetch(`${window.API_BASE || "http://127.0.0.1:8000"}${endpoint}`, options);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
    }

    function wardId(feature) {
        const raw = feature?.properties?.ward_id ?? feature?.properties?.ward;
        return raw === undefined || raw === null ? null : `W${raw}`;
    }

    function isValidPoint(point) {
        return Array.isArray(point)
            && point.length >= 2
            && Number.isFinite(Number(point[0]))
            && Number.isFinite(Number(point[1]))
            && Number(point[0]) >= CHENNAI_BOUNDS.minLon
            && Number(point[0]) <= CHENNAI_BOUNDS.maxLon
            && Number(point[1]) >= CHENNAI_BOUNDS.minLat
            && Number(point[1]) <= CHENNAI_BOUNDS.maxLat;
    }

    function roadPath(road) {
        if (!Array.isArray(road?.path)) return [];
        return road.path.filter(isValidPoint).map((point) => [Number(point[0]), Number(point[1])]);
    }

    function geometryCoordinates(geometry) {
        const coordinates = geometry?.coordinates;
        if (!Array.isArray(coordinates)) return [];
        return coordinates.filter(isValidPoint).map((point) => [Number(point[0]), Number(point[1])]);
    }

    function buildProjection(roads, routeGeometry, width, height) {
        const points = [];
        roads.forEach((road) => points.push(...roadPath(road)));
        points.push(...geometryCoordinates(routeGeometry));
        if (!points.length) return null;

        let minLon = Math.min(...points.map((p) => p[0]));
        let maxLon = Math.max(...points.map((p) => p[0]));
        let minLat = Math.min(...points.map((p) => p[1]));
        let maxLat = Math.max(...points.map((p) => p[1]));

        const spanLon = Math.max(maxLon - minLon, 0.001);
        const spanLat = Math.max(maxLat - minLat, 0.001);
        const paddingFraction = 0.035;
        minLon -= spanLon * paddingFraction;
        maxLon += spanLon * paddingFraction;
        minLat -= spanLat * paddingFraction;
        maxLat += spanLat * paddingFraction;

        const drawableWidth = width - 44;
        const drawableHeight = height - 44;
        const scale = Math.min(drawableWidth / (maxLon - minLon), drawableHeight / (maxLat - minLat));
        const drawnWidth = (maxLon - minLon) * scale;
        const drawnHeight = (maxLat - minLat) * scale;
        const offsetX = (width - drawnWidth) / 2;
        const offsetY = (height - drawnHeight) / 2;

        return (lon, lat) => [
            offsetX + (Number(lon) - minLon) * scale,
            height - (offsetY + (Number(lat) - minLat) * scale),
        ];
    }

    function pathD(points, project) {
        if (!Array.isArray(points) || points.length < 2) return "";
        return points.map((point, index) => {
            const [x, y] = project(point[0], point[1]);
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(" ");
    }

    function roadCondition(road) {
        if (road?.blocked) return "blocked";
        return num(road?.accessibility_percent, 100) < 70 ? "degraded" : "clear";
    }

    function routeSegments(route) {
        const byId = new Map(STATE.roads.map((road) => [road.id, road]));
        return (route?.road_path || []).map((id) => byId.get(id)).filter(Boolean);
    }

    function routeCounts(route) {
        return routeSegments(route).reduce((counts, road) => {
            counts.total += 1;
            counts[roadCondition(road)] += 1;
            return counts;
        }, { total: 0, clear: 0, degraded: 0, blocked: 0 });
    }

    function createRouteSvg(route) {
        const width = 920;
        const height = 520;
        const projection = buildProjection(STATE.roads, STATE.routeGeometry, width, height);
        if (!projection) {
            return `<div class="routing-map-error">No valid mapped road coordinates are available.</div>`;
        }

        const networkPaths = STATE.roads.map((road) => {
            const path = pathD(roadPath(road), projection);
            if (!path) return "";
            const condition = roadCondition(road);
            return `<path class="routing-road routing-road-${condition}" d="${path}" data-road-id="${esc(road.id)}"><title>${esc(road.id)}</title></path>`;
        }).join("");

        const routePath = pathD(geometryCoordinates(STATE.routeGeometry), projection);
        const routeOverlay = routePath
            ? `<path class="routing-real-route-underlay" d="${routePath}"></path><path class="routing-real-route" d="${routePath}"></path>`
            : "";

        return `
            <svg class="routing-map-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapped Chennai road network">
                <g class="routing-real-road-network">${networkPaths}</g>
                <g class="routing-real-route-layer">${routeOverlay}</g>
            </svg>`;
    }

    function renderMapLegend() {
        return `
            <div class="routing-map-legend">
                <span><i class="route-key route-key-network"></i>Mapped OSM roads</span>
                <span><i class="route-key route-key-route"></i>Selected route</span>
                <span><i class="route-key route-key-degraded"></i>Degraded road</span>
                <span><i class="route-key route-key-blocked"></i>Blocked road</span>
            </div>`;
    }

    function renderSummary(route) {
        const counts = routeCounts(route);
        const zonePath = route?.zone_path || [];
        const roadPathIds = route?.road_path || [];

        return `
            <section class="routing-summary-panel">
                <div class="routing-panel-header">
                    <div><span class="routing-kicker">ROUTE SUMMARY</span><h3>Operational Route</h3></div>
                    <span class="routing-status routing-status-ready">ROUTE AVAILABLE</span>
                </div>
                <div class="routing-primary-metrics">
                    <div class="routing-metric routing-metric-large"><span class="routing-metric-icon">◈</span><div><small>Distance</small><strong>${formatDistance(route?.total_distance_km)}</strong></div></div>
                    <div class="routing-metric routing-metric-large"><span class="routing-metric-icon">◷</span><div><small>Estimated Time</small><strong>${formatTime(route?.total_travel_time_min)}</strong></div></div>
                </div>
                <div class="routing-condition-grid">
                    <div class="routing-condition"><small>Total Roads</small><strong>${counts.total}</strong></div>
                    <div class="routing-condition routing-condition-clear"><small>Clear</small><strong>${counts.clear}</strong></div>
                    <div class="routing-condition routing-condition-degraded"><small>Degraded</small><strong>${counts.degraded}</strong></div>
                    <div class="routing-condition routing-condition-blocked"><small>Blocked</small><strong>${counts.blocked}</strong></div>
                </div>
                <div class="routing-subsection">
                    <div class="routing-subsection-title">WARD PATH <span>${zonePath.length} nodes</span></div>
                    <div class="routing-path-track">
                        ${zonePath.map((zoneId, index) => `
                            <div class="routing-path-node ${index === 0 ? "is-origin" : index === zonePath.length - 1 ? "is-destination" : ""}"><span>${esc(zoneId)}</span></div>
                            ${index < zonePath.length - 1 ? `<div class="routing-path-link"></div>` : ""}`).join("")}
                    </div>
                </div>
                <div class="routing-subsection routing-road-sequence">
                    <div class="routing-subsection-title">ROAD SEQUENCE <span>${roadPathIds.length} segments</span></div>
                    <div class="routing-road-table">
                        ${roadPathIds.slice(0, 6).map((roadId, index) => {
                            const road = STATE.roads.find((item) => item.id === roadId);
                            const condition = roadCondition(road);
                            return `<div class="routing-road-row"><span class="routing-road-index">${index + 1}</span><strong title="${esc(roadId)}">${esc(roadId)}</strong><span>${road ? formatDistance(road.distance_km) : "—"}</span><b class="routing-mini-state routing-mini-${condition}">${condition.toUpperCase()}</b></div>`;
                        }).join("")}
                    </div>
                    ${roadPathIds.length > 6 ? `<button type="button" class="routing-more-btn" data-action="show-roads">Show all ${roadPathIds.length} segments⌄</button>` : ""}
                </div>
            </section>`;
    }

    function renderProfile(route) {
        const segments = routeSegments(route);
        if (!segments.length) return `<section class="routing-profile-card"><div class="routing-profile-empty">No traversable road segments were returned.</div></section>`;
        const width = 640;
        const height = 150;
        const pad = { left: 34, right: 18, top: 18, bottom: 28 };
        const usableW = width - pad.left - pad.right;
        const usableH = height - pad.top - pad.bottom;
        let distance = 0;
        const points = segments.map((road, index) => {
            distance += num(road.distance_km);
            return [pad.left + (index / Math.max(segments.length - 1, 1)) * usableW, pad.top + ((100 - num(road.accessibility_percent, 100)) / 100) * usableH];
        });
        const line = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
        const area = `${line} L ${(pad.left + usableW).toFixed(1)} ${(pad.top + usableH).toFixed(1)} L ${pad.left.toFixed(1)} ${(pad.top + usableH).toFixed(1)} Z`;
        return `
            <section class="routing-profile-card">
                <div class="routing-card-heading"><div><span class="routing-card-icon">⌁</span><strong>Route Condition Profile</strong> <em>(Accessibility)</em></div><span class="routing-profile-note">Current road state</span></div>
                <svg class="routing-profile-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Route accessibility profile">
                    <g class="routing-profile-grid"><line x1="34" y1="18" x2="622" y2="18"></line><line x1="34" y1="70" x2="622" y2="70"></line><line x1="34" y1="122" x2="622" y2="122"></line></g>
                    <path class="routing-profile-area" d="${area}"></path><path class="routing-profile-line" d="${line}"></path>
                    <text x="4" y="22">100%</text><text x="4" y="74">50%</text><text x="8" y="126">0%</text><text x="34" y="145">0 km</text><text x="585" y="145">${esc(distance.toFixed(2))} km</text>
                </svg>
            </section>`;
    }

    function renderInsights(route) {
        const counts = routeCounts(route);
        const blockedNetwork = STATE.roads.filter((road) => road.blocked).length;
        const lines = [
            { type: "good", text: "Shortest currently available route considering road conditions" },
            { type: counts.degraded ? "warn" : "good", text: counts.degraded ? `${counts.degraded} degraded route segment${counts.degraded === 1 ? "" : "s"} may reduce travel speed` : "No degraded segments on the selected route" },
            { type: "good", text: blockedNetwork ? `${blockedNetwork} blocked network segment${blockedNetwork === 1 ? "" : "s"} excluded from traversal` : "No blocked road segments in the current network" },
            { type: "good", text: `Passes through ${(route?.zone_path || []).length} ward nodes for disaster-aware routing` },
            { type: "good", text: STATE.routeGeometry ? "Visual path reconstructed from the real OSM road graph" : "Route geometry endpoint did not return a physical OSM path" },
        ];
        return `
            <section class="routing-insights-card">
                <div class="routing-card-heading"><div><span class="routing-card-icon">◉</span><strong>Route Insights</strong></div></div>
                <div class="routing-insight-list">${lines.map((line) => `<div class="routing-insight"><i class="routing-insight-${line.type}">${line.type === "warn" ? "!" : "✓"}</i><span>${esc(line.text)}</span></div>`).join("")}</div>
            </section>`;
    }

    function renderQuickActions() {
        return `
            <section class="routing-actions-card">
                <div class="routing-card-heading"><div><span class="routing-card-icon">⚙</span><strong>Quick Actions</strong></div></div>
                <div class="routing-action-grid">
                    <button type="button" data-action="full-map">▣ <span>Show on Full Map</span></button>
                    <button type="button" data-action="reverse">⇄ <span>Reverse Route</span></button>
                    <button type="button" data-action="export">⇩ <span>Export Route (GeoJSON)</span></button>
                    <button type="button" data-action="copy">▣ <span>Copy Details</span></button>
                </div>
            </section>`;
    }

    function renderScenarioBadge() {
        const blocked = STATE.roads.filter((road) => road.blocked).length;
        const degraded = STATE.roads.filter((road) => !road.blocked && num(road.accessibility_percent, 100) < 70).length;
        return `<div class="routing-scenario"><div class="routing-scenario-icon">⌁</div><div><small>ACTIVE SCENARIO</small><strong>Current Chennai network</strong><div><b>${blocked} blocked</b><b>${degraded} degraded</b></div></div></div>`;
    }

    function renderControls() {
        const uniqueWards = [...new Set(STATE.wards.map(wardId).filter(Boolean))];
        const options = uniqueWards.map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join("");
        return `
            <section class="routing-control-panel"><div class="routing-select-group">
                <label>Origin Ward<select id="route-origin" class="routing-select">${options}</select></label>
                <button type="button" id="routing-swap" class="routing-swap" aria-label="Swap origin and destination">⇄</button>
                <label>Destination Ward<select id="route-dest" class="routing-select">${options}</select></label>
                <button type="button" id="find-route-btn" class="routing-find-button">⌁ <span>Find Best Route</span></button>
            </div></section>`;
    }

    function renderShell(route) {
        return `
            <div class="routing-page">
                <div class="routing-heading-row"><div><p class="routing-eyebrow">DISASTER-AWARE PATHFINDING</p><h1>Routing</h1><p class="routing-subtitle">Find the safest and fastest route between Chennai wards using the current disaster-aware road network.</p></div>${renderScenarioBadge()}</div>
                ${renderControls()}
                ${route ? `<div class="routing-main-grid">
                    <section class="routing-map-panel"><div class="routing-map-title">ROAD NETWORK</div><div class="routing-map-viewport">${createRouteSvg(route)}${renderMapLegend()}<div class="routing-map-controls"><button type="button" data-map="zoom-in">+</button><button type="button" data-map="zoom-out">−</button><button type="button" data-map="reset">◎</button></div></div></section>
                    ${renderSummary(route)}
                </div><div class="routing-bottom-grid">${renderProfile(route)}${renderInsights(route)}${renderQuickActions()}</div>` : `<section class="routing-empty-state"><div class="routing-empty-icon">⌁</div><strong>Select two Chennai wards to calculate a route.</strong><span>The map will remain a real mapped road network; no synthetic zone connectors are drawn.</span></section>`}
            </div>`;
    }

    function updateSelectValues() {
        const origin = document.getElementById("route-origin");
        const destination = document.getElementById("route-dest");
        if (origin && STATE.origin) origin.value = STATE.origin;
        if (destination && STATE.destination) destination.value = STATE.destination;
    }

    function renderWorkspace() {
        const host = document.getElementById("routing-workspace");
        if (!host) return;
        host.innerHTML = renderShell(STATE.route);
        bindRoutingControls();
        updateSelectValues();
    }

    function applyMapScale() {
        const svg = document.querySelector(".routing-map-svg");
        if (!svg) return;
        svg.style.transform = `scale(${Math.max(1, Math.min(2.5, STATE.zoom))})`;
        svg.style.transformOrigin = "50% 50%";
    }

    function exportRouteGeoJSON() {
        if (!STATE.route) return;
        const features = routeSegments(STATE.route).map((road) => ({
            type: "Feature",
            properties: {
                road_id: road.id,
                from_zone_id: road.from_zone_id,
                to_zone_id: road.to_zone_id,
                distance_km: road.distance_km,
                travel_time_min: road.travel_time_min,
                accessibility_percent: road.accessibility_percent,
                blocked: !!road.blocked,
            },
            geometry: { type: "LineString", coordinates: road.path },
        }));
        if (STATE.routeGeometry?.coordinates?.length) {
            features.push({ type: "Feature", properties: { layer: "continuous_osm_route" }, geometry: STATE.routeGeometry });
        }
        const geojson = { type: "FeatureCollection", properties: { origin_zone_id: STATE.route.origin_zone_id, destination_zone_id: STATE.route.destination_zone_id }, features };
        const url = URL.createObjectURL(new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `route-${STATE.route.origin_zone_id}-${STATE.route.destination_zone_id}.geojson`;
        link.click();
        URL.revokeObjectURL(url);
    }

    async function copyDetails() {
        if (!STATE.route) return;
        const text = [
            `Route: ${STATE.route.origin_zone_id} → ${STATE.route.destination_zone_id}`,
            `Distance: ${formatDistance(STATE.route.total_distance_km)}`,
            `Estimated time: ${formatTime(STATE.route.total_travel_time_min)}`,
            `Ward path: ${(STATE.route.zone_path || []).join(" → ")}`,
            `Road path: ${(STATE.route.road_path || []).join(", ")}`,
        ].join("\n");
        try {
            await navigator.clipboard.writeText(text);
            const label = document.querySelector('[data-action="copy"] span');
            if (label) { const old = label.textContent; label.textContent = "Copied"; setTimeout(() => { label.textContent = old; }, 1200); }
        } catch (_) { window.prompt("Copy route details", text); }
    }

    function openFullMap() {
        if (!STATE.route) return;
        const backdrop = document.createElement("div");
        backdrop.className = "routing-fullmap-backdrop";
        backdrop.innerHTML = `<div class="routing-fullmap-dialog"><div class="routing-fullmap-header"><div><span>ROAD NETWORK</span><strong>${esc(STATE.route.origin_zone_id)} → ${esc(STATE.route.destination_zone_id)}</strong></div><button type="button" class="routing-fullmap-close" aria-label="Close full map">×</button></div><div class="routing-fullmap-body">${createRouteSvg(STATE.route)}</div></div>`;
        document.body.appendChild(backdrop);
        const close = () => backdrop.remove();
        backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
        backdrop.querySelector(".routing-fullmap-close")?.addEventListener("click", close);
    }

    function showAllRoads() {
        if (!STATE.route) return;
        const table = document.querySelector(".routing-road-table");
        if (!table) return;
        table.innerHTML = (STATE.route.road_path || []).map((roadId, index) => {
            const road = STATE.roads.find((item) => item.id === roadId);
            const condition = roadCondition(road);
            return `<div class="routing-road-row"><span class="routing-road-index">${index + 1}</span><strong>${esc(roadId)}</strong><span>${road ? formatDistance(road.distance_km) : "—"}</span><b class="routing-mini-state routing-mini-${condition}">${condition.toUpperCase()}</b></div>`;
        }).join("");
        document.querySelector("[data-action=show-roads]")?.remove();
    }

    async function loadRouteGeometry(origin, destination) {
        try {
            const response = await requestJSON(`/route/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}/geometry`);
            return response?.geometry?.type === "LineString" ? response.geometry : null;
        } catch (_) {
            return null;
        }
    }

    async function calculateRoute(origin, destination) {
        const requestId = ++STATE.requestId;
        const host = document.getElementById("routing-workspace");
        host?.classList.add("routing-calculating");
        try {
            const route = await requestJSON(`/route/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`);
            if (requestId !== STATE.requestId) return;
            STATE.origin = origin;
            STATE.destination = destination;
            STATE.route = route;
            STATE.routeGeometry = await loadRouteGeometry(origin, destination);
            if (requestId !== STATE.requestId) return;
            STATE.zoom = 1;
            renderWorkspace();
        } catch (error) {
            if (requestId !== STATE.requestId) return;
            setRouteResultError(error?.message || "No route is available for the selected wards.");
        } finally {
            host?.classList.remove("routing-calculating");
        }
    }

    function setRouteResultError(message) {
        const host = document.getElementById("routing-workspace");
        if (!host) return;
        host.innerHTML = `<div class="routing-error-state"><div class="routing-error-icon">!</div><div><strong>Route unavailable</strong><span>${esc(message)}</span></div></div>`;
    }

    function bindRoutingControls() {
        const findButton = document.getElementById("find-route-btn");
        const swap = document.getElementById("routing-swap");
        const origin = document.getElementById("route-origin");
        const destination = document.getElementById("route-dest");

        findButton?.addEventListener("click", () => {
            if (!origin?.value || !destination?.value || origin.value === destination.value) {
                setRouteResultError("Origin and destination must be different wards.");
                return;
            }
            calculateRoute(origin.value, destination.value);
        });

        swap?.addEventListener("click", () => {
            if (!origin || !destination) return;
            const oldOrigin = origin.value;
            origin.value = destination.value;
            destination.value = oldOrigin;
        });

        document.querySelectorAll("[data-map]").forEach((button) => button.addEventListener("click", () => {
            if (button.dataset.map === "zoom-in") STATE.zoom += 0.2;
            if (button.dataset.map === "zoom-out") STATE.zoom -= 0.2;
            if (button.dataset.map === "reset") STATE.zoom = 1;
            applyMapScale();
        }));

        document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
            const action = button.dataset.action;
            if (action === "reverse") {
                const oldOrigin = STATE.origin;
                STATE.origin = STATE.destination;
                STATE.destination = oldOrigin;
                calculateRoute(STATE.origin, STATE.destination);
            } else if (action === "export") exportRouteGeoJSON();
            else if (action === "copy") copyDetails();
            else if (action === "full-map") openFullMap();
            else if (action === "show-roads") showAllRoads();
        }));
    }

    async function initializeRouting() {
        const host = document.getElementById("routing-workspace");
        if (!host) return;
        host.innerHTML = `<div class="routing-loading"><span></span><strong>LOADING CHENNAI ROAD NETWORK</strong><small>Fetching persisted OSM-derived road geometry…</small></div>`;
        try {
            const [wards, roadData] = await Promise.all([requestJSON("/world/wards"), requestJSON("/world/roads")]);
            STATE.wards = Array.isArray(wards?.features) ? wards.features : [];
            STATE.roads = Array.isArray(roadData?.roads) ? roadData.roads : [];
            if (!STATE.wards.length) throw new Error("/world/wards returned no ward features.");
            if (!STATE.roads.length) throw new Error("/world/roads returned no road records.");

            const unique = [...new Set(STATE.wards.map(wardId).filter(Boolean))];
            STATE.origin = unique.includes("W18901") ? "W18901" : unique[0] || null;
            STATE.destination = unique.includes("W18887") && unique.includes("W18901") ? "W18887" : unique.find((id) => id !== STATE.origin) || null;
            STATE.route = null;
            STATE.routeGeometry = null;
            renderWorkspace();
            if (STATE.origin && STATE.destination && STATE.origin !== STATE.destination) await calculateRoute(STATE.origin, STATE.destination);
        } catch (error) {
            host.innerHTML = `<div class="routing-error-state"><div class="routing-error-icon">!</div><div><strong>Routing network unavailable</strong><span>${esc(error?.message || "Could not load the persisted road network.")}</span></div></div>`;
        }
    }

    function showRouting() {
        if (typeof setActiveNavigation === "function") setActiveNavigation("routing");
        if (typeof setPage === "function") {
            setPage("Routing", "DISASTER-AWARE PATHFINDING", "Find the safest and fastest route between Chennai wards using the current disaster-aware road network.", `<div id="routing-workspace"></div>`);
        } else {
            const main = document.querySelector(".main-content");
            if (main) main.innerHTML = `<div id="routing-workspace"></div>`;
        }
        initializeRouting();
    }

    window.showRouting = showRouting;
    window.ROUTING_STATE = STATE;
})();
