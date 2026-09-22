/*
 * Historical replay compatibility wrapper.
 *
 * The legacy replay module predates the SPA-style navigation and uses generic
 * .primary-button / .secondary-button selectors. It must only own the two
 * controls on the Dashboard; Routing and World Controls have their own
 * handlers and must never invoke the 2015 replay.
 */
(function () {
    "use strict";

    function isHistoricalControl(target) {
        return !!target?.closest?.(
            ".activity-panel .primary-button, .incident-panel .secondary-button"
        );
    }

    function restoreViewButtonLabels() {
        // The legacy module's rewriteSimulationPanel() historically selected
        // the first .primary-button globally. On dynamically rendered pages
        // that could rename Routing / World Controls buttons to the replay
        // label. Restore labels for controls owned by those pages.
        const routeButton = document.getElementById("find-route-btn");
        if (routeButton && routeButton.textContent !== "Find Best Route") {
            routeButton.textContent = "Find Best Route";
        }

        const zoneButton = document.getElementById("update-zone-btn");
        if (zoneButton && zoneButton.textContent !== "Update Zone") {
            zoneButton.textContent = "Update Zone";
        }

        const roadButton = document.getElementById("update-road-btn");
        if (roadButton && roadButton.textContent !== "Update Road") {
            roadButton.textContent = "Update Road";
        }
    }

    // Register this BEFORE loading the legacy module. At document bubble
    // phase, the page's own target/button handlers have already executed, but
    // the legacy document-level click handler has not. Stopping propagation
    // here prevents the legacy replay handler from hijacking other views.
    document.addEventListener("click", (event) => {
        if (!isHistoricalControl(event.target)) {
            event.stopImmediatePropagation();
        }
    });

    const observer = new MutationObserver(() => {
        restoreViewButtonLabels();
    });

    const startObserver = () => {
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            restoreViewButtonLabels();
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    } else {
        startObserver();
    }

    // Load the legacy implementation only after the guard above is installed.
    const legacyScript = document.createElement("script");
    legacyScript.src = "dashboard_historical_simulation_legacy.js";
    legacyScript.onload = () => restoreViewButtonLabels();
    legacyScript.onerror = () => {
        console.error("Failed to load historical replay module.");
    };
    document.head.appendChild(legacyScript);
})();
