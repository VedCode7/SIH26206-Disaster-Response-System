/* Single-owner Map Studio bootstrap.
 *
 * The dashboard runtime owns Chennai geography. This bootstrap intentionally
 * loads one final workspace renderer instead of stacking multiple legacy
 * studio/interaction runtimes that can overwrite each other's state.
 */
(function () {
    "use strict";

    function loadCss(href) {
        if (document.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
    }

    function loadFinalStudio() {
        if (document.querySelector('script[data-map-final-studio]')) return;
        const script = document.createElement("script");
        script.src = "dashboard_map_final.js";
        script.async = false;
        script.dataset.mapFinalStudio = "true";
        script.onload = () => {
            if (typeof window.__initializeFinalMapStudio === "function") {
                window.__initializeFinalMapStudio();
            }
        };
        script.onerror = () => console.error("Could not load final Chennai Map Studio renderer.");
        document.body.appendChild(script);
    }

    function init() {
        loadCss("dashboard_map_studio.css");
        loadFinalStudio();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
