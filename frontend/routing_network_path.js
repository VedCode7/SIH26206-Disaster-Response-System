/*
 * Continuous road-network route layer.
 *
 * The routing engine already returns an ordered road_path. This layer uses
 * those authoritative road geometries to render one connected source-to-
 * destination corridor. It deliberately keeps the existing ward boundaries,
 * zone nodes, markers, route summary, and underlying network intact.
 */
(function () {
    "use strict";

    const SVG_NS = "http://www.w3.org/2000/svg";
    const ROUTE_LAYER = "routing-continuous-route-layer";
    const FIXED_FLAG = "data-routing-network-path-fixed";
    const MODE_FLAG = "data-routing-network-mode-bound";

    function getState() {
        return window.ROUTING_STATE || null;
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function routeRoads(route) {
        const current = getState();
        if (!current || !route) return [];
        const byId = new Map((current.roads || []).map((road) => [String(road.id), road]));
        return (route.road_path || []).map((id) => byId.get(String(id))).filter(Boolean);
    }

    function parsePath(pathElement) {
        const d = pathElement?.getAttribute("d") || "";
        const matches = d.match(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g) || [];
        return matches.map((token) => {
            const match = token.match(/[ML]\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
            return match ? [Number(match[1]), Number(match[2])] : null;
        }).filter(Boolean);
    }

    function reversePoints(points) {
        return [...points].reverse();
    }

    function distance(a, b) {
        if (!a || !b) return Infinity;
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }

    function orderedRouteGeometry(svg, route) {
        const roads = routeRoads(route);
        const zonePath = route?.zone_path || [];
        if (!roads.length) return [];

        const renderedById = new Map(
            Array.from(svg.querySelectorAll(".routing-road-route[data-road-id]"))
                .map((element) => [String(element.dataset.roadId), element])
        );

        const ordered = [];
        let currentZone = zonePath[0] || route?.origin_zone_id || null;

        roads.forEach((road, index) => {
            const element = renderedById.get(String(road.id));
            const raw = parsePath(element);
            if (raw.length < 2) return;

            const nextZone = zonePath[index + 1] || null;
            let points = raw;

            if (currentZone && road.to_zone_id === currentZone && road.from_zone_id !== currentZone) {
                points = reversePoints(raw);
            } else if (currentZone && road.from_zone_id !== currentZone && road.to_zone_id === currentZone) {
                points = reversePoints(raw);
            } else if (nextZone && road.from_zone_id !== currentZone && road.to_zone_id === currentZone) {
                points = reversePoints(raw);
            } else if (index > 0 && ordered.length) {
                const previous = ordered[ordered.length - 1];
                const firstGap = distance(previous[previous.length - 1], raw[0]);
                const reverseGap = distance(previous[previous.length - 1], raw[raw.length - 1]);
                if (reverseGap < firstGap) points = reversePoints(raw);
            }

            ordered.push(points);
            currentZone = nextZone || (
                road.from_zone_id === currentZone ? road.to_zone_id : road.from_zone_id
            );
        });

        return ordered;
    }

    function flattenRoute(segments) {
        const points = [];
        segments.forEach((segment, segmentIndex) => {
            if (!segment.length) return;
            if (!points.length) {
                points.push(...segment);
                return;
            }

            const previous = points[points.length - 1];
            const first = segment[0];
            const last = segment[segment.length - 1];
            const firstGap = distance(previous, first);
            const lastGap = distance(previous, last);
            const oriented = lastGap < firstGap ? reversePoints(segment) : segment;
            const next = oriented[0];

            // Road geometries in the persisted network meet at intersections.
            // Keep the actual geometry and bridge only the tiny sub-pixel gap
            // introduced by independent LineString serialization.
            if (distance(previous, next) <= 10) {
                points.push(...oriented);
            } else {
                // Keep the route visually continuous without hiding a genuine
                // geometry discontinuity behind a fabricated long connector.
                points.push(next, ...oriented.slice(1));
            }
        });
        return points;
    }

    function pathData(points) {
        if (points.length < 2) return "";
        return points.map((point, index) =>
            `${index === 0 ? "M" : "L"}${point[0].toFixed(2)} ${point[1].toFixed(2)}`
        ).join(" ");
    }

    function makePath(className, d) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("class", className);
        path.setAttribute("d", d);
        path.setAttribute("fill", "none");
        path.setAttribute("vector-effect", "non-scaling-stroke");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("pointer-events", "none");
        return path;
    }

    function ensureStyles() {
        if (document.getElementById("routing-network-path-styles")) return;
        const style = document.createElement("style");
        style.id = "routing-network-path-styles";
        style.textContent = `
            .routing-continuous-route-layer { pointer-events: none; }
            .routing-continuous-route-glow {
                stroke: #00f5a0;
                stroke-width: 18;
                opacity: .20;
                filter: drop-shadow(0 0 7px rgba(0,245,160,.85));
            }
            .routing-continuous-route-casing {
                stroke: #021018;
                stroke-width: 12;
                opacity: .98;
            }
            .routing-continuous-route-main {
                stroke: #00f5a0;
                stroke-width: 7;
                opacity: 1;
                filter: drop-shadow(0 0 4px rgba(0,245,160,.92));
            }
            .routing-continuous-route-center {
                stroke: #e5fff7;
                stroke-width: 2.2;
                opacity: .95;
                stroke-dasharray: 5 14;
                animation: routingNetworkPathFlow 1.05s linear infinite;
            }
            .routing-continuous-route-layer.is-degraded .routing-continuous-route-glow,
            .routing-continuous-route-layer.is-degraded .routing-continuous-route-main {
                stroke: #ffb21b;
            }
            .routing-continuous-route-layer.is-blocked .routing-continuous-route-glow,
            .routing-continuous-route-layer.is-blocked .routing-continuous-route-main {
                stroke: #ff4050;
            }
            .routing-route-segment-muted {
                stroke-width: 2 !important;
                opacity: .16 !important;
                filter: none !important;
            }
            .routing-route-focus-hidden { opacity: .035 !important; }
            .routing-route-focus-hidden.routing-road-blocked,
            .routing-route-focus-hidden.routing-road-degraded { opacity: .05 !important; }
            .routing-waypoint { opacity: .58 !important; }
            .routing-waypoint:hover { opacity: 1 !important; }
            @keyframes routingNetworkPathFlow { to { stroke-dashoffset: -19; } }
        `;
        document.head.appendChild(style);
    }

    function removeOldLayer(svg) {
        svg.querySelector(`.${ROUTE_LAYER}`)?.remove();
    }

    function addContinuousRoute(svg, route) {
        const segments = orderedRouteGeometry(svg, route);
        const points = flattenRoute(segments);
        const d = pathData(points);
        if (!d) return null;

        removeOldLayer(svg);

        const roads = routeRoads(route);
        const hasBlocked = roads.some((road) => !!road.blocked);
        const hasDegraded = roads.some((road) => !road.blocked && number(road.accessibility_percent, 100) < 70);
        const layer = document.createElementNS(SVG_NS, "g");
        layer.setAttribute("class", `${ROUTE_LAYER}${hasBlocked ? " is-blocked" : hasDegraded ? " is-degraded" : ""}`);
        layer.setAttribute("aria-label", "Continuous routed road path");

        layer.appendChild(makePath("routing-continuous-route-glow", d));
        layer.appendChild(makePath("routing-continuous-route-casing", d));
        layer.appendChild(makePath("routing-continuous-route-main", d));
        layer.appendChild(makePath("routing-continuous-route-center", d));

        const roadLayer = svg.querySelector(".routing-road-layer");
        if (roadLayer?.parentNode) roadLayer.parentNode.appendChild(layer);
        else svg.appendChild(layer);

        svg.querySelectorAll(".routing-road-route").forEach((path) => {
            path.classList.add("routing-route-segment-muted");
        });

        positionRouteMarkers(svg, points);
        return layer;
    }

    function positionRouteMarkers(svg, points) {
        if (points.length < 2) return;
        const origin = svg.querySelector(".routing-marker-origin");
        const destination = svg.querySelector(".routing-marker-destination");
        if (origin) origin.setAttribute("transform", `translate(${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)})`);
        if (destination) {
            const last = points[points.length - 1];
            destination.setAttribute("transform", `translate(${last[0].toFixed(2)} ${last[1].toFixed(2)})`);
        }
    }

    function routeBBox(svg) {
        const layer = svg.querySelector(`.${ROUTE_LAYER}`);
        if (!layer) return null;
        try {
            const box = layer.getBBox();
            if (!box || (!box.width && !box.height)) return null;
            return box;
        } catch (_) {
            return null;
        }
    }

    function focusViewBox(svg) {
        const fullValue = svg.getAttribute("data-routing-full-viewbox") || svg.getAttribute("viewBox") || "0 0 920 520";
        const full = fullValue.split(/\s+/).map(Number);
        if (full.length !== 4 || full.some((value) => !Number.isFinite(value))) return null;

        const box = routeBBox(svg);
        if (!box) return null;

        const viewportWidth = svg.clientWidth || 920;
        const viewportHeight = svg.clientHeight || 520;
        const aspect = viewportWidth / Math.max(viewportHeight, 1);
        const pad = Math.max(34, Math.max(box.width, box.height) * .12);
        let width = box.width + pad * 2;
        let height = box.height + pad * 2;

        if (width / height > aspect) height = width / aspect;
        else width = height * aspect;

        width = Math.min(width, full[2]);
        height = Math.min(height, full[3]);

        let x = box.x + box.width / 2 - width / 2;
        let y = box.y + box.height / 2 - height / 2;
        x = Math.max(full[0], Math.min(x, full[0] + full[2] - width));
        y = Math.max(full[1], Math.min(y, full[1] + full[3] - height));
        return [x, y, width, height];
    }

    function setRoadVisibility(svg, mode) {
        const routeIds = new Set((getState()?.route?.road_path || []).map(String));
        svg.querySelectorAll(".routing-road").forEach((road) => {
            if (road.classList.contains("routing-road-route")) {
                road.classList.remove("routing-route-focus-hidden");
                return;
            }
            const isNetworkRoad = !routeIds.has(String(road.dataset.roadId || ""));
            road.classList.toggle("routing-route-focus-hidden", mode === "focus" && isNetworkRoad);
        });

        svg.querySelectorAll(".routing-route-glow, .routing-route-casing, .routing-route-direction").forEach((element) => {
            element.style.opacity = mode === "focus" ? "0" : "0.05";
        });
    }

    function applyMode(svg, mode) {
        const full = svg.getAttribute("data-routing-full-viewbox");
        if (mode === "focus") {
            const focused = focusViewBox(svg);
            if (focused) svg.setAttribute("viewBox", focused.join(" "));
        } else if (full) {
            svg.setAttribute("viewBox", full);
        }
        setRoadVisibility(svg, mode);
        svg.dataset.routeView = mode;
        const viewport = svg.closest(".routing-map-viewport");
        viewport?.querySelectorAll(".routing-view-mode button").forEach((button) => {
            button.classList.toggle("is-active", button.dataset.routeView === mode);
        });
    }

    function bindModeControl(viewport, svg) {
        const control = viewport?.querySelector(".routing-view-mode");
        if (!control || control.getAttribute(MODE_FLAG) === "1") return;
        control.setAttribute(MODE_FLAG, "1");

        const focusButton = control.querySelector('[data-route-view="focus"]');
        const fullButton = control.querySelector('[data-route-view="full"]');
        if (focusButton) focusButton.textContent = "ROUTE ONLY";
        if (fullButton) fullButton.textContent = "FULL NETWORK";

        control.addEventListener("click", (event) => {
            const button = event.target.closest("button[data-route-view]");
            if (!button) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            applyMode(svg, button.dataset.routeView === "full" ? "full" : "focus");
        }, true);

        applyMode(svg, "focus");
    }

    function enhanceSvg(svg) {
        const current = getState();
        const route = current?.route;
        if (!svg || !route || svg.getAttribute(FIXED_FLAG) === "1") return;
        if (!svg.querySelector(".routing-road-route")) return;

        ensureStyles();
        if (!svg.getAttribute("data-routing-full-viewbox")) {
            svg.setAttribute("data-routing-full-viewbox", svg.getAttribute("viewBox") || "0 0 920 520");
        }

        addContinuousRoute(svg, route);
        svg.setAttribute(FIXED_FLAG, "1");

        const viewport = svg.closest(".routing-map-viewport");
        if (viewport) bindModeControl(viewport, svg);
    }

    function observeWorkspace(workspace) {
        if (!workspace || workspace.dataset.networkPathObserver === "1") return;
        workspace.dataset.networkPathObserver = "1";
        const observer = new MutationObserver(() => {
            window.requestAnimationFrame(() => {
                workspace.querySelectorAll(".routing-map-svg").forEach(enhanceSvg);
            });
        });
        observer.observe(workspace, { childList: true, subtree: true });
        window.requestAnimationFrame(() => workspace.querySelectorAll(".routing-map-svg").forEach(enhanceSvg));
    }

    function start() {
        const attach = () => {
            const workspace = document.getElementById("routing-workspace");
            if (workspace) observeWorkspace(workspace);
        };

        const bodyObserver = new MutationObserver(() => {
            attach();
            document.querySelectorAll(".routing-map-svg").forEach(enhanceSvg);
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });
        attach();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();