/*
 * Historical replay compatibility wrapper.
 *
 * The legacy replay module predates the SPA-style navigation and uses a
 * document-level CAPTURE click listener with generic .primary-button /
 * .secondary-button selectors. Because capture listeners run before the
 * target button handlers, a bubble-phase guard is too late: Routing and
 * World Controls get hijacked before their own handlers can run.
 *
 * Keep the legacy module intact, but filter the click listener while it is
 * being registered so only the two Dashboard response controls can reach it.
 */
(function () {
    "use strict";

    function isHistoricalControl(target) {
        return !!target?.closest?.(
            ".incident-panel .primary-button, .incident-panel .secondary-button"
        );
    }

    function restoreViewButtonLabels() {
        // Defensive cleanup for dynamically rendered SPA views. The legacy
        // module historically used a global .primary-button selector.
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

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    let guardRestored = false;

    function restoreGuard() {
        if (guardRestored) return;
        guardRestored = true;
        EventTarget.prototype.addEventListener = nativeAddEventListener;
    }

    // The legacy module registers its click handler in CAPTURE phase. Wrap
    // document click listeners only while the legacy script is booting, so
    // its own handler receives Dashboard controls but ignores every other
    // SPA view. Target/button handlers are left completely untouched.
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (
            !guardRestored &&
            this === document &&
            type === "click" &&
            typeof listener === "function"
        ) {
            const guardedListener = function (event) {
                if (!isHistoricalControl(event.target)) return;
                return listener.call(this, event);
            };

            return nativeAddEventListener.call(
                this,
                type,
                guardedListener,
                options
            );
        }

        return nativeAddEventListener.call(this, type, listener, options);
    };

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

    // Load the legacy implementation only after the registration guard is
    // installed. Keep the guard alive through the legacy DOMContentLoaded
    // callback because that callback installs the actual click listener.
    const legacyScript = document.createElement("script");
    legacyScript.src = "dashboard_historical_simulation_legacy.js";
    legacyScript.onload = () => {
        restoreViewButtonLabels();

        if (document.readyState === "loading") {
            nativeAddEventListener.call(
                document,
                "DOMContentLoaded",
                restoreGuard,
                { once: true }
            );
        } else {
            restoreGuard();
        }
    };
    legacyScript.onerror = () => {
        restoreGuard();
        console.error("Failed to load historical replay module.");
    };
    document.head.appendChild(legacyScript);
})();
