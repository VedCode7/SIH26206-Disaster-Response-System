/* Lightweight Chennai Map Studio.
 *
 * Map Studio must never depend on the dashboard SVG already being painted.
 * The dashboard owns the persisted Chennai geography in DASHBOARD_RUNTIME;
 * this workspace reads that shared cache directly and waits for it when the
 * user opens the studio early. That removes the old one-frame race that left
 * every window stuck on "Preparing live Chennai view…".
 */
(function () {
    "use strict";

    const MAP_TYPES = {
        risk: { title: "Risk Heatmap", kicker: "SITUATIONAL RISK", description: "Ward-level risk concentration and severity." },
        flood: { title: "Flood Exposure", kicker: "HYDROLOGICAL VIEW", description: "Water depth and rainfall exposure across wards." },
        access: { title: "Accessibility", kicker: "MOBILITY VIEW", description: "Ward accessibility with restricted and blocked roads." },
        network: { title: "Road Network", kicker: "NETWORK VIEW", description: "Actual OSM road geometry and inter-ward connectivity." },
        response: { title: "Response Focus", kicker: "OPERATIONS VIEW", description: "Highest-risk wards and their surrounding road access." },
    };

    const MAX_WAIT_MS = 20000;
    const POLL_MS = 100;
    let installed = false;
    let nextOffset = 0;

    function esc(value) {
        return typeof escapeHTML === "function"
            ? escapeHTML(String(value))
            : String(value).replace(/[&<>\'\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    }

    function runtimeData() {
        if (typeof DASHBOARD_RUNTIME !== "undefined" &&
            Array.isArray(DASHBOARD_RUNTIME.wards) &&
            Array.isArray(DASHBOARD_RUNTIME.roads) &&
            DASHBOARD_RUNTIME.wards.length &&
            DASHBOARD_RUNTIME.roads.length) {
            return {
                wards: DASHBOARD_RUNTIME.wards,
                roads: DASHBOARD_RUNTIME.roads,
            };
        }

        if (window.realDashboardGeoCache?.wards?.length && window.realDashboardGeoCache?.roads?.length) {
            return window.realDashboardGeoCache;
        }

        return null;
    }

    async function waitForRuntimeData() {
        const started = performance.now();

        if (typeof window.initializeRealDashboard === "function") {
            // The dashboard bootstrap is idempotent. Calling it here only
            // helps when Map Studio was opened before the dashboard finished.
            window.initializeRealDashboard().catch(() => {});
        }

        while (performance.now() - started < MAX_WAIT_MS) {
            const data = runtimeData();
            if (data) return data;
            await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }

        throw new Error("Chennai geography did not become available within 20 seconds.");
    }

    function assessments() {
        if (typeof DASHBOARD_RUNTIME !== "undefined" && DASHBOARD_RUNTIME.assessments instanceof Map) {
            return DASHBOARD_RUNTIME.assessments;
        }
        return window.realDashboardAssessments instanceof Map
            ? window.realDashboardAssessments
            : new Map();
    }

    function levelFor(a) {
        return String(a?.risk_level || "normal").toLowerCase();
    }

    function value(a, ...keys) {
        for (const key of keys) {
            const n = Number(a?.factors?.[key]);
            if (Number.isFinite(n)) return n;
        }
        return 0;
    }

    function wardClass(type, a) {
        if (type === "risk" || type === "response") return levelFor(a);
        if (type === "flood") {
            const water = value(a, "water_depth_m", "water");
            const rain = value(a, "rainfall_mm_per_hr", "rainfall");
            if (water >= 2 || rain >= 100) return "critical";
            if (water >= 1 || rain >= 50) return "high";
            if (water > 0 || rain > 0) return "watch";
            return "low";
        }
        if (type === "access") {
            const access = a?.factors?.accessibility_percent !== undefined
                ? Number(a.factors.accessibility_percent)
                : Math.max(0, 100 - value(a, "accessibility_risk"));
            if (access < 35) return "critical";
            if (access < 70) return "watch";
            return "good";
        }
        return "good";
    }

    function roadClass(road) {
        if (road?.blocked) return "critical";
        if (Number(road?.accessibility_percent ?? 100) < 70) return "watch";
        return "good";
    }

    function wardId(feature) {
        const raw = feature?.properties?.ward_id ?? feature?.properties?.ward;
        return raw === undefined || raw === null ? null : `W${raw}`;
    }

    function collectCoordinates(value, points) {
        if (!Array.isArray(value)) return;
        if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
            points.push([Number(value[0]), Number(value[1])]);
            return;
        }
        value.forEach((child) => collectCoordinates(child, points));
    }

    function buildProjection(data, width, height) {
        const points = [];
        data.roads.forEach((road) => collectCoordinates(road.path, points));
        if (!points.length) {
            data.wards.forEach((ward) => collectCoordinates(ward.geometry?.coordinates, points));
        }
        if (!points.length) return null;

        const xs = points.map((p) => p[0]);
        const ys = points.map((p) => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const pad = 22;
        const spanX = Math.max(maxX - minX, 0.000001);
        const spanY = Math.max(maxY - minY, 0.000001);
        const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
        const drawW = spanX * scale;
        const drawH = spanY * scale;
        const ox = (width - drawW) / 2;
        const oy = (height - drawH) / 2;

        return (lon, lat) => [
            ox + (Number(lon) - minX) * scale,
            height - (oy + (Number(lat) - minY) * scale),
        ];
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
                const d = line(ring);
                return d ? `${d} Z` : "";
            }).filter(Boolean).join(" ");
        };

        if (geometry.type === "Polygon") return polygon(geometry.coordinates);
        if (geometry.type === "MultiPolygon") return geometry.coordinates.map(polygon).filter(Boolean).join(" ");
        return "";
    }

    function roadPath(road, project) {
        if (!Array.isArray(road?.path) || road.path.length < 2) return "";
        return road.path.map((point, index) => {
            const [x, y] = project(point[0], point[1]);
            return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(" ");
    }

    function makeSvg(type, data) {
        const width = 720;
        const height = 410;
        const project = buildProjection(data, width, height);
        if (!project) return null;

        const mapAssessments = assessments();
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("map-studio-svg");
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.setAttribute("aria-label", `${MAP_TYPES[type].title} for Chennai`);

        const wardsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        wardsLayer.classList.add("studio-ward-layer");
        data.wards.forEach((sourceWard) => {
            const id = wardId(sourceWard);
            const d = geometryPath(sourceWard.geometry, project);
            if (!id || !d) return;
            const ward = document.createElementNS("http://www.w3.org/2000/svg", "path");
            ward.classList.add("studio-ward", wardClass(type, mapAssessments.get(id)));
            ward.dataset.zoneId = id;
            ward.setAttribute("d", d);
            wardsLayer.appendChild(ward);
        });
        svg.appendChild(wardsLayer);

        const roadsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        roadsLayer.classList.add("studio-road-layer");
        const limit = type === "network" || type === "access" || type === "response" ? 1000 : 350;
        const step = Math.max(1, Math.ceil(data.roads.length / limit));
        data.roads.forEach((sourceRoad, index) => {
            if (index % step !== 0) return;
            const d = roadPath(sourceRoad, project);
            if (!d) return;
            const road = document.createElementNS("http://www.w3.org/2000/svg", "path");
            road.classList.add("studio-road", roadClass(sourceRoad));
            road.setAttribute("d", d);
            roadsLayer.appendChild(road);
        });
        svg.appendChild(roadsLayer);

        return svg;
    }

    function createWindow(host, type) {
        const spec = MAP_TYPES[type] || MAP_TYPES.risk;
        const el = document.createElement("section");
        el.className = "map-studio-window";
        const offset = (nextOffset++ % 4) * 34;
        el.style.left = `${80 + offset}px`;
        el.style.top = `${78 + offset}px`;
        el.innerHTML = `
            <header class="map-studio-window-head">
                <div>
                    <span class="map-studio-kicker">${esc(spec.kicker)}</span>
                    <strong>${esc(spec.title)}</strong>
                    <small>${esc(spec.description)}</small>
                </div>
                <button type="button" class="map-studio-close" aria-label="Close map">×</button>
            </header>
            <div class="map-studio-body">
                <div class="map-studio-loading">Preparing live Chennai view…</div>
            </div>`;
        host.appendChild(el);

        const close = el.querySelector(".map-studio-close");
        close.addEventListener("click", (event) => {
            event.stopPropagation();
            el.remove();
        });

        hydrateWindow(el, type);
        return el;
    }

    async function hydrateWindow(el, type) {
        const body = el.querySelector(".map-studio-body");
        if (!body || !el.isConnected) return;

        try {
            const data = await waitForRuntimeData();
            if (!el.isConnected) return;
            const svg = makeSvg(type, data);
            if (!svg) throw new Error("Chennai geography contains no drawable coordinates.");
            body.replaceChildren(svg);

            svg.querySelectorAll(".studio-ward").forEach((ward) => {
                ward.addEventListener("click", () => {
                    if (typeof window.selectDashboardZone === "function") {
                        window.selectDashboardZone(ward.dataset.zoneId);
                    }
                });
            });
        } catch (error) {
            if (!el.isConnected) return;
            body.innerHTML = `
                <div class="map-studio-empty">
                    <strong>Chennai geography unavailable</strong>
                    <span>${esc(error.message)}</span>
                    <button type="button" class="map-studio-retry">Retry</button>
                </div>`;
            body.querySelector(".map-studio-retry")?.addEventListener("click", () => {
                body.innerHTML = `<div class="map-studio-loading">Preparing live Chennai view…</div>`;
                hydrateWindow(el, type);
            });
        }
    }

    function ensureHost() {
        let host = document.querySelector(".map-studio-host");
        if (!host) {
            host = document.createElement("div");
            host.className = "map-studio-host";
            host.innerHTML = `
                <div class="map-studio-backdrop"></div>
                <div class="map-studio-topbar">
                    <div><span>LIVE GEOSPATIAL WORKSPACE</span><strong>Chennai Map Studio</strong></div>
                    <div class="map-studio-top-actions">
                        <button type="button" class="map-studio-open-all">Open all</button>
                        <button type="button" class="map-studio-tile">Tile</button>
                        <button type="button" class="map-studio-stack">Stack</button>
                        <button type="button" class="map-studio-close-all">Close workspace</button>
                    </div>
                </div>`;
            document.body.appendChild(host);

            host.querySelector(".map-studio-backdrop").addEventListener("click", closeWorkspace);
            host.querySelector(".map-studio-close-all").addEventListener("click", closeWorkspace);
            host.querySelector(".map-studio-open-all").addEventListener("click", () => {
                Object.keys(MAP_TYPES).forEach((type) => open(type));
            });
            host.querySelector(".map-studio-tile").addEventListener("click", tileWindows);
            host.querySelector(".map-studio-stack").addEventListener("click", stackWindows);
        }
        host.hidden = false;
        return host;
    }

    function open(type = "risk") {
        const host = ensureHost();
        const existing = [...host.querySelectorAll(".map-studio-window")];
        if (existing.some((win) => win.dataset.mapType === type)) return;
        const win = createWindow(host, type);
        win.dataset.mapType = type;
    }

    function tileWindows() {
        const host = document.querySelector(".map-studio-host");
        if (!host) return;
        const windows = [...host.querySelectorAll(".map-studio-window")];
        const columns = windows.length <= 1 ? 1 : windows.length <= 2 ? 2 : 2;
        const gap = 14;
        const width = Math.max(320, (host.clientWidth - gap * (columns + 1)) / columns);
        const height = Math.max(260, (host.clientHeight - 88 - gap * 3) / Math.ceil(windows.length / columns));
        windows.forEach((win, index) => {
            const row = Math.floor(index / columns);
            const column = index % columns;
            win.style.left = `${gap + column * (width + gap)}px`;
            win.style.top = `${76 + gap + row * (height + gap)}px`;
            win.style.width = `${width}px`;
            win.style.height = `${height}px`;
        });
    }

    function stackWindows() {
        const host = document.querySelector(".map-studio-host");
        if (!host) return;
        [...host.querySelectorAll(".map-studio-window")].forEach((win, index) => {
            win.style.width = "min(760px, calc(100vw - 120px))";
            win.style.height = "min(560px, calc(100vh - 150px))";
            win.style.left = `${80 + index * 26}px`;
            win.style.top = `${78 + index * 26}px`;
            win.style.zIndex = 100 + index;
        });
    }

    function closeWorkspace() {
        const host = document.querySelector(".map-studio-host");
        if (!host) return;
        host.hidden = true;
        host.querySelectorAll(".map-studio-window").forEach((win) => win.remove());
        nextOffset = 0;
    }

    function install() {
        if (installed) return;
        installed = true;
        window.openMapStudio = open;
        window.closeMapStudio = closeWorkspace;
    }

    install();
})();
