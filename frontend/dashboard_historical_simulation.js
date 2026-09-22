/*
 * Historical replay compatibility wrapper.
 *
 * The legacy replay module installs a document-level capture listener for
 * generic .primary-button / .secondary-button selectors. That intercepted
 * buttons belonging to other views (notably World Controls and Routing).
 *
 * Keep the legacy implementation intact, but guard the listener registration
 * so only the two dashboard controls it owns can reach it.
 */
(function () {
    "use strict";

    const nativeAddEventListener = EventTarget.prototype.addEventListener;

    EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (
            this === document &&
            type === "click" &&
            options === true &&
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

    // document.write keeps the legacy script parser-synchronous, so its
    // DOMContentLoaded registration occurs while the guard is active.
    document.write(
        '<script src="dashboard_historical_simulation_legacy.js"><\/script>'
    );

    EventTarget.prototype.addEventListener = nativeAddEventListener;
})();
