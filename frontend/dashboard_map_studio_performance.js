/* Lightweight Chennai Map Studio.
 *
 * The dashboard already has a full Map Studio implementation in
 * dashboard_map_studio.js. This compatibility layer only makes its
 * expensive renderer lazy and data-aware; it does not replace the
 * established window manager, toolbar, Tile, Stack, or navigation code.
 */
(function () {
    "use strict";

    const MAX_WAIT_MS = 20000;
    const POLL_MS = 100;

    function runtimeData() {
        if (
            typeof DASHBOARD_RUNTIME !== "undefined" &&
            Array.isArray(DASHBOARD_RUNTIME.wards) &&
            Array.isArray(DASHBOARD_RUNTIME.roads) &&
            DASHBOARD_RUNTIME.wards.length &&
            DASHBOARD_RUNTIME.roads.length
        ) {
            return {
                wards: DASHBOARD_RUNTIME.wards,
                roads: DASHBOARD_RUNTIME.roads,
            };
        }

        if (
            window.realDashboardGeoCache?.wards?.length &&
            window.realDashboardGeoCache?.roads?.length
        ) {
            return window.realDashboardGeoCache;
        }

        return null;
    }

    async function waitForRuntimeData() {
        const started = performance.now();

        if (typeof window.initializeRealDashboard === "function") {
            window.initializeRealDashboard().catch(() => {});
        }

        while (performance.now() - started < MAX_WAIT_MS) {
            const data = runtimeData();
            if (data) return data;
            await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }

        throw new Error("Chennai geography did not become available within 20 seconds.");
    }

    function patchStudioRenderer() {
        if (typeof window.refreshMapStudio !== "function") {
            return false;
        }

        // The established studio exposes createWindow internally, so we do not
        // replace it. We simply ensure that the shared geography cache is ready
        // before the user can open a studio view.
        const existingOpen = window.openMapStudio;
        if (typeof existingOpen !== "function") return false;

        if (window.__chennaiMapStudioGuarded) return true;
        window.__chennaiMapStudioGuarded = true;

        window.openMapStudio = async function guardedOpenMapStudio(type = "risk") {
            try {
                await waitForRuntimeData();
                return existingOpen(type);
            } catch (error) {
                console.error("Could not prepare Chennai Map Studio:", error);
                return null;
            }
        };

        return true;
    }

    function boot() {
        if (patchStudioRenderer()) return;
        window.setTimeout(boot, 50);
    }

    boot();
})();