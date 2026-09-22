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

    const legacyScript = document.createElement("script");
    legacyScript.src = "dashboard_historical_simulation_legacy.js";
    legacyScript.onerror = () => {
        console.error("Failed to load historical replay module.");
    };
    document.head.appendChild(legacyScript);
})();
