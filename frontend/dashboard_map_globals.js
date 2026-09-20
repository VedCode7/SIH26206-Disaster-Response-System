/* Shared dashboard-map state bridge.
 *
 * The production runtime is the single source of truth for Chennai
 * geography, assessments, and the selected ward. Map Studio and its
 * interaction modules consume these legacy-compatible names, so expose
 * them as safe read-through views of DASHBOARD_RUNTIME.
 */
(function () {
    "use strict";

    const runtime = () => (
        typeof DASHBOARD_RUNTIME !== "undefined" ? DASHBOARD_RUNTIME : null
    );

    try {
        Object.defineProperties(window, {
            realDashboardGeoCache: {
                configurable: true,
                get: () => {
                    const state = runtime();
                    if (!state) return null;
                    return {
                        wards: Array.isArray(state.wards) ? state.wards : [],
                        roads: Array.isArray(state.roads) ? state.roads : [],
                    };
                },
            },
            realDashboardAssessments: {
                configurable: true,
                get: () => runtime()?.assessments instanceof Map
                    ? runtime().assessments
                    : new Map(),
            },
            selectedZoneId: {
                configurable: true,
                get: () => runtime()?.selectedZoneId ?? null,
            },
        });
    } catch (error) {
        console.warn("Could not expose dashboard map state:", error);
    }
})();
