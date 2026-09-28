/*
 * Live physical-condition layer.
 *
 * Risk assessments contain normalized factors for scoring. The dashboard's
 * condition cards must instead display the authoritative physical values
 * held in the current WorldState. This module keeps those concerns separate
 * and refreshes the selected zone without requiring a simulation replay.
 */
(function () {
    "use strict";

    const REFRESH_MS = 15000;

    async function loadLiveZoneConditions() {
        if (typeof DASHBOARD_RUNTIME === "undefined") return;

        const simulationState = document.querySelector(".simulation-state")?.textContent;
        if (simulationState === "RUNNING") return;

        try {
            const response = await fetch(`${API_BASE}/world/zones`, {
                headers: { "Content-Type": "application/json" },
            });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

            const payload = await response.json();
            const zones = Array.isArray(payload?.zones) ? payload.zones : [];
            if (!zones.length) return;

            const selectedZoneId = DASHBOARD_RUNTIME.selectedZoneId;
            const assessment = selectedZoneId
                ? DASHBOARD_RUNTIME.assessments?.get(selectedZoneId)
                : null;
            const fallback = typeof dashboardHighestRisk === "function"
                ? dashboardHighestRisk(DASHBOARD_RUNTIME.overview)
                : null;
            const zoneId = selectedZoneId || assessment?.zone_id || fallback?.zone_id;
            const zone = zones.find((item) => item.id === zoneId);
            if (!zone) return;

            const conditions = document.querySelectorAll(".condition strong");
            if (conditions.length < 3) return;

            conditions[0].textContent = `${Number(zone.water_depth_m ?? 0).toFixed(2)} m`;
            conditions[1].textContent = `${Number(zone.rainfall_mm_per_hr ?? 0).toFixed(0)} mm/hr`;
            conditions[2].textContent = `${Number(zone.accessibility_percent ?? 0).toFixed(0)}%`;
        } catch (error) {
            console.warn("Live physical conditions unavailable:", error);
        }
    }

    function startLiveConditionRefresh() {
        loadLiveZoneConditions();
        window.setInterval(loadLiveZoneConditions, REFRESH_MS);
    }

    document.addEventListener("DOMContentLoaded", startLiveConditionRefresh, { once: true });
    window.loadLiveZoneConditions = loadLiveZoneConditions;
})();
