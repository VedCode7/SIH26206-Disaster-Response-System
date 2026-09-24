/*
 * Real-road route visualisation.
 *
 * The route engine remains authoritative for disaster-aware road selection.
 * The geometry endpoint reconstructs the physical path through the OSM road
 * graph between the selected ward-boundary road segments.
 *
 * This layer deliberately renders a route-local OSM view:
 *   - every visible road is persisted OSM geometry;
 *   - the selected route is the returned physical OSM LineString;
 *   - no ward connector, synthetic corridor, zone jump, or decorative path
 *     is introduced;
 *   - the viewport is rebuilt around the route instead of panning/zooming an
 *     existing SVG, avoiding the previous top-left auto-pan failure.
 */
(function () {
    "use strict";

    const SVG_NS = "http://www.w3.org/2000/svg";
    const LAYER_CLASS = "routing-osm-route-layer";
    const STYLE_ID = "routing-osm-route-styles";
    const ENHANCED_ATTR = "data-osm-route-enhanced";
    const FOCUSED_ATTR = "data-route-focused-map";
    const GEOMETRY_PROMISE = "__osmRouteGeometryPromise";
    const GEOMETRY_FAILED = "__osmRouteGeometryFailed";

    function state() {
        return window.ROUTING_STATE || null;
    }

    function num(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function apiBase() {
        return window.API_BASE || "http://127.0.0.1:8000";
    }

    async function fetchGeometry(route) {
        if (!route?.origin_zone_id || !route?.destination_zone_id) return null;
        if (route[GEOMETRY_FAILED]) return null;

        if (!route[GEOMETRY_PROMISE]) {
            route[GEOMETRY_PROMISE] = fetch(
                `${apiBase()}/route/${encodeURIComponent(route.origin_zone_id)}/${encodeURIComponent(route.destination_zone_id)}/geometry`
            )
                .then((response) => {
                    if (!response.ok) throw new Error(`route geometry ${response.status}`);
                    return response.json();
                })
                .then((payload) => payload?.geometry || null)
                .catch(() => {
                    route[GEOMETRY_FAILED] = true;
                    return null;
                });
        }

        return route[GEOMETRY_PROMISE];
    }

    function isValidPoint(point) {
        return Array.isArray(point)
            && point.length >= 2
            && Number.isFinite(Number(point[0]))
            && Number.isFinite(Number(point[1]));
    }

    function collectCoordinates(value, points) {
        if (!Array.isArray(value)) return;
        if (isValidPoint(value)) {
            points.push([Number(value[0]), Number(value[1])]);
            return;
        }
        value.forEach((child) => collectCoordinates(child, points));
    }

    function geometryPoints(geometry) {
        const points = [];
        collectCoordinates(geometry?.coordinates, points);
        return points;
    }

    function roadPoints(road) {
        const points = [];
        collectCoordinates(road?.path, points);
        return points;
    }

    function boundsFromPoints(points) {
        if (!points.length) return null;
        return {
            minX: Math.min(...points.map((point) => point[0])),
            maxX: Math.max(...points.map((point) => point[0])),
            minY: Math.min(...points.map((point) => point[1])),
            maxY: Math.max(...points.map((point) => point[1])),
        };
    }

    function expandRouteBounds(routePoints) {
        const bounds = boundsFromPoints(routePoints);
        if (!bounds) return null;

        const spanX = Math.max(bounds.maxX - bounds.minX, 0.0004);
        const spanY = Math.max(bounds.maxY - bounds.minY, 0.0004);

        // Keep the route large enough to read, while retaining genuine nearby
        // OSM road context. For very short routes the minimum context is about
        // 250–400 m around the route, not the whole Chennai network.
        const marginX = Math.max(spanX * 1.8, 0.0025);
        const marginY = Math.max(spanY * 1.8, 0.0025);

        return {
            minX: bounds.minX - marginX,
            maxX: bounds.maxX + marginX,
            minY: bounds.minY - marginY,
            maxY: bounds.maxY + marginY,
        };
    }

    function roadIntersectsBounds(road, bounds) {
        const points = roadPoints(road);
        if (!points.length || !bounds) return false;

        const roadBounds = boundsFromPoints(points);
        return roadBounds
            && roadBounds.maxX >= bounds.minX
            && roadBounds.minX <= bounds.maxX
            && roadBounds.maxY >= bounds.minY
            && roadBounds.minY <= bounds.maxY;
    }

    function projection(bounds, width, height) {
        const spanX = Math.max(bounds.maxX - bounds.minX, 0.001);
        const spanY = Math.max(bounds.maxY - bounds.minY, 0.001);
        const padding = 30;
        const drawableWidth = Math.max(width - padding * 2, 1);
        const drawableHeight = Math.max(height - padding * 2, 1);
        const scale = Math.min(drawableWidth / spanX, drawableHeight / spanY);
        const drawnWidth = spanX * scale;
        const drawnHeight = spanY * scale;
        const offsetX = (width - drawnWidth) / 2;
        const offsetY = (height - drawnHeight) / 2;

        return (lon, lat) => [
            offsetX + (Number(lon) - bounds.minX) * scale,
            height - (offsetY + (Number(lat) - bounds.minY) * scale),
        ];
    }

    function pathData(points, project) {
        if (!Array.isArray(points) || points.length < 2 || !project) return "";
        return points
            .map((point, index) => {
                const projected = project(point[0], point[1]);
                return `${index === 0 ? "M" : "L"}${projected[0].toFixed(2)} ${projected[1].toFixed(2)}`;
            })
            .join(" ");
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
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .routing-route-focused-svg {
                display: block;
                width: 100%;
                height: 100%;
                background: transparent;
            }

            .routing-route-focused-network .routing-road {
                fill: none;
                stroke: #2b536b;
                stroke-width: .95;
                opacity: .50;
                vector-effect: non-scaling-stroke;
                stroke-linecap: round;
                stroke-linejoin: round;
            }

            .routing-route-focused-network .routing-road-clear {
                stroke: #35667f;
                opacity: .48;
            }

            .routing-route-focused-network .routing-road-degraded {
                stroke: #a97822;
                opacity: .70;
            }

            .routing-route-focused-network .routing-road-blocked {
                stroke: #9c3544;
                opacity: .76;
                stroke-dasharray: 4 4;
            }

            .${LAYER_CLASS} {
                pointer-events: none;
            }

            /* restrained halo: enough separation from nearby real roads,
               without turning the route into a neon blob */
            .${LAYER_CLASS} .routing-osm-route-glow {
                stroke: #00f5a0;
                stroke-width: 9;
                opacity: .10;
                filter: drop-shadow(0 0 4px rgba(0,245,160,.45));
            }

            .${LAYER_CLASS} .routing-osm-route-casing {
                stroke: #020a10;
                stroke-width: 8;
                opacity: .98;
            }

            .${LAYER_CLASS} .routing-osm-route-main {
                stroke: #00e99a;
                stroke-width: 4.2;
                opacity: 1;
            }

            .${LAYER_CLASS} .routing-osm-route-center {
                stroke: #ecfff8;
                stroke-width: 1.15;
                opacity: .90;
                stroke-dasharray: 7 13;
            }

            .${LAYER_CLASS}.is-degraded .routing-osm-route-glow,
            .${LAYER_CLASS}.is-degraded .routing-osm-route-main {
                stroke: #ffb21b;
            }

            .${LAYER_CLASS}.is-blocked .routing-osm-route-glow,
            .${LAYER_CLASS}.is-blocked .routing-osm-route-main {
                stroke: #ff4050;
            }
        `;
        document.head.appendChild(style);
    }

    function createFocusedSvg(route, geometry) {
        const width = 920;
        const height = 520;
        const routePoints = geometryPoints(geometry);
        const bounds = expandRouteBounds(routePoints);
        if (!bounds) return null;

        const project = projection(bounds, width, height);
        const roads = (state()?.roads || []).filter((road) => roadIntersectsBounds(road, bounds));

        const svg = document.createElementNS(SVG_NS, "svg");
        svg.setAttribute("class", "routing-map-svg routing-route-focused-svg");
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "Route-local mapped OSM road network");
        svg.setAttribute(FOCUSED_ATTR, "1");

        const network = document.createElementNS(SVG_NS, "g");
        network.setAttribute("class", "routing-route-focused-network");

        roads.forEach((road) => {
            const d = pathData(roadPoints(road), project);
            if (!d) return;
            const condition = road?.blocked
                ? "blocked"
                : num(road?.accessibility_percent, 100) < 70
                    ? "degraded"
                    : "clear";
            const path = makePath(`routing-road routing-road-${condition}`, d);
            path.setAttribute("data-road-id", String(road.id ?? ""));
            const title = document.createElementNS(SVG_NS, "title");
            title.textContent = String(road.id ?? "OSM road");
            path.appendChild(title);
            network.appendChild(path);
        });

        svg.appendChild(network);

        const routeD = pathData(routePoints, project);
        if (routeD) {
            const routeRoads = (route?.road_path || [])
                .map((id) => (state()?.roads || []).find((road) => String(road.id) === String(id)))
                .filter(Boolean);

            const blocked = routeRoads.some((road) => !!road.blocked);
            const degraded = routeRoads.some(
                (road) => !road.blocked && num(road.accessibility_percent, 100) < 70
            );

            const layer = document.createElementNS(SVG_NS, "g");
            layer.setAttribute(
                "class",
                `${LAYER_CLASS}${blocked ? " is-blocked" : degraded ? " is-degraded" : ""}`
            );
            layer.setAttribute("aria-label", "Continuous OSM road route");

            layer.appendChild(makePath("routing-osm-route-glow", routeD));
            layer.appendChild(makePath("routing-osm-route-casing", routeD));
            layer.appendChild(makePath("routing-osm-route-main", routeD));
            layer.appendChild(makePath("routing-osm-route-center", routeD));
            svg.appendChild(layer);
        }

        return svg;
    }

    function replaceWithFocusedMap(svg, route, geometry) {
        if (!svg || !route || !geometry) return svg;
        if (svg.getAttribute(FOCUSED_ATTR) === "1") return svg;

        ensureStyles();
        const focused = createFocusedSvg(route, geometry);
        if (!focused) return svg;

        svg.replaceWith(focused);
        return focused;
    }

    function removeRedundantViewControl(viewport) {
        viewport?.querySelector(".routing-view-mode")?.remove();
    }

    function ensureSvg(svg, route) {
        if (!svg || !route) return;
        if (svg.getAttribute(FOCUSED_ATTR) === "1") return;

        const run = async () => {
            const geometry = route.route_geometry || await fetchGeometry(route);
            if (!geometry) return;

            route.route_geometry = geometry;
            const focused = replaceWithFocusedMap(svg, route, geometry);
            if (!focused) return;

            // No viewBox mutation, CSS transform, fitBounds, pan, or zoom is
            // performed here. The replacement SVG is born already centered on
            // the real OSM route and its surrounding real OSM road network.
            removeRedundantViewControl(focused.closest(".routing-map-viewport"));
            focused.setAttribute(ENHANCED_ATTR, "1");
        };

        run();
    }

    function observeWorkspace(workspace) {
        if (!workspace || workspace.dataset.osmRouteObserver === "1") return;
        workspace.dataset.osmRouteObserver = "1";

        const observer = new MutationObserver(() => {
            window.requestAnimationFrame(() => {
                const route = state()?.route;
                if (!route) return;
                workspace.querySelectorAll(".routing-map-svg").forEach((svg) => ensureSvg(svg, route));
            });
        });

        observer.observe(workspace, { childList: true, subtree: true });

        window.requestAnimationFrame(() => {
            const route = state()?.route;
            if (!route) return;
            workspace.querySelectorAll(".routing-map-svg").forEach((svg) => ensureSvg(svg, route));
        });
    }

    function start() {
        const attach = () => {
            const workspace = document.getElementById("routing-workspace");
            if (workspace) observeWorkspace(workspace);
        };

        const bodyObserver = new MutationObserver(() => {
            attach();
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
