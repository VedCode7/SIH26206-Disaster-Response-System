/*
 * Real-road route visualisation.
 *
 * The route engine remains authoritative for disaster-aware road selection.
 * The geometry endpoint reconstructs the physical path through the OSM road
 * graph between the selected ward-boundary road segments. This layer draws
 * that LineString as the single prominent route corridor.
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

    function projection(current, width, height) {
        const points = [];
        (current.roads || []).forEach((road) => collectCoordinates(road.path, points));
        (current.wards || []).forEach((ward) => collectCoordinates(ward.geometry?.coordinates, points));
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

    function routePoints(svg, geometry) {
        const coordinates = geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) return [];

        const viewBox = (svg.getAttribute("viewBox") || "0 0 920 520")
            .trim()
            .split(/\s+/)
            .map(Number);
        const width = Number.isFinite(viewBox[2]) ? viewBox[2] : 920;
        const height = Number.isFinite(viewBox[3]) ? viewBox[3] : 520;
        const project = projection(state(), width, height);
        if (!project) return [];

        return coordinates
            .filter((point) => Array.isArray(point) && point.length >= 2)
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

            .${LAYER_CLASS} .routing-osm-route-glow {
                stroke: #00f5a0;
                stroke-width: 20;
                opacity: .20;
                filter: drop-shadow(0 0 8px rgba(0,245,160,.95));
            }

            .${LAYER_CLASS} .routing-osm-route-casing {
                stroke: #020a10;
                stroke-width: 13;
                opacity: .98;
            }

            .${LAYER_CLASS} .routing-osm-route-main {
                stroke: #00f5a0;
                stroke-width: 7;
                opacity: 1;
                filter: drop-shadow(0 0 4px rgba(0,245,160,.95));
            }

            .${LAYER_CLASS} .routing-osm-route-center {
                stroke: #eafff8;
                stroke-width: 2.1;
                opacity: .95;
                stroke-dasharray: 5 14;
                animation: routingOsmRouteFlow 1.05s linear infinite;
            }

            .${LAYER_CLASS}.is-degraded .routing-osm-route-glow,
            .${LAYER_CLASS}.is-degraded .routing-osm-route-main {
                stroke: #ffb21b;
            }

            .${LAYER_CLASS}.is-blocked .routing-osm-route-glow,
            .${LAYER_CLASS}.is-blocked .routing-osm-route-main {
                stroke: #ff4050;
            }

            .routing-road-route.routing-osm-route-source {
                opacity: .18 !important;
                stroke-width: 2 !important;
                filter: none !important;
            }

            @keyframes routingOsmRouteFlow {
                to { stroke-dashoffset: -19; }
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
            .map((id) => (state().roads || []).find((road) => String(road.id) === String(id)))
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

    function focusContinuousRoute(svg) {
        const layer = svg.querySelector(`.${LAYER_CLASS}`);
        if (!layer) return;

        try {
            const box = layer.getBBox();
            if (!box || (!box.width && !box.height)) return;

            const full = (svg.getAttribute("viewBox") || "0 0 920 520")
                .trim()
                .split(/\s+/)
                .map(Number);
            if (full.length !== 4 || full.some((value) => !Number.isFinite(value))) return;

            const viewport = svg.clientWidth || 920;
            const viewportHeight = svg.clientHeight || 520;
            const aspect = viewport / Math.max(viewportHeight, 1);
            const padding = Math.max(34, Math.max(box.width, box.height) * 0.12);

            let width = box.width + padding * 2;
            let height = box.height + padding * 2;

            if (width / height > aspect) height = width / aspect;
            else width = height * aspect;

            width = Math.min(width, full[2]);
            height = Math.min(height, full[3]);

            let x = box.x + box.width / 2 - width / 2;
            let y = box.y + box.height / 2 - height / 2;

            x = Math.max(full[0], Math.min(x, full[0] + full[2] - width));
            y = Math.max(full[1], Math.min(y, full[1] + full[3] - height));

            svg.setAttribute(
                "viewBox",
                [x, y, width, height].map((value) => Number(value.toFixed(2))).join(" ")
            );
        } catch (_) {
            // Keep the renderer's full view if the SVG has not laid out yet.
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
            focusContinuousRoute(svg);

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
