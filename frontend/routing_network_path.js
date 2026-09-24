/*
 * Real-road route visualisation.
 *
 * The route engine remains authoritative for disaster-aware road selection.
 * The geometry endpoint reconstructs the physical path through the OSM road
 * graph between the selected ward-boundary road segments. This layer draws
 * that LineString as the single prominent route corridor.
 *
 * Important rendering rule:
 *   - this layer must never change the SVG viewBox;
 *   - the base routing renderer owns the map viewport;
 *   - the route overlay uses the same road/geometry projection as the base
 *     renderer so the physical OSM route stays exactly on the mapped roads.
 */
(function () {
    "use strict";

    const SVG_NS = "http://www.w3.org/2000/svg";
    const LAYER_CLASS = "routing-osm-route-layer";
    const STYLE_ID = "routing-osm-route-styles";
    const ENHANCED_ATTR = "data-osm-route-enhanced";
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

    function projection(current, geometry, width, height) {
        const points = [];
        (current?.roads || []).forEach((road) => collectCoordinates(road.path, points));
        collectCoordinates(geometry?.coordinates, points);
        if (!points.length) return null;

        const xs = points.map((point) => point[0]);
        const ys = points.map((point) => point[1]);
        let minX = Math.min(...xs);
        let maxX = Math.max(...xs);
        let minY = Math.min(...ys);
        let maxY = Math.max(...ys);

        const spanX = Math.max(maxX - minX, 0.001);
        const spanY = Math.max(maxY - minY, 0.001);
        const paddingFraction = 0.035;
        minX -= spanX * paddingFraction;
        maxX += spanX * paddingFraction;
        minY -= spanY * paddingFraction;
        maxY += spanY * paddingFraction;

        const drawableWidth = width - 44;
        const drawableHeight = height - 44;
        const scale = Math.min(
            drawableWidth / (maxX - minX),
            drawableHeight / (maxY - minY)
        );
        const drawnWidth = (maxX - minX) * scale;
        const drawnHeight = (maxY - minY) * scale;
        const offsetX = (width - drawnWidth) / 2;
        const offsetY = (height - drawnHeight) / 2;

        return (lon, lat) => [
            offsetX + (Number(lon) - minX) * scale,
            height - (offsetY + (Number(lat) - minY) * scale),
        ];
    }

    function routePoints(svg, geometry) {
        const coordinates = geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return [];

        const viewBox = (svg.getAttribute("viewBox") || "0 0 920 520")
            .trim()
            .split(/\s+/)
            .map(Number);
        const width = Number.isFinite(viewBox[2]) ? viewBox[2] : 920;
        const height = Number.isFinite(viewBox[3]) ? viewBox[3] : 520;
        const project = projection(state(), geometry, width, height);
        if (!project) return [];

        return coordinates
            .filter(isValidPoint)
            .map((point) => project(point[0], point[1]))
            .filter((point) => point.every(Number.isFinite));
    }

    function pathData(points) {
        if (points.length < 2) return "";
        return points
            .map((point, index) =>
                `${index === 0 ? "M" : "L"}${point[0].toFixed(2)} ${point[1].toFixed(2)}`
            )
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
            .${LAYER_CLASS} {
                pointer-events: none;
            }

            /* restrained halo: enough separation from the OSM network,
               without turning the route into a neon blob */
            .${LAYER_CLASS} .routing-osm-route-glow {
                stroke: #00f5a0;
                stroke-width: 9;
                opacity: .12;
                filter: drop-shadow(0 0 4px rgba(0,245,160,.55));
            }

            /* dark casing makes the selected road leg readable against
               dense real road geometry */
            .${LAYER_CLASS} .routing-osm-route-casing {
                stroke: #031018;
                stroke-width: 8;
                opacity: .96;
            }

            /* actual selected OSM route */
            .${LAYER_CLASS} .routing-osm-route-main {
                stroke: #00e99a;
                stroke-width: 4.2;
                opacity: 1;
            }

            /* restrained navigation-style centerline */
            .${LAYER_CLASS} .routing-osm-route-center {
                stroke: #eafff8;
                stroke-width: 1.15;
                opacity: .92;
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

            /* Keep the real source road visible underneath the highlight so
               the viewer can see that the route follows mapped geometry. */
            .routing-road-route.routing-osm-route-source {
                opacity: .42 !important;
                stroke-width: 1.35 !important;
                filter: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function clearLegacyRouteLayers(svg) {
        [
            ".routing-continuous-route-layer",
            ".routing-route-glow-layer",
            ".routing-route-casing-layer",
            ".routing-route-pulse-layer",
        ].forEach((selector) => {
            svg.querySelectorAll(selector).forEach((element) => element.remove());
        });

        svg.querySelectorAll(".routing-road-route").forEach((path) => {
            path.classList.remove(
                "routing-route-segment-muted",
                "routing-route-focus-hidden"
            );
            path.classList.add("routing-osm-route-source");
        });
    }

    function addRouteLayer(svg, route, geometry) {
        const points = routePoints(svg, geometry);
        const d = pathData(points);
        if (!d) return false;

        clearLegacyRouteLayers(svg);
        svg.querySelector(`.${LAYER_CLASS}`)?.remove();

        const roads = (route.road_path || [])
            .map((id) => (state()?.roads || []).find((road) => String(road.id) === String(id)))
            .filter(Boolean);

        const blocked = roads.some((road) => !!road.blocked);
        const degraded = roads.some(
            (road) => !road.blocked && num(road.accessibility_percent, 100) < 70
        );

        const layer = document.createElementNS(SVG_NS, "g");
        layer.setAttribute(
            "class",
            `${LAYER_CLASS}${blocked ? " is-blocked" : degraded ? " is-degraded" : ""}`
        );
        layer.setAttribute("aria-label", "Continuous OSM road route");

        layer.appendChild(makePath("routing-osm-route-glow", d));
        layer.appendChild(makePath("routing-osm-route-casing", d));
        layer.appendChild(makePath("routing-osm-route-main", d));
        layer.appendChild(makePath("routing-osm-route-center", d));

        svg.appendChild(layer);

        positionMarkers(svg, points);
        return true;
    }

    function positionMarkers(svg, points) {
        if (points.length < 2) return;

        const origin = svg.querySelector(".routing-marker-origin");
        const destination = svg.querySelector(".routing-marker-destination");

        if (origin) {
            origin.setAttribute(
                "transform",
                `translate(${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)})`
            );
        }

        if (destination) {
            const last = points[points.length - 1];
            destination.setAttribute(
                "transform",
                `translate(${last[0].toFixed(2)} ${last[1].toFixed(2)})`
            );
        }
    }

    function removeRedundantViewControl(viewport) {
        viewport?.querySelector(".routing-view-mode")?.remove();
    }

    function ensureSvg(svg, route) {
        if (!svg || !route) return;

        const run = async () => {
            const geometry = route.route_geometry || await fetchGeometry(route);
            if (!geometry) return;

            route.route_geometry = geometry;
            ensureStyles();
            if (!addRouteLayer(svg, route, geometry)) return;

            // Deliberately do not call any fit/pan/zoom operation here.
            // The base routing renderer owns the map viewport.
            const viewport = svg.closest(".routing-map-viewport");
            removeRedundantViewControl(viewport);

            svg.setAttribute(ENHANCED_ATTR, "1");
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
