/*
 * Operational route details.
 *
 * The map itself is rendered by routing_network_path.js from the real OSM
 * LineString returned by the geometry endpoint. This module deliberately
 * does not create another map overlay or a second focus/full-network
 * control. It only keeps the existing road-by-road operational corridor
 * beneath the map.
 */
(function () {
    "use strict";

    const OBSERVER_FLAG = "data-route-details-observer";

    function state() {
        return window.ROUTING_STATE || null;
    }

    function esc(value) {
        if (typeof window.escapeHTML === "function") return window.escapeHTML(value);
        return String(value ?? "").replace(/[&<>"']/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#039;",
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
        const byId = new Map((current.roads || []).map((road) => [String(road.id), road]));
        return (route.road_path || [])
            .map((id) => byId.get(String(id)))
            .filter(Boolean);
    }

    function condition(road) {
        if (road?.blocked) return "blocked";
        return num(road?.accessibility_percent, 100) < 70 ? "degraded" : "clear";
    }

    function renderCorridor(route) {
        const roads = routeRoads(route);
        if (!roads.length) return "";

        const counts = roads.reduce((result, road) => {
            result.total += 1;
            result[condition(road)] += 1;
            return result;
        }, { total: 0, clear: 0, degraded: 0, blocked: 0 });

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
                    <div class="routing-corridor-end routing-corridor-origin">
                        <i></i><strong>${esc(route.origin_zone_id || "ORIGIN")}</strong><small>ORIGIN</small>
                    </div>
                    <div class="routing-corridor-track">
                        <div class="routing-corridor-track-line"></div>
                        <div class="routing-corridor-track-pulse"></div>
                    </div>
                    <div class="routing-corridor-end routing-corridor-destination">
                        <i></i><strong>${esc(route.destination_zone_id || "DESTINATION")}</strong><small>DESTINATION</small>
                    </div>
                </div>
                <div class="routing-corridor-wardpath">
                    <span>WARD TRANSIT</span>
                    <div>
                        ${zonePath.map((zone, index) =>
                            `<b class="${index === 0 ? "is-origin" : index === zonePath.length - 1 ? "is-destination" : ""}">${esc(zone)}</b>${index < zonePath.length - 1 ? "<i>›</i>" : ""}`
                        ).join("")}
                    </div>
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

    function cleanMapControls(workspace) {
        workspace.querySelectorAll(".routing-view-mode").forEach((control) => control.remove());
    }

    function observeWorkspace(workspace) {
        if (!workspace || workspace.getAttribute(OBSERVER_FLAG) === "1") return;
        workspace.setAttribute(OBSERVER_FLAG, "1");

        const observer = new MutationObserver(() => {
            const route = state()?.route;
            if (!route) return;
            window.requestAnimationFrame(() => {
                cleanMapControls(workspace);
                ensureCorridor(workspace, route);
            });
        });

        observer.observe(workspace, { childList: true, subtree: true });

        window.requestAnimationFrame(() => {
            const route = state()?.route;
            if (!route) return;
            cleanMapControls(workspace);
            ensureCorridor(workspace, route);
        });
    }

    function start() {
        const attach = () => {
            const workspace = document.getElementById("routing-workspace");
            if (workspace) observeWorkspace(workspace);
        };

        const bodyObserver = new MutationObserver(attach);
        bodyObserver.observe(document.body, { childList: true, subtree: true });
        attach();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
