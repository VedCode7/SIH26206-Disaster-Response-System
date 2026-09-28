/*
 * Live physical-condition layer.
 *
 * Risk assessments contain normalized factors for scoring. The dashboard's
 * condition cards must display the authoritative physical values held in the
 * current WorldState instead. This module owns that presentation boundary so
 * risk-factor values never flash into the physical-condition cards during
 * dashboard bootstrap, zone selection, or normal live refresh.
 */
(function () {
    "use strict";

    const REFRESH_MS = 15000;
    let liveZones = new Map();
    let applyingLiveValues = false;

    function simulationIsRunning() {
        return document.querySelector(".simulation-state")?.textContent === "RUNNING";
    }

    function conditionElements() {
        return document.querySelectorAll(".condition strong");
    }

    function hideConditionValuesUntilLive() {
        const conditions = conditionElements();
        conditions.forEach((element) => {
            element.dataset.liveReady = "false";
            element.style.visibility = "hidden";
        });
    }

    function revealConditionValues() {
        conditionElements().forEach((element) => {
            element.dataset.liveReady = "true";
            element.style.visibility = "visible";
        });
    }

    function chooseZoneId() {
        if (typeof DASHBOARD_RUNTIME === "undefined") return null;

        if (DASHBOARD_RUNTIME.selectedZoneId && liveZones.has(DASHBOARD_RUNTIME.selectedZoneId)) {
            return DASHBOARD_RUNTIME.selectedZoneId;
        }

        const fallback = typeof dashboardHighestRisk === "function"
            ? dashboardHighestRisk(DASHBOARD_RUNTIME.overview)
            : null;

        if (fallback?.zone_id && liveZones.has(fallback.zone_id)) {
            return fallback.zone_id;
        }

        return liveZones.keys().next().value || null;
    }

    function applyLiveZoneConditions() {
        if (simulationIsRunning() || !liveZones.size) return false;

        const zoneId = chooseZoneId();
        const zone = zoneId ? liveZones.get(zoneId) : null;
        const conditions = conditionElements();
        if (!zone || conditions.length < 3) return false;

        applyingLiveValues = true;
        try {
            conditions[0].textContent = `${Number(zone.water_depth_m ?? 0).toFixed(2)} m`;
            conditions[1].textContent = `${Number(zone.rainfall_mm_per_hr ?? 0).toFixed(0)} mm/hr`;
            conditions[2].textContent = `${Number(zone.accessibility_percent ?? 0).toFixed(0)}%`;
            revealConditionValues();
            return true;
        } finally {
            applyingLiveValues = false;
        }
    }

    async function loadLiveZoneConditions() {
        if (typeof DASHBOARD_RUNTIME === "undefined") return false;
        if (simulationIsRunning()) return false;

        try {
            const response = await fetch(`${API_BASE}/world/zones`, {
                headers: { "Content-Type": "application/json" },
            });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

            const payload = await response.json();
            const zones = Array.isArray(payload?.zones) ? payload.zones : [];
            if (!zones.length) return false;

            liveZones = new Map(zones.map((zone) => [zone.id, zone]));
            DASHBOARD_RUNTIME.liveZones = liveZones;
            return applyLiveZoneConditions();
        } catch (error) {
            console.warn("Live physical conditions unavailable:", error);
            return false;
        }
    }

    function installConditionGuard() {
        const grid = document.querySelector(".condition-grid");
        if (!grid) return;

        hideConditionValuesUntilLive();

        const observer = new MutationObserver(() => {
            if (applyingLiveValues || simulationIsRunning()) return;
            if (liveZones.size) applyLiveZoneConditions();
        });

        observer.observe(grid, {
            subtree: true,
            childList: true,
            characterData: true,
        });
    }

    function startLiveConditionRefresh() {
        installConditionGuard();

        // Start immediately rather than waiting for DOMContentLoaded. The
        // dashboard scripts are loaded at the end of <body>, so the condition
        // cards already exist here. This also races the dashboard bootstrap
        // fetch instead of starting a second-stage update after it renders.
        loadLiveZoneConditions();
        window.setInterval(loadLiveZoneConditions, REFRESH_MS);
    }

    window.loadLiveZoneConditions = loadLiveZoneConditions;
    window.dashboardLiveZones = () => liveZones;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startLiveConditionRefresh, { once: true });
    } else {
        startLiveConditionRefresh();
    }
})();
