/* Single-owner Map Studio bootstrap.
 *
 * The dashboard runtime owns Chennai geography. This bootstrap intentionally
 * loads one final workspace renderer instead of stacking multiple legacy
 * studio/interaction runtimes that can overwrite each other's state.
 */
(function () {
    "use strict";

    function loadScript(src, marker) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[data-map-asset="${marker}"]`)) {
                resolve();
                return;
            }
            const script = document.createElement("script");
            script.src = src;
            script.async = false;
            script.dataset.mapAsset = marker;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    function loadCss(href) {
        if (document.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
    }

    async function init() {
        loadCss("dashboard_map_studio.css");
        try {
            await loadScript("dashboard_map_final.js", "map-final-studio");
            await loadScript("dashboard_map_markers.js", "map-markers");
        } catch (error) {
            console.error("Could not load final Chennai map integration:", error);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
