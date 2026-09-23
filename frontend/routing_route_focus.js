/*
 * Route-focused operational overlay.
 *
 * This layer deliberately leaves the existing routing renderer and API untouched.
 * It promotes the authoritative road_path into a stronger visual hierarchy,
 * adds a linear route corridor, and gives the operator a focused route view
 * without removing ward nodes, boundaries, or the underlying road network.
 */
(function () {
    "use strict";

    const ENHANCED_FLAG = "data-route-focus-enhanced";
    const FULL_VIEWBOX_FLAG = "data-routing-full-viewbox";
    const FOCUS_VIEWBOX_FLAG = "data-routing-focus-viewbox";
    const WORKSPACE_OBSERVER_FLAG = "data-route-focus-observer";

    function state() {
        return window.ROUTING_STATE || null;
    }

    function esc(value) {
        if (typeof window.escapeHTML === "function") return window.escapeHTML(value);
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
        }[char]));
    }

    function num(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function formatDistance(value) {
        return `${num(value).toFixed(4)} km`;
    }

    function routeRoads(route) {
        const current = state();
        if (!route || !current) return [];
        const byId = new Map((current.roads || []).map((road) => [road.id, road]));
        return (route.road_path || []).map((id) => byId.get(id)).filter(Boolean);
    }

    function condition(road) {
        if (road?.blocked) return "blocked";
        return num(road?.accessibility_percent, 100) < 70 ? "degraded" : "clear";
    }

    function ensureRouteFilter(svg) {
        const defs = svg.querySelector("defs");
        if (!defs || defs.querySelector("#routing-route-glow")) return;
        const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
        filter.setAttribute("id", "routing-route-glow");
        filter.setAttribute("x", "-100%");
        filter.setAttribute("y", "-100%");
        filter.setAttribute("width", "300%");
        filter.setAttribute("height", "300%");
        filter.innerHTML = `
            <feGaussianBlur stdDeviation="5.5" result="blur"></feGaussianBlur>
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.0 0 0 0 0 0.95 0 0 0 0 0.62 0 0 0 0.9 0"></feColorMatrix>
        `;
        defs.appendChild(filter);
    }

    function addRouteLayers(svg) {
        if (svg.querySelector(".routing-route-casing-layer")) return;
        ensureRouteFilter(svg);

        const routePaths = Array.from(svg.querySelectorAll(".routing-road-route"));
        if (!routePaths.length) return;

        const roadLayer = svg.querySelector(".routing-road-layer");
        if (!roadLayer) return;

        const glowLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        glowLayer.setAttribute("class", "routing-route-glow-layer");

        const casingLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        casingLayer.setAttribute("class", "routing-route-casing-layer");

        const pulseLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        pulseLayer.setAttribute("class", "routing-route-pulse-layer");

        routePaths.forEach((source) => {
            const glow = source.cloneNode(true);
            glow.removeAttribute("filter");
            glow.classList.remove("routing-road-route");
            glow.classList.add("routing-route-glow");

            const casing = source.cloneNode(true);
            casing.removeAttribute("filter");
            casing.classList.remove("routing-road-route");
            casing.classList.add("routing-route-casing");

            const pulse = source.cloneNode(true);
            pulse.removeAttribute("filter");
            pulse.classList.remove("routing-road-route");
            pulse.classList.add("routing-route-direction");
            pulse.setAttribute("aria-hidden", "true");

            glowLayer.appendChild(glow);
            casingLayer.appendChild(casing);
            pulseLayer.appendChild(pulse);
        });

        roadLayer.parentNode.insertBefore(glowLayer, roadLayer);
        roadLayer.parentNode.insertBefore(casingLayer, roadLayer);
        roadLayer.parentNode.appendChild(pulseLayer);
    }

    function unionRouteBBox(svg) {
        const paths = Array.from(svg.querySelectorAll(".routing-road-route"));
        if (!paths.length) return null;

        let bounds = null;
        paths.forEach((path) => {
            try {
                const box = path.getBBox();
                if (!box || (!box.width && !box.height)) return;
                const x2 = box.x + box.width;
                const y2 = box.y + box.height;
                if (!bounds) {
                    bounds = { x: box.x, y: box.y, x2, y2 };
                    return;
                }
                bounds.x = Math.min(bounds.x, box.x);
                bounds.y = Math.min(bounds.y, box.y);
                bounds.x2 = Math.max(bounds.x2, x2);
                bounds.y2 = Math.max(bounds.y2, y2);
            } catch (_) {
                // SVG may not have laid out the path yet; leave the full view intact.
            }
        });

        if (!bounds) return null;
        return {
            x: bounds.x,
            y: bounds.y,
            width: Math.max(bounds.x2 - bounds.x, 1),
            height: Math.max(bounds.y2 - bounds.y, 1),
        };
    }

    function makeFocusViewBox(svg) {
        const bbox = unionRouteBBox(svg);
        if (!bbox) return null;

        const full = svg.viewBox.baseVal;
        const viewportWidth = svg.clientWidth || 920;
        const viewportHeight = svg.clientHeight || 520;
        const viewportAspect = viewportWidth / Math.max(viewportHeight, 1);

        let width = bbox.width;
        let height = bbox.height;
        const longest = Math.max(width, height);
        const padding = Math.max(26, longest * 0.16);
        width += padding * 2;
        height += padding * 2;

        const minimumWidth = Math.max(180, height * viewportAspect * 0.65);
        const minimumHeight = Math.max(130, width / Math.max(viewportAspect, 0.01) * 0.65);
        width = Math.max(width, minimumWidth);
        height = Math.max(height, minimumHeight);

        if (width / height > viewportAspect) {
            height = width / viewportAspect;
        } else {
            width = height * viewportAspect;
        }

        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        let x = centerX - width / 2;
        let y = centerY - height / 2;

        const fullX2 = full.x + full.width;
        const fullY2 = full.y + full.height;
        if (width <= full.width) x = Math.max(full.x, Math.min(x, fullX2 - width));
        if (height <= full.height) y = Math.max(full.y, Math.min(y, fullY2 - height));

        return [x, y, width, height].map((value) => Number(value.toFixed(2)));
    }

    function focusRoute(svg) {
        if (!svg) return;
        const focus = svg.getAttribute(FOCUS_VIEWBOX_FLAG);
        if (!focus) return;
        svg.setAttribute("viewBox", focus);
        svg.dataset.routeView = "focused";
        svg.style.transform = "scale(1)";
        const current = state();
        if (current) current.mapScale = 1;
    }

    function showFullNetwork(svg) {
        if (!svg) return;
        const full = svg.getAttribute(FULL_VIEWBOX_FLAG);
        if (!full) return;
        svg.setAttribute("viewBox", full);
        svg.dataset.routeView = "full";
        svg.style.transform = "scale(1)";
        const current = state();
        if (current) current.mapScale = 1;
    }

    function addMapModeControl(viewport, svg) {
        if (viewport.querySelector(".routing-view-mode")) return;
        const control = document.createElement("div");
        control.className = "routing-view-mode";
        control.innerHTML = `
            <button type="button" class="is-active" data-route-view="focus">FOCUS ROUTE</button>
            <button type="button" data-route-view="full">FULL NETWORK</button>`;
        viewport.appendChild(control);

        control.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-route-view]");
            if (!button) return;
            const mode = button.dataset.routeView;
            control.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
            if (mode === "full") showFullNetwork(svg);
            else focusRoute(svg);
        });
    }

    function wireResetControl(viewport, svg) {
        const reset = viewport.querySelector('[data-map="reset"]');
        if (!reset || reset.dataset.routeResetBound) return;
        reset.dataset.routeResetBound = "1";
        reset.addEventListener("click", () => {
            const mode = svg.dataset.routeView || "focused";
            if (mode === "full") showFullNetwork(svg);
            else focusRoute(svg);
            const controls = viewport.querySelector(".routing-view-mode");
            controls?.querySelectorAll("button").forEach((button) => {
                button.classList.toggle("is-active", button.dataset.routeView === mode);
            });
        }, true);
    }

    function routeCounts(route) {
        const roads = routeRoads(route);
        return roads.reduce((counts, road) => {
            counts[condition(road)] += 1;
            counts.total += 1;
            return counts;
        }, { total: 0, clear: 0, degraded: 0, blocked: 0 });
    }

    function renderCorridor(route) {
        const roads = routeRoads(route);
        if (!roads.length) return "";
        const counts = routeCounts(route);
        const zonePath = route?.zone_path || [];

        const segments = roads.map((road, index) => {
            const stateName = condition(road);
            return `
                <div class="routing-corridor-segment routing-corridor-${stateName}" title="${esc(road.id)}">
                    <span class="routing-corridor-index">${index + 1}</span>
                    <span class="routing-corridor-road">${esc(road.id)}</span>
                    <span class="routing-corridor-distance">${formatDistance(road.distance_km)}</span>
                    <span class="routing-corridor-state">${stateName.toUpperCase()}</span>
                </div>`;
        }).join("");

        return `
            <section class="routing-corridor-card" data-route-corridor>
                <div class="routing-corridor-header">
                    <div>
                        <span class="routing-corridor-kicker">OPERATIONAL ROUTE CORRIDOR</span>
                        <h3>Road-by-road deployment path</h3>
                        <p>Geographic route above · linear operational sequence below</p>
                    </div>
                    <div class="routing-corridor-stats">
                        <span><b>${counts.total}</b> segments</span>
                        <span class="is-clear"><b>${counts.clear}</b> clear</span>
                        <span class="is-degraded"><b>${counts.degraded}</b> degraded</span>
                        <span class="is-blocked"><b>${counts.blocked}</b> blocked</span>
                    </div>
                </div>
                <div class="routing-corridor-routebar">
                    <div class="routing-corridor-end routing-corridor-origin"><i></i><strong>${esc(route.origin_zone_id || "ORIGIN")}</strong><small>ORIGIN</small></div>
                    <div class="routing-corridor-track"><div class="routing-corridor-track-line"></div><div class="routing-corridor-track-pulse"></div></div>
                    <div class="routing-corridor-end routing-corridor-destination"><i></i><strong>${esc(route.destination_zone_id || "DESTINATION")}</strong><small>DESTINATION</small></div>
                </div>
                <div class="routing-corridor-wardpath">
                    <span>WARD TRANSIT</span>
                    <div>${zonePath.map((zone, index) => `<b class="${index === 0 ? "is-origin" : index === zonePath.length - 1 ? "is-destination" : ""}">${esc(zone)}</b>${index < zonePath.length - 1 ? `<i>›</i>` : ""}`).join("")}</div>
                </div>
                <div class="routing-corridor-scroll">${segments}</div>
            </section>`;
    }

    function ensureCorridor(workspace, route) {
        if (!route || workspace.querySelector("[data-route-corridor]")) return;
        const mainGrid = workspace.querySelector(".routing-main-grid");
        const bottomGrid = workspace.querySelector(".routing-bottom-grid");
        if (!mainGrid) return;
        const wrapper = document.createElement("div");
        wrapper.innerHTML = renderCorridor(route);
        const corridor = wrapper.firstElementChild;
        if (!corridor) return;
        if (bottomGrid) workspace.insertBefore(corridor, bottomGrid);
        else mainGrid.insertAdjacentElement("afterend", corridor);
    }

    function enhanceSvg(svg, route) {
        if (!svg || !route) return;
        const routePaths = svg.querySelectorAll(".routing-road-route");
        if (!routePaths.length) return;

        addRouteLayers(svg);
        svg.setAttribute(FULL_VIEWBOX_FLAG, svg.getAttribute("viewBox") || "0 0 920 520");

        const focus = makeFocusViewBox(svg);
        if (focus) svg.setAttribute(FOCUS_VIEWBOX_FLAG, focus.join(" "));

        const viewport = svg.closest(".routing-map-viewport") || svg.closest(".routing-fullmap-body");
        if (viewport && viewport.classList.contains("routing-map-viewport")) {
            addMapModeControl(viewport, svg);
            wireResetControl(viewport, svg);
        }

        if (viewport?.classList.contains("routing-fullmap-body")) showFullNetwork(svg);
        else if (!svg.dataset.routeView) focusRoute(svg);
        svg.setAttribute(ENHANCED_FLAG, "1");
    }

    function enhanceWorkspace(workspace) {
        const current = state();
        const route = current?.route;
        if (!workspace || !route) return;

        workspace.querySelectorAll(".routing-map-svg").forEach((svg) => {
            enhanceSvg(svg, route);
        });
        ensureCorridor(workspace, route);
    }

    function attachWorkspaceObserver(workspace) {
        if (!workspace || workspace.getAttribute(WORKSPACE_OBSERVER_FLAG) === "1") return;
        workspace.setAttribute(WORKSPACE_OBSERVER_FLAG, "1");

        const observer = new MutationObserver(() => {
            window.requestAnimationFrame(() => enhanceWorkspace(workspace));
        });
        observer.observe(workspace, { childList: true, subtree: true });
        window.requestAnimationFrame(() => enhanceWorkspace(workspace));
    }

    function start() {
        const attach = () => {
            const workspace = document.getElementById("routing-workspace");
            if (workspace) attachWorkspaceObserver(workspace);
        };

        // Routing creates #routing-workspace dynamically inside showRouting().
        // Observe the document so this enhancement attaches whether the routing
        // page already exists at load time or is opened later through navigation.
        const bodyObserver = new MutationObserver(() => {
            attach();
            const current = state();
            if (!current?.route) return;
            document.querySelectorAll(".routing-fullmap-body .routing-map-svg").forEach((svg) => enhanceSvg(svg, current.route));
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });

        attach();
    }

    function boot() {
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
        else start();
    }

    boot();
})();
