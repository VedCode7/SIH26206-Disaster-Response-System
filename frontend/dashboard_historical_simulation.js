/*
 * Historical replay compatibility loader.
 *
 * The historical replay implementation is isolated from the SPA by using
 * dedicated historical control IDs inside the legacy module. Do not patch
 * EventTarget.prototype.addEventListener here: doing so can accidentally
 * intercept unrelated document-level listeners installed by the SPA while
 * the remaining scripts are booting.
 */
(function () {
    "use strict";

    // The risk engine exposes normalized risk factors for scoring, while the
    // historical replay engine also computes the underlying physical
    // conditions. Feed those physical values into the existing dashboard
    // renderer instead of making the UI reverse risk scores into measurements.
    const originalRuntimeFetch = window.dashboardRuntimeFetch;
    if (typeof originalRuntimeFetch === "function" && !window.__historicalPhysicalDataPatch) {
        window.__historicalPhysicalDataPatch = true;
        window.dashboardRuntimeFetch = async function (endpoint, options = {}) {
            const result = await originalRuntimeFetch(endpoint, options);

            if (endpoint === "/simulation/chennai-2015/response" && Array.isArray(result?.stages)) {
                result.stages = result.stages.map((stage) => {
                    const conditions = stage.highest_risk_conditions;
                    if (!conditions || !stage.highest_risk) return stage;

                    return {
                        ...stage,
                        highest_risk: {
                            ...stage.highest_risk,
                            factors: {
                                ...(stage.highest_risk.factors || {}),
                                water_depth_m: conditions.water_depth_m,
                                rainfall_mm_per_hr: conditions.rainfall_mm_per_hr,
                                accessibility_percent: conditions.accessibility_percent,
                            },
                        },
                    };
                });
            }

            return result;
        };
    }

    const legacyScript = document.createElement("script");
    legacyScript.src = "dashboard_historical_simulation_legacy.js";
    legacyScript.onerror = () => {
        console.error("Failed to load historical replay module.");
    };
    document.head.appendChild(legacyScript);
})();
