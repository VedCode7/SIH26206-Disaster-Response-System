/*
 * Historical replay compatibility wrapper.
 *
 * The legacy replay module installs a document-level click listener for
 * generic .primary-button / .secondary-button selectors. That intercepted
 * buttons belonging to other views (notably World Controls and Routing).
 *
 * Keep the legacy implementation intact, but guard its listener registration
 * so only the two dashboard controls it owns can reach it.
 */
(function () {
    "use strict";

    const nativeAddEventListener = EventTarget.prototype.addEventListener;

    EventTarget.prototype.addEventListener = function (type, listener, options) {
        // The legacy replay listener uses a normal (bubble-phase) document
        // click listener, so filtering only capture listeners is insufficient.
        // The guard is active only while the legacy script is being loaded.
        if (
            this === document &&
            type === "click" &&
            typeof listener === "function"
        ) {
            const guardedListener = function (event) {
                const target = event.target;
                const simulationButton = target?.closest?.(
                    ".activity-panel .primary-button"
                );
                const responseButton = target?.closest?.(
                    ".incident-panel .secondary-button"
                );

                if (!simulationButton && !responseButton) return;

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

    // Load the legacy implementation while the registration guard is active.
    // Using a dynamically inserted script keeps the guard installed until the
    // legacy file has actually executed; document.write could restore the
    // native method before an external script registered its listener.
    const legacyScript = document.createElement("script");
    legacyScript.src = "dashboard_historical_simulation_legacy.js";
    legacyScript.onload = () => {
        EventTarget.prototype.addEventListener = nativeAddEventListener;
    };
    legacyScript.onerror = () => {
        EventTarget.prototype.addEventListener = nativeAddEventListener;
        console.error("Failed to load historical replay module.");
    };
    document.head.appendChild(legacyScript);
})();
