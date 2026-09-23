/*
 * Disaster-aware routing visualisation.
 *
 * This module owns only the Routing view. It consumes the existing route,
 * ward and road APIs and never invents geography. The route result remains
 * authoritative; this layer turns it into an operational visualisation.
 */
(function () {
    "use strict";

    const ROUTING_STATE = {
        requestId: 0,
        wards: [],
        roads: [],
        route: null,
        origin: null,
        destination: null,
        mapScale: 1,
    };

    const esc = (value) => {
        if (typeof escapeHTML === "function") return escapeHTML(value);
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
        }[char]));
    };

    const number = (value, fallback = 0) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const formatDistance = (value) => `${number(value).toFixed(4)} km`;
    const formatTime = (value) => `${number(value).toFixed(2)} min`;

    const requestJSON = async (endpoint, options = {}) => {
        if (typeof fetchJSON === "function") return fetchJSON(endpoint, options);
        const response = await fetch(`${window.API_BASE || "http://127.0.0.1:8000"}${endpoint}`, options);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json();
    };

    function wardId(feature) {
        const raw = feature?.properties?.ward_id ?? feature?.properties?.ward;
        return raw === undefined || raw === null ? null : `W${raw}`;
    }

    function collectCoordinates(value, points) {
        if (!Array.isArray(value)) return;
        if (
            value.length >= 2 &&
            Number.isFinite(Number(value[0])) &&
            Number.isFinite(Number(value[1]))
        ) {
            points.push([Number(value[0]), Number(value[1])]);
            return;
        }
        value.forEach((child) => collectCoordinates(child, points));
    }

    function geometryPath(geometry, project) {
        if (!geometry) return "";

        const line = (coordinates) => {
            if (!Array.isArray(coordinates) || coordinates.length < 2) return "";
            return coordinates.map((point, index) => {
                const [x, y] = project(point[0], point[1]);
                return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
            }).join(" ");
        };

        const polygon = (rings) => {
            if (!Array.isArray(rings)) return "";
            return rings.map((ring) => {
                const path = line(ring);
                return path ? `${path} Z` : "";
            }).filter(Boolean).join(" ");
        };

        if (geometry.type === "Polygon") return polygon(geometry.coordinates);
        if (geometry.type === "MultiPolygon") {
            return geometry.coordinates.map(polygon).filter(Boolean).join(" ");
        }
        return "";
    }

    function buildProjection(wards, roads, width, height) {
        const points = [];
        roads.forEach((road) => collectCoordinates(road.path, points));
        wards.forEach((ward) => collectCoordinates(ward.geometry?.coordinates, points));
        if (!points.length) return null;

        const xs = points.map((point) => point[0]);
        const ys = points.map((point) => point[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const spanX = Math.max(maxX - minX, 1e-9);
        const spanY = Math.max(maxY - minY, 1e-9);
        const padding = 28;
        const scale = Math.min(
            (width - padding * 2) / spanX,
            (height - padding * 2) / spanY
        );
        const drawnWidth = spanX * scale;
        const drawnHeight = spanY * scale;
        const offsetX = (width - drawnWidth) / 2;
        const offsetY = (height - drawnHeight) / 2;

        return (lon, lat) => [
            offsetX + (Number(lon) - minX) * scale,
            height - (offsetY + (Number(lat) - minY) * scale),
        ];
    }

    function routeRoadSet(route) {
        return new Set(route?.road_path || []);
    }

    function routeZoneSet(route) {
        return new Set(route?.zone_path || []);
    }

    function routeSegments(route) {
        const roadsById = new Map(ROUTING_STATE.roads.map((road) => [road.id, road]));
        return (route?.road_path || []).map((id) => roadsById.get(id)).filter(Boolean);
    }

    function roadCondition(road) {
        if (road?.blocked) return "blocked";
        const access = number(road?.accessibility_percent, 100);
        if (access < 70) return "degraded";
        return "clear";
    }

    function routeCounts(route) {
        const segments = routeSegments(route);
        return segments.reduce((counts, road) => {
            counts.total += 1;
            counts[roadCondition(road)] += 1;
            return counts;
        }, { total: 0, clear: 0, degraded: 0, blocked: 0 });
    }

    function createRouteSvg(route) {
        const width = 920;
        const height = 520;
        const project = buildProjection(ROUTING_STATE.wards, ROUTING_STATE.roads, width, height);
        if (!project) return `<div class="routing-map-error">No geographic coordinates are available for the current network.</div>`;

        const routeRoadIds = routeRoadSet(route);
        const routeZoneIds = routeZoneSet(route);

        const wardPaths = ROUTING_STATE.wards.map((ward) => {
            const id = wardId(ward);
            const path = geometryPath(ward.geometry, project);
            if (!id || !path) return "";
            const stateClass = routeZoneIds.has(id)
                ? "routing-ward routing-ward-active"
                : "routing-ward";
            return `<path class="${stateClass}" data-zone-id="${esc(id)}" d="${path}" />`;
        }).filter(Boolean).join("");

        const roadPaths = ROUTING_STATE.roads.map((road) => {
            if (!Array.isArray(road.path) || road.path.length < 2) return "";
            const path = road.path.map((point, index) => {
                const [x, y] = project(point[0], point[1]);
                return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
            }).join(" ");
            const condition = roadCondition(road);
            const routeClass = routeRoadIds.has(road.id) ? " routing-road-route" : "";
            return `<path class="routing-road routing-road-${condition}${routeClass}" data-road-id="${esc(road.id)}" d="${path}" />`;
        }).filter(Boolean).join("");

        const zoneCenters = new Map();
        ROUTING_STATE.wards.forEach((ward) => {
            const id = wardId(ward);
            const points = [];
            collectCoordinates(ward.geometry?.coordinates, points);
            if (!id || !points.length) return;
            const avgLon = points.reduce((sum, point) => sum + point[0], 0) / points.length;
            const avgLat = points.reduce((sum, point) => sum + point[1], 0) / points.length;
            zoneCenters.set(id, project(avgLon, avgLat));
        });

        const originPoint = zoneCenters.get(route?.origin_zone_id);
        const destinationPoint = zoneCenters.get(route?.destination_zone_id);

        const marker = (point, type, label) => {
            if (!point) return "";
            const [x, y] = point;
            return `
                <g class="routing-marker routing-marker-${type}" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
                    <circle class="routing-marker-pulse" r="18"></circle>
                    <circle class="routing-marker-ring" r="11"></circle>
                    <circle class="routing-marker-core" r="6"></circle>
                    <text class="routing-marker-label" x="15" y="-13">${esc(label)}</text>
                </g>`;
        };

        const waypoints = (route?.zone_path || []).slice(1, -1).map((zoneId) => {
            const point = zoneCenters.get(zoneId);
            if (!point) return "";
            return `<circle class="routing-waypoint" cx="${point[0].toFixed(2)}" cy="${point[1].toFixed(2)}" r="4.2"><title>${esc(zoneId)}</title></circle>`;
        }).join("");

        return `
            <svg class="routing-map-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Disaster-aware route map">
                <defs>
                    <linearGradient id="routing-bg-grid" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#07111b"></stop>
                        <stop offset="100%" stop-color="#02070d"></stop>
                    </linearGradient>
                    <filter id="routing-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3.5" result="blur"></feGaussianBlur>
                        <feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
                    </filter>
                    <pattern id="routing-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                        <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(60,115,155,.13)" stroke-width="1"></path>
                    </pattern>
                </defs>
                <rect width="920" height="520" fill="url(#routing-bg-grid)"></rect>
                <rect width="920" height="520" fill="url(#routing-grid)"></rect>
                <g class="routing-ward-layer">${wardPaths}</g>
                <g class="routing-road-layer">${roadPaths}</g>
                <g class="routing-waypoint-layer">${waypoints}</g>
                <g class="routing-marker-layer">
                    ${marker(originPoint, "origin", route?.origin_zone_id)}
                    ${marker(destinationPoint, "destination", route?.destination_zone_id)}
                </g>
                <g class="routing-north-indicator" transform="translate(855 60)">
                    <circle r="24"></circle>
                    <path d="M0 -15 L7 8 L0 4 L-7 8 Z"></path>
                    <text x="0" y="35">N</text>
                </g>
                <g class="routing-map-labels">
                    <text x="24" y="30">LIVE NETWORK / ROUTE OVERLAY</text>
                    <text x="24" y="50">${esc(ROUTING_STATE.roads.length.toLocaleString())} ROAD LINKS · ${esc(ROUTING_STATE.wards.length)} WARDS</text>
                </g>
            </svg>`;
    }

    function renderMapLegend() {
        return `
            <div class="routing-map-legend">
                <span><i class="route-key route-key-clear"></i>Clear road</span>
                <span><i class="route-key route-key-degraded"></i>Degraded</span>
                <span><i class="route-key route-key-blocked"></i>Blocked / excluded</span>
                <span><i class="route-key route-key-boundary"></i>Ward boundary</span>
                <span><i class="route-key route-key-network"></i>Network</span>
            </div>`;
    }

    function renderSummary(route) {
        const counts = routeCounts(route);
        const zonePath = route?.zone_path || [];
        const roadPath = route?.road_path || [];

        return `
            <section class="routing-summary-panel">
                <div class="routing-panel-header">
                    <div>
                        <span class="routing-kicker">ROUTE SUMMARY</span>
                        <h3>Operational Route</h3>
                    </div>
                    <span class="routing-status routing-status-ready">ROUTE AVAILABLE</span>
                </div>

                <div class="routing-primary-metrics">
                    <div class="routing-metric routing-metric-large">
                        <span class="routing-metric-icon">◈</span>
                        <div><small>Distance</small><strong>${formatDistance(route?.total_distance_km)}</strong></div>
                    </div>
                    <div class="routing-metric routing-metric-large">
                        <span class="routing-metric-icon">◷</span>
                        <div><small>Estimated Time</small><strong>${formatTime(route?.total_travel_time_min)}</strong></div>
                    </div>
                </div>

                <div class="routing-condition-grid">
                    <div class="routing-condition"><small>Total Roads</small><strong>${counts.total}</strong></div>
                    <div class="routing-condition routing-condition-clear"><small>Clear</small><strong>${counts.clear}</strong></div>
                    <div class="routing-condition routing-condition-degraded"><small>Degraded</small><strong>${counts.degraded}</strong></div>
                    <div class="routing-condition routing-condition-blocked"><small>Blocked</small><strong>${counts.blocked}</strong></div>
                </div>

                <div class="routing-subsection">
                    <div class="routing-subsection-title">WARD PATH <span>${zonePath.length ? `${zonePath.length} nodes` : ""}</span></div>
                    <div class="routing-path-track">
                        ${zonePath.map((zoneId, index) => `
                            <div class="routing-path-node ${index === 0 ? "is-origin" : index === zonePath.length - 1 ? "is-destination" : ""}">
                                <span>${esc(zoneId)}</span>
                            </div>
                            ${index < zonePath.length - 1 ? `<div class="routing-path-link"></div>` : ""}`
                        ).join("")}
                    </div>
                </div>

                <div class="routing-subsection routing-road-sequence">
                    <div class="routing-subsection-title">ROAD SEQUENCE <span>${roadPath.length} segments</span></div>
                    <div class="routing-road-table">
                        ${roadPath.slice(0, 6).map((roadId, index) => {
                            const road = ROUTING_STATE.roads.find((item) => item.id === roadId);
                            const condition = roadCondition(road);
                            return `<div class="routing-road-row">
                                <span class="routing-road-index">${index + 1}</span>
                                <strong title="${esc(roadId)}">${esc(roadId)}</strong>
                                <span>${road ? formatDistance(road.distance_km) : "—"}</span>
                                <b class="routing-mini-state routing-mini-${condition}">${condition.toUpperCase()}</b>
                            </div>`;
                        }).join("")}
                    </div>
                    ${roadPath.length > 6 ? `<button type="button" class="routing-more-btn" data-action="show-roads">Show all ${roadPath.length} segments⌄</button>` : ""}
                </div>
            </section>`;
    }

    function renderProfile(route) {
        const segments = routeSegments(route);
        if (!segments.length) {
            return `<section class="routing-profile-card"><div class="routing-profile-empty">No traversable road segments were returned.</div></section>`;
        }

        const width = 640;
        const height = 150;
        const pad = { left: 34, right: 18, top: 18, bottom: 28 };
        const usableW = width - pad.left - pad.right;
        const usableH = height - pad.top - pad.bottom;
        const cumulative = [];
        let distance = 0;
        segments.forEach((road) => {
            distance += number(road.distance_km);
            cumulative.push({ distance, accessibility: number(road.accessibility_percent, 100) });
        });
        const maxDistance = Math.max(distance, 0.0001);
        const points = cumulative.map((item, index) => {
            const x = pad.left + (index / Math.max(cumulative.length - 1, 1)) * usableW;
            const y = pad.top + ((100 - item.accessibility) / 100) * usableH;
            return [x, y];
        });
        const line = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(" ");
        const area = `${line} L ${(pad.left + usableW).toFixed(1)} ${(pad.top + usableH).toFixed(1)} L ${pad.left.toFixed(1)} ${(pad.top + usableH).toFixed(1)} Z`;

        return `
            <section class="routing-profile-card">
                <div class="routing-card-heading">
                    <div><span class="routing-card-icon">⌁</span><strong>Route Condition Profile</strong> <em>(Accessibility)</em></div>
                    <span class="routing-profile-note">Current road state</span>
                </div>
                <svg class="routing-profile-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="Route accessibility profile">
                    <g class="routing-profile-grid">
                        <line x1="34" y1="18" x2="622" y2="18"></line>
                        <line x1="34" y1="70" x2="622" y2="70"></line>
                        <line x1="34" y1="122" x2="622" y2="122"></line>
                    </g>
                    <path class="routing-profile-area" d="${area}"></path>
                    <path class="routing-profile-line" d="${line}"></path>
                    <text x="4" y="22">100%</text><text x="4" y="74">50%</text><text x="8" y="126">0%</text>
                    <text x="34" y="145">0 km</text><text x="585" y="145">${esc(maxDistance.toFixed(2))} km</text>
                </svg>
            </section>`;
    }

    function renderInsights(route) {
        const counts = routeCounts(route);
        const blockedNetwork = ROUTING_STATE.roads.filter((road) => road.blocked).length;
        const degraded = counts.degraded;
        const lines = [
            { type: "good", text: "Shortest currently available route considering road conditions" },
            { type: degraded ? "warn" : "good", text: degraded ? `${degraded} degraded route segment${degraded === 1 ? "" : "s"} may reduce travel speed` : "No degraded segments on the selected route" },
            { type: "good", text: blockedNetwork ? `${blockedNetwork} blocked network segment${blockedNetwork === 1 ? "" : "s"} excluded from traversal` : "No blocked road segments in the current network" },
            { type: "good", text: `Passes through ${Math.max(0, (route?.zone_path || []).length)} ward nodes` },
            { type: "good", text: "Route remains valid under the current network state" },
        ];
        return `
            <section class="routing-insights-card">
                <div class="routing-card-heading"><div><span class="routing-card-icon">◉</span><strong>Route Insights</strong></div></div>
                <div class="routing-insight-list">
                    ${lines.map((line) => `<div class="routing-insight"><i class="routing-insight-${line.type}">${line.type === "warn" ? "!" : "✓"}</i><span>${esc(line.text)}</span></div>`).join("")}
                </div>
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
        const blocked = ROUTING_STATE.roads.filter((road) => road.blocked).length;
        const degraded = ROUTING_STATE.roads.filter((road) => !road.blocked && number(road.accessibility_percent, 100) < 70).length;
        return `
            <div class="routing-scenario">
                <div class="routing-scenario-icon">⌁</div>
                <div><small>ACTIVE SCENARIO</small><strong>Current Chennai network</strong><div><b>${blocked} blocked</b><b>${degraded} degraded</b></div></div>
            </div>`;
    }

    function renderControls() {
        const wards = ROUTING_STATE.wards.map((ward) => wardId(ward)).filter(Boolean);
        const uniqueWards = [...new Set(wards)];
        const options = uniqueWards.map((id) => `<option value="${esc(id)}">${esc(id)}</option>`).join("");
        return `
            <section class="routing-control-panel">
                <div class="routing-select-group">
                    <label>Origin Ward<select id="route-origin" class="routing-select">${options}</select></label>
                    <button type="button" id="routing-swap" class="routing-swap" aria-label="Swap origin and destination">⇄</button>
                    <label>Destination Ward<select id="route-dest" class="routing-select">${options}</select></label>
                    <button type="button" id="find-route-btn" class="routing-find-button">⌁ <span>Find Best Route</span></button>
                </div>
            </section>`;
    }

    function renderShell(route) {
        return `
            <div class="routing-page">
                <div class="routing-heading-row">
                    <div>
                        <p class="routing-eyebrow">DISASTER-AWARE PATHFINDING</p>
                        <h1>Routing</h1>
                        <p class="routing-subtitle">Find the safest and fastest route between Chennai wards using the current disaster-aware road network.</p>
                    </div>
                    ${renderScenarioBadge()}
                </div>
                ${renderControls()}
                ${route ? `
                    <div class="routing-main-grid">
                        <section class="routing-map-panel">
                            <div class="routing-map-title"><span>⌁</span> ROUTE MAP</div>
                            <div class="routing-map-viewport">
                                ${createRouteSvg(route)}
                                ${renderMapLegend()}
                                <div class="routing-map-controls"><button type="button" data-map="zoom-in">+</button><button type="button" data-map="zoom-out">−</button><button type="button" data-map="reset">◎</button></div>
                                <div class="routing-scale">0&nbsp;&nbsp;&nbsp;&nbsp;2&nbsp;&nbsp;&nbsp;&nbsp;4 km</div>
                            </div>
                        </section>
                        ${renderSummary(route)}
                    </div>
                    <div class="routing-bottom-grid">
                        ${renderProfile(route)}
                        ${renderInsights(route)}
                        ${renderQuickActions()}
                    </div>
                ` : `
                    <div class="routing-empty-state">
                        <div class="routing-empty-icon">⌁</div>
                        <strong>Select two wards to calculate a disaster-aware route.</strong>
                        <span>The visual network will render the actual persisted road geometry and the calculated route.</span>
                    </div>`}
            </div>`;
    }

    function setRouteResultError(message) {
        const box = document.getElementById("routing-workspace");
        if (!box) return;
        box.innerHTML = `
            <div class="routing-error-state">
                <div class="routing-error-icon">!</div>
                <div><strong>No route available</strong><span>${esc(message)}</span></div>
            </div>`;
    }

    function setLoadingState() {
        const box = document.getElementById("routing-workspace");
        if (!box) return;
        box.innerHTML = `<div class="routing-loading"><span></span><strong>CALCULATING ROUTE</strong><small>Evaluating current road accessibility and blocked status…</small></div>`;
    }

    function updateSelectValues() {
        const origin = document.getElementById("route-origin");
        const dest = document.getElementById("route-dest");
        if (origin) origin.value = ROUTING_STATE.origin;
        if (dest) dest.value = ROUTING_STATE.destination;
    }

    async function calculateRoute(origin, destination) {
        const requestId = ++ROUTING_STATE.requestId;
        ROUTING_STATE.origin = origin;
        ROUTING_STATE.destination = destination;
        setLoadingState();

        try {
            const route = await requestJSON(`/route/${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`);
            if (requestId !== ROUTING_STATE.requestId) return;
            ROUTING_STATE.route = route;
            renderWorkspace();
        } catch (error) {
            if (requestId !== ROUTING_STATE.requestId) return;
            setRouteResultError(error?.message || "The routing service could not find a traversable path.");
        }
    }

    function exportRouteGeoJSON() {
        const route = ROUTING_STATE.route;
        if (!route) return;
        const roadById = new Map(ROUTING_STATE.roads.map((road) => [road.id, road]));
        const features = (route.road_path || []).map((roadId) => {
            const road = roadById.get(roadId);
            if (!road?.path?.length) return null;
            return {
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
            };
        }).filter(Boolean);
        const geojson = {
            type: "FeatureCollection",
            properties: {
                origin_zone_id: route.origin_zone_id,
                destination_zone_id: route.destination_zone_id,
                total_distance_km: route.total_distance_km,
                total_travel_time_min: route.total_travel_time_min,
            },
            features,
        };
        const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `route-${route.origin_zone_id}-${route.destination_zone_id}.geojson`;
        link.click();
        URL.revokeObjectURL(url);
    }

    async function copyDetails() {
        const route = ROUTING_STATE.route;
        if (!route) return;
        const text = [
            `Route: ${route.origin_zone_id} → ${route.destination_zone_id}`,
            `Distance: ${formatDistance(route.total_distance_km)}`,
            `Estimated time: ${formatTime(route.total_travel_time_min)}`,
            `Ward path: ${(route.zone_path || []).join(" → ")}`,
            `Road path: ${(route.road_path || []).join(", ")}`,
        ].join("\n");
        try {
            await navigator.clipboard.writeText(text);
            const button = document.querySelector('[data-action="copy"] span');
            if (button) {
                const old = button.textContent;
                button.textContent = "Copied";
                setTimeout(() => { button.textContent = old; }, 1200);
            }
        } catch (_) {
            window.prompt("Copy route details", text);
        }
    }

    function renderWorkspace() {
        const host = document.getElementById("routing-workspace");
        if (!host) return;
        host.innerHTML = renderShell(ROUTING_STATE.route);
        bindRoutingControls();
        updateSelectValues();
        ROUTING_STATE.mapScale = 1;
    }

    function applyMapScale() {
        const svg = document.querySelector(".routing-map-svg");
        if (!svg) return;
        const scale = Math.max(1, Math.min(2.4, ROUTING_STATE.mapScale));
        svg.style.transform = `scale(${scale})`;
        svg.style.transformOrigin = "50% 50%";
    }

    function openFullMap() {
        const route = ROUTING_STATE.route;
        if (!route) return;
        const backdrop = document.createElement("div");
        backdrop.className = "routing-fullmap-backdrop";
        backdrop.innerHTML = `
            <div class="routing-fullmap-dialog">
                <div class="routing-fullmap-header">
                    <div><span>ROUTE MAP</span><strong>${esc(route.origin_zone_id)} → ${esc(route.destination_zone_id)}</strong></div>
                    <button type="button" class="routing-fullmap-close" aria-label="Close full map">×</button>
                </div>
                <div class="routing-fullmap-body">${createRouteSvg(route)}</div>
            </div>`;
        document.body.appendChild(backdrop);
        const close = () => backdrop.remove();
        backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
        backdrop.querySelector(".routing-fullmap-close")?.addEventListener("click", close);
        document.addEventListener("keydown", function escHandler(event) {
            if (event.key === "Escape") { close(); document.removeEventListener("keydown", escHandler); }
        });
    }

    function showAllRoads() {
        const route = ROUTING_STATE.route;
        if (!route) return;
        const roadsById = new Map(ROUTING_STATE.roads.map((road) => [road.id, road]));
        const rows = (route.road_path || []).map((roadId, index) => {
            const road = roadsById.get(roadId);
            const condition = roadCondition(road);
            return `<div class="routing-road-row"><span class="routing-road-index">${index + 1}</span><strong>${esc(roadId)}</strong><span>${road ? formatDistance(road.distance_km) : "—"}</span><b class="routing-mini-state routing-mini-${condition}">${condition.toUpperCase()}</b></div>`;
        }).join("");
        const existing = document.querySelector(".routing-road-table");
        if (existing) existing.innerHTML = rows;
        document.querySelector("[data-action=show-roads]")?.remove();
    }

    function bindRoutingControls() {
        const findButton = document.getElementById("find-route-btn");
        const swap = document.getElementById("routing-swap");
        const origin = document.getElementById("route-origin");
        const destination = document.getElementById("route-dest");

        if (findButton) {
            findButton.addEventListener("click", () => {
                const from = origin?.value;
                const to = destination?.value;
                if (!from || !to || from === to) {
                    setRouteResultError("Origin and destination must be different wards.");
                    return;
                }
                calculateRoute(from, to);
            });
        }

        document.querySelectorAll("[data-map]").forEach((button) => {
            button.addEventListener("click", () => {
                const action = button.dataset.map;
                if (action === "zoom-in") ROUTING_STATE.mapScale += 0.2;
                if (action === "zoom-out") ROUTING_STATE.mapScale -= 0.2;
                if (action === "reset") ROUTING_STATE.mapScale = 1;
                applyMapScale();
            });
        });

        if (swap) {
            swap.addEventListener("click", () => {
                const oldOrigin = origin?.value;
                const oldDestination = destination?.value;
                if (origin) origin.value = oldDestination;
                if (destination) destination.value = oldOrigin;
            });
        }

        document.querySelectorAll("[data-action]").forEach((button) => {
            button.addEventListener("click", () => {
                const action = button.dataset.action;
                if (action === "reverse") {
                    const oldOrigin = ROUTING_STATE.origin;
                    ROUTING_STATE.origin = ROUTING_STATE.destination;
                    ROUTING_STATE.destination = oldOrigin;
                    calculateRoute(ROUTING_STATE.origin, ROUTING_STATE.destination);
                } else if (action === "export") {
                    exportRouteGeoJSON();
                } else if (action === "copy") {
                    copyDetails();
                } else if (action === "full-map") {
                    openFullMap();
                } else if (action === "show-roads") {
                    showAllRoads();
                }
            });
        });
    }

    async function initializeRouting() {
        const host = document.getElementById("routing-workspace");
        if (!host) return;
        host.innerHTML = `<div class="routing-loading"><span></span><strong>LOADING CHENNAI NETWORK</strong><small>Fetching ward boundaries and persisted road geometry…</small></div>`;

        try {
            const [wards, roadData] = await Promise.all([
                requestJSON("/world/wards"),
                requestJSON("/world/roads"),
            ]);
            ROUTING_STATE.wards = Array.isArray(wards?.features) ? wards.features : [];
            ROUTING_STATE.roads = Array.isArray(roadData?.roads) ? roadData.roads : [];
            if (!ROUTING_STATE.wards.length) throw new Error("/world/wards returned no ward features.");
            if (!ROUTING_STATE.roads.length) throw new Error("/world/roads returned no road records.");

            const ids = ROUTING_STATE.wards.map(wardId).filter(Boolean);
            const unique = [...new Set(ids)];
            ROUTING_STATE.origin = unique.includes("W18901") ? "W18901" : (unique[0] || null);
            ROUTING_STATE.destination = unique.includes("W18887") && "W18887" !== ROUTING_STATE.origin
                ? "W18887"
                : (unique.find((id) => id !== ROUTING_STATE.origin) || null);
            ROUTING_STATE.route = null;
            renderWorkspace();
            if (ROUTING_STATE.origin && ROUTING_STATE.destination && ROUTING_STATE.origin !== ROUTING_STATE.destination) {
                calculateRoute(ROUTING_STATE.origin, ROUTING_STATE.destination);
            }
        } catch (error) {
            host.innerHTML = `<div class="routing-error-state"><div class="routing-error-icon">!</div><div><strong>Routing network unavailable</strong><span>${esc(error?.message || "Could not load routing geography.")}</span></div></div>`;
        }
    }

    function showRouting() {
        if (typeof setActiveNavigation === "function") setActiveNavigation("routing");
        if (typeof setPage === "function") {
            setPage(
                "Routing",
                "DISASTER-AWARE PATHFINDING",
                "Find the safest and fastest route between Chennai wards using the current disaster-aware road network.",
                `<div id="routing-workspace"></div>`
            );
        } else {
            const main = document.querySelector(".main-content");
            if (main) main.innerHTML = `<div id="routing-workspace"></div>`;
        }
        initializeRouting();
    }

    window.showRouting = showRouting;
    window.ROUTING_STATE = ROUTING_STATE;
})();
