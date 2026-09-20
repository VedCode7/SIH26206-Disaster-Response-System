/* Lightweight Chennai Map Studio.
 *
 * The production dashboard already owns the expensive 200-ward / 6,625-road
 * SVG. Map Studio should reuse that rendered geometry instead of rebuilding
 * every OSM path synchronously. This keeps the workspace responsive while
 * preserving real Chennai data and ward selection.
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

    let installed = false;
    let nextOffset = 0;

    function esc(value) {
        return typeof escapeHTML === "function"
            ? escapeHTML(String(value))
            : String(value).replace(/[&<>\'\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    }

    function assessment(zoneId) {
        return window.realDashboardAssessments instanceof Map
            ? window.realDashboardAssessments.get(zoneId)
            : null;
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
        if (road.classList.contains("blocked")) return "critical";
        if (road.classList.contains("restricted")) return "watch";
        return "good";
    }

    function makeSvg(type) {
        const source = document.querySelector(".real-chennai-map");
        if (!source) return null;

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("map-studio-svg");
        svg.setAttribute("viewBox", source.getAttribute("viewBox") || "0 0 900 330");
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.setAttribute("aria-label", `${MAP_TYPES[type].title} for Chennai`);

        const wardsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        wardsLayer.classList.add("studio-ward-layer");
        source.querySelectorAll(".real-ward").forEach((sourceWard) => {
            const ward = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const id = sourceWard.dataset.zoneId;
            ward.classList.add("studio-ward", wardClass(type, assessment(id)));
            ward.dataset.zoneId = id;
            ward.setAttribute("d", sourceWard.getAttribute("d") || "");
            wardsLayer.appendChild(ward);
        });
        svg.appendChild(wardsLayer);

        const roadsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        roadsLayer.classList.add("studio-road-layer");
        const sourceRoads = [...source.querySelectorAll(".real-road")];
        const limit = type === "network" || type === "access" || type === "response" ? 1000 : 350;
        const step = Math.max(1, Math.ceil(sourceRoads.length / limit));
        sourceRoads.forEach((sourceRoad, index) => {
            if (index % step !== 0) return;
            const road = document.createElementNS("http://www.w3.org/2000/svg", "path");
            road.classList.add("studio-road", roadClass(sourceRoad));
            road.setAttribute("d", sourceRoad.getAttribute("d") || "");
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

        // Yield to the browser so the workspace shell paints before the
        // geometry is cloned. The main dashboard remains interactive.
        requestAnimationFrame(() => {
            if (!el.isConnected) return;
            const body = el.querySelector(".map-studio-body");
            const svg = makeSvg(type);
            if (!body || !svg) {
                if (body) body.innerHTML = `<div class="map-studio-empty">Chennai geography is still loading.</div>`;
                return;
            }
            body.replaceChildren(svg);
        });

        return el;
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
                    <button type="button" class="map-studio-close-all">Close workspace</button>
                </div>`;
            document.body.appendChild(host);
            host.querySelector(".map-studio-backdrop").addEventListener("click", closeWorkspace);
            host.querySelector(".map-studio-close-all").addEventListener("click", closeWorkspace);
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

    function closeWorkspace() {
        const host = document.querySelector(".map-studio-host");
        if (!host) return;
        host.hidden = true;
        host.querySelectorAll(".map-studio-window").forEach((win) => win.remove());
        nextOffset = 0;
    }

    function install() {
        if (installed || typeof window.openMapStudio !== "function") return;
        installed = true;
        window.openMapStudio = open;
        window.closeMapStudio = closeWorkspace;
    }

    function boot() {
        if (typeof window.openMapStudio === "function") {
            install();
            return;
        }
        setTimeout(boot, 50);
    }

    boot();
})();
