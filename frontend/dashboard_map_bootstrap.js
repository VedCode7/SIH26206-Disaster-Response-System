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
            await loadScript("dashboard_map_globals.js", "map-globals");
            await loadScript("dashboard_map_studio.js", "map-studio");
            await loadScript("dashboard_map_enhancements.js", "map-enhancements");
            await loadScript("dashboard_map_navigation_fix.js", "map-navigation-fix");
            await loadScript("dashboard_map_interactive_v2.js", "map-interactive-v2");
            await loadScript("dashboard_map_interactive_guard.js", "map-interactive-guard");
        } catch (error) {
            console.error("Could not load dashboard map studio:", error);
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
