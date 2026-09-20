(function () {
    "use strict";

    const state = {
        windows: new Map(),
        z: 100,
        nextOffset: 0,
    };

    const MAPS = {
        risk: {
            title: "Risk Heatmap",
            kicker: "SITUATIONAL RISK",
            description: "Ward-level risk concentration and severity.",
            legend: [["normal", "Normal"], ["watch", "Watch"], ["high", "High"], ["critical", "Critical"]],
        },
        flood: {
            title: "Flood Exposure",
            kicker: "HYDROLOGICAL VIEW",
            description: "Water depth and rainfall exposure across wards.",
            legend: [["low", "Low"], ["watch", "Elevated"], ["high", "Severe"], ["critical", "Extreme"]],
        },
        access: {
            title: "Accessibility",
            kicker: "MOBILITY VIEW",
            description: "Ward accessibility with restricted and blocked roads.",
            legend: [["good", "Open"], ["watch", "Restricted"], ["critical", "Blocked"]],
        },
        network: {
            title: "Road Network",
            kicker: "NETWORK VIEW",
            description: "Actual OSM road geometry and inter-ward connectivity.",
            legend: [["good", "Open"], ["watch", "Restricted"], ["critical", "Blocked"]],
        },
        response: {
            title: "Response Focus",
            kicker: "OPERATIONS VIEW",
            description: "Highest-risk wards and their surrounding road access.",
            legend: [["critical", "Priority"], ["watch", "Watch"], ["good", "Available"]],
        },
    };

    function esc(value) {
        return typeof escapeHTML === "function"
            ? escapeHTML(String(value))
            : String(value).replace(/[&<>\'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    }

    function getData() {
        return window.realDashboardGeoCache || null;
    }

    function getAssessments() {
        return window.realDashboardAssessments instanceof Map ? window.realDashboardAssessments : new Map();
    }

    function levelFor(assessment) {
        return String(assessment?.risk_level || "normal").toLowerCase();
    }

    function numericFactor(assessment, key, fallback) {
        const value = assessment?.factors?.[key];
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function buildProjection(wards, roads, width, height) {
        const points = [];
        roads.forEach((road) => {
            if (Array.isArray(road.path)) road.path.forEach((p) => {
                if (Array.isArray(p) && p.length >= 2) points.push([Number(p[0]), Number(p[1])]);
            });
        });
        if (!points.length) return null;
        const xs = points.map((p) => p[0]);
        const ys = points.map((p) => p[1]);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const pad = 22;
        const spanX = Math.max(maxX - minX, 0.000001);
        const spanY = Math.max(maxY - minY, 0.000001);
        const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
        const drawW = spanX * scale, drawH = spanY * scale;
        const ox = (width - drawW) / 2, oy = (height - drawH) / 2;
        return (lon, lat) => [
            ox + (Number(lon) - minX) * scale,
            height - (oy + (Number(lat) - minY) * scale),
        ];
    }

    function geometryPath(geometry, project) {
        if (!geometry) return "";
        const line = (coords) => Array.isArray(coords) && coords.length >= 2
            ? coords.map((p, i) => {
                const [x, y] = project(p[0], p[1]);
                return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
            }).join(" ")
            : "";
        const polygon = (rings) => (Array.isArray(rings) ? rings.map((ring) => {
            const d = line(ring);
            return d ? `${d} Z` : "";
        }).filter(Boolean).join(" ") : "");
        if (geometry.type === "Polygon") return polygon(geometry.coordinates);
        if (geometry.type === "MultiPolygon") return geometry.coordinates.map(polygon).filter(Boolean).join(" ");
        return "";
    }

    function centroid(geometry, project) {
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
        return project(
            points.reduce((sum, p) => sum + p[0], 0) / points.length,
            points.reduce((sum, p) => sum + p[1], 0) / points.length
        );
    }

    function wardId(feature) {
        const raw = feature?.properties?.ward_id ?? feature?.properties?.ward;
        return raw === undefined || raw === null ? null : `W${raw}`;
    }

    function pathForRoad(road, project) {
        if (!Array.isArray(road.path) || road.path.length < 2) return "";
        return road.path.map((p, i) => {
            const [x, y] = project(p[0], p[1]);
            return `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
        }).join(" ");
    }

    function colourClass(type, assessment, road) {
        if (type === "risk") return levelFor(assessment);
        if (type === "flood") {
            const water = numericFactor(assessment, "water_depth_m", numericFactor(assessment, "water", 0));
            const rain = numericFactor(assessment, "rainfall_mm_per_hr", numericFactor(assessment, "rainfall", 0));
            if (water >= 2 || rain >= 100) return "critical";
            if (water >= 1 || rain >= 50) return "high";
            if (water > 0 || rain > 0) return "watch";
            return "low";
        }
        if (type === "access") {
            const access = numericFactor(assessment, "accessibility_percent", 100);
            if (access < 35) return "critical";
            if (access < 70) return "watch";
            return "good";
        }
        if (type === "response") return levelFor(assessment) === "critical" || levelFor(assessment) === "high" ? "critical" : levelFor(assessment) === "watch" ? "watch" : "good";
        if (road) {
            if (road.blocked) return "critical";
            if (Number(road.accessibility_percent ?? 100) < 70) return "watch";
            return "good";
        }
        return "good";
    }

    function renderMap(type) {
        const data = getData();
        if (!data || !data.wards?.length || !data.roads?.length) {
            return `<div class="map-studio-empty">Live Chennai geography is still loading.</div>`;
        }

        const width = 720, height = 410;
        const project = buildProjection(data.wards, data.roads, width, height);
        if (!project) return `<div class="map-studio-empty">No road geometry is available.</div>`;
        const assessments = getAssessments();

        const wards = data.wards.map((ward) => {
            const id = wardId(ward);
            if (!id) return "";
            const assessment = assessments.get(id);
            const d = geometryPath(ward.geometry, project);
            if (!d) return "";
            const cls = colourClass(type, assessment);
            const selected = id === window.selectedZoneId ? " selected" : "";
            return `<path class="studio-ward ${esc(cls)}${selected}" data-zone-id="${esc(id)}" d="${d}" />`;
        }).filter(Boolean).join("");

        const roads = data.roads.map((road) => {
            const d = pathForRoad(road, project);
            if (!d) return "";
            const cls = colourClass(type, null, road);
            const visible = type === "network" || type === "access" || type === "response" || type === "risk" || type === "flood";
            return visible ? `<path class="studio-road ${esc(cls)}" d="${d}" />` : "";
        }).filter(Boolean).join("");

        const centroids = new Map();
        data.wards.forEach((ward) => {
            const id = wardId(ward);
            const point = centroid(ward.geometry, project);
            if (id && point) centroids.set(id, point);
        });

        const pairs = new Set();
        const links = data.roads.map((road) => {
            if (!centroids.has(road.from_zone_id) || !centroids.has(road.to_zone_id)) return "";
            const a = road.from_zone_id, b = road.to_zone_id;
            const key = [a, b].sort().join("|");
            if (pairs.has(key)) return "";
            pairs.add(key);
            const p1 = centroids.get(a), p2 = centroids.get(b);
            const cls = colourClass(type, assessments.get(a), road);
            return `<line class="studio-zone-link ${esc(cls)}" x1="${p1[0].toFixed(2)}" y1="${p1[1].toFixed(2)}" x2="${p2[0].toFixed(2)}" y2="${p2[1].toFixed(2)}" />`;
        }).filter(Boolean).join("");

        const markers = data.wards.map((ward) => {
            const id = wardId(ward), p = centroid(ward.geometry, project);
            if (!id || !p) return "";
            const cls = colourClass(type, assessments.get(id));
            return `<circle class="studio-marker ${esc(cls)}" data-zone-id="${esc(id)}" cx="${p[0].toFixed(2)}" cy="${p[1].toFixed(2)}" r="2.8" />`;
        }).filter(Boolean).join("");

        return `<svg class="map-studio-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <g class="studio-ward-layer">${wards}</g>
            <g class="studio-zone-links">${links}</g>
            <g class="studio-road-layer">${roads}</g>
            <g class="studio-marker-layer">${markers}</g>
        </svg>`;
    }

    function createWindow(type) {
        if (state.windows.has(type)) {
            const existing = state.windows.get(type);
            existing.element.style.zIndex = ++state.z;
            return existing;
        }

        const spec = MAPS[type];
        const host = document.querySelector(".map-studio-host");
        if (!host) return null;
        const el = document.createElement("section");
        el.className = "map-studio-window";
        const offset = (state.nextOffset++ % 4) * 34;
        el.style.left = `${Math.min(80 + offset, Math.max(20, host.clientWidth - 430))}px`;
        el.style.top = `${Math.min(78 + offset, Math.max(20, host.clientHeight - 340))}px`;
        el.style.zIndex = ++state.z;
        el.innerHTML = `<header class="map-studio-window-head"><div><span class="map-studio-kicker">${esc(spec.kicker)}</span><strong>${esc(spec.title)}</strong><small>${esc(spec.description)}</small></div><button type="button" class="map-studio-close" aria-label="Close map">×</button></header><div class="map-studio-body">${renderMap(type)}<div class="map-studio-legend">${spec.legend.map(([c, label]) => `<span><i class="${esc(c)}"></i>${esc(label)}</span>`).join("")}</div></div>`;
        host.appendChild(el);

        const win = { element: el, type };
        state.windows.set(type, win);
        el.addEventListener("pointerdown", () => { el.style.zIndex = ++state.z; });
        el.querySelector(".map-studio-close").addEventListener("click", () => closeWindow(type));
        makeDraggable(el, el.querySelector(".map-studio-window-head"), host);
        el.querySelectorAll(".studio-ward").forEach((ward) => {
            ward.addEventListener("click", () => {
                if (typeof selectDashboardZone === "function") selectDashboardZone(ward.dataset.zoneId);
                refreshAll();
            });
        });
        return win;
    }

    function closeWindow(type) {
        const win = state.windows.get(type);
        if (!win) return;
        win.element.remove();
        state.windows.delete(type);
    }

    function refreshAll() {
        state.windows.forEach((win) => {
            const body = win.element.querySelector(".map-studio-body");
            if (!body) return;
            const legend = win.element.querySelector(".map-studio-legend");
            const currentLegend = legend ? legend.outerHTML : "";
            body.innerHTML = `${renderMap(win.type)}${currentLegend}`;
            win.element.querySelectorAll(".studio-ward").forEach((ward) => ward.addEventListener("click", () => {
                if (typeof selectDashboardZone === "function") selectDashboardZone(ward.dataset.zoneId);
                refreshAll();
            }));
        });
    }

    function makeDraggable(el, handle, host) {
        let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
        handle.addEventListener("pointerdown", (event) => {
            if (event.target.closest("button")) return;
            dragging = true;
            sx = event.clientX; sy = event.clientY;
            const rect = el.getBoundingClientRect();
            const parent = host.getBoundingClientRect();
            ox = rect.left - parent.left; oy = rect.top - parent.top;
            handle.setPointerCapture?.(event.pointerId);
        });
        handle.addEventListener("pointermove", (event) => {
            if (!dragging) return;
            const parent = host.getBoundingClientRect();
            const x = Math.max(8, Math.min(parent.width - el.offsetWidth - 8, ox + event.clientX - sx));
            const y = Math.max(8, Math.min(parent.height - el.offsetHeight - 8, oy + event.clientY - sy));
            el.style.left = `${x}px`; el.style.top = `${y}px`;
        });
        handle.addEventListener("pointerup", (event) => { dragging = false; handle.releasePointerCapture?.(event.pointerId); });
        handle.addEventListener("pointercancel", () => { dragging = false; });
    }

    function addZoneLinksToMainMap() {
        const map = document.querySelector(".real-chennai-map");
        const data = getData();
        if (!map || !data?.roads?.length || map.querySelector(".main-zone-links")) return;
        const wards = [...map.querySelectorAll(".real-ward")];
        const boxes = new Map(wards.map((ward) => [ward.dataset.zoneId, ward.getBBox()]));
        const pairs = new Set();
        const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        layer.setAttribute("class", "main-zone-links");
        data.roads.forEach((road) => {
            const a = boxes.get(road.from_zone_id), b = boxes.get(road.to_zone_id);
            if (!a || !b) return;
            const key = [road.from_zone_id, road.to_zone_id].sort().join("|");
            if (pairs.has(key)) return;
            pairs.add(key);
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", (a.x + a.width / 2).toFixed(2));
            line.setAttribute("y1", (a.y + a.height / 2).toFixed(2));
            line.setAttribute("x2", (b.x + b.width / 2).toFixed(2));
            line.setAttribute("y2", (b.y + b.height / 2).toFixed(2));
            line.setAttribute("class", "main-zone-link");
            layer.appendChild(line);
        });
        const roads = map.querySelector(".real-road-layer");
        map.insertBefore(layer, roads || map.firstChild);
    }

    function injectToolbar() {
        const area = document.querySelector(".map-area");
        if (!area || area.querySelector(".map-insight-toolbar")) return;
        const toolbar = document.createElement("div");
        toolbar.className = "map-insight-toolbar";
        toolbar.innerHTML = `<span>MAP INSIGHTS</span>${Object.entries(MAPS).map(([key, spec]) => `<button type="button" data-map-studio="${key}">${esc(spec.title.replace(" View", ""))}</button>`).join("")}`;
        area.appendChild(toolbar);
        toolbar.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => openStudio(button.dataset.mapStudio)));
    }

    function openStudio(type) {
        let host = document.querySelector(".map-studio-host");
        if (!host) {
            host = document.createElement("div");
            host.className = "map-studio-host";
            host.innerHTML = `<div class="map-studio-backdrop"></div><div class="map-studio-topbar"><div><span>LIVE GEOSPATIAL WORKSPACE</span><strong>Chennai Map Studio</strong></div><button type="button" class="map-studio-close-all">Close workspace</button></div>`;
            document.body.appendChild(host);
            host.querySelector(".map-studio-backdrop").addEventListener("click", closeStudio);
            host.querySelector(".map-studio-close-all").addEventListener("click", closeStudio);
        }
        host.hidden = false;
        createWindow(type);
    }

    function closeStudio() {
        const host = document.querySelector(".map-studio-host");
        if (host) host.hidden = true;
        state.windows.forEach((win) => win.element.remove());
        state.windows.clear();
        state.nextOffset = 0;
    }

    function init() {
        const area = document.querySelector(".map-area");
        if (!area) return;
        injectToolbar();
        addZoneLinksToMainMap();
        if (!document.querySelector(".map-studio-host")) {
            const observer = new MutationObserver(() => {
                injectToolbar();
                addZoneLinksToMainMap();
            });
            observer.observe(area, { childList: true });
        }
    }

    window.openMapStudio = openStudio;
    window.refreshMapStudio = refreshAll;

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
