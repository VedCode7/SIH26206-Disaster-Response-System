// ============================================================
// SIH26206 LIVE CONDITIONS BOOTSTRAP
// ============================================================
// The original application has been moved to app.core.js without
// changing its contents. This bootstrap loads it synchronously,
// then keeps the incident panel tied to raw Zone measurements.
// ============================================================

document.write('<script src="app.core.js"><\\/script>');

(function () {
    async function loadLiveConditions() {
        try {
            const response = await fetch("http://127.0.0.1:8000/world/zones");
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

            const data = await response.json();
            const zones = Array.isArray(data) ? data : (data.zones || []);
            if (!zones.length) return;

            const byId = new Map(zones.map(zone => [zone.id, zone]));
            window.__radarZones = byId;

            const assessmentsResponse = await fetch("http://127.0.0.1:8000/risk/overview");
            if (!assessmentsResponse.ok) throw new Error(`${assessmentsResponse.status} ${assessmentsResponse.statusText}`);

            const overview = await assessmentsResponse.json();
            const assessments = overview.assessments || [];
            if (!assessments.length) return;

            const highest = assessments.reduce((h, current) =>
                Number(current.risk_score) > Number(h.risk_score) ? current : h
            );

            const zone = byId.get(highest.zone_id);
            if (!zone) return;

            updateConditionCards(zone, highest);
        } catch (error) {
            console.error("Could not load live zone conditions:", error);
        }
    }

    function updateConditionCards(zone, assessment) {
        const conditions = document.querySelectorAll(".condition");
        if (conditions.length < 4) return;

        const water = Number(zone.water_depth_m);
        const rain = Number(zone.rainfall_mm_per_hr);
        const access = Number(zone.accessibility_percent);
        const level = String(assessment?.risk_level || "normal").toLowerCase();

        if (Number.isFinite(water)) {
            conditions[0].querySelector("strong").textContent = `${water.toFixed(2)} m`;
        }
        if (Number.isFinite(rain)) {
            conditions[1].querySelector("strong").textContent = `${rain.toFixed(1)} mm/hr`;
        }
        if (Number.isFinite(access)) {
            conditions[2].querySelector("strong").textContent = `${access.toFixed(0)}%`;
        }
        conditions[3].querySelector("strong").textContent =
            level === "critical" || level === "high" ? "REQUIRED" : "MONITOR";
    }

    // The simulation backend exposes normalized risk factors. Never reverse
    // those factors into physical units. If a simulation step identifies a
    // zone, display that zone's raw measurements instead.
    window.updateIncidentFromFactors = function (step) {
        if (!step) return;

        const zoneId = step.zone_id || "Z001";
        const zone = window.__radarZones?.get(zoneId);
        if (zone) {
            updateConditionCards(zone, step);
            return;
        }

        const conditions = document.querySelectorAll(".condition");
        if (conditions.length < 4) return;

        const level = String(step.risk_level || "normal").toLowerCase();
        conditions[3].querySelector("strong").textContent =
            level === "critical" || level === "high" ? "REQUIRED" : "MONITOR";
    };

    document.addEventListener("DOMContentLoaded", () => {
        // Let the original dashboard finish its first render.
        setTimeout(loadLiveConditions, 0);
    });

    // Keep the dashboard current even when no simulation is running.
    setInterval(loadLiveConditions, 15000);
})();
