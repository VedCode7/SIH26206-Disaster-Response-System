/* Map workspace coordinator.
 *
 * The interactive workspace itself lives in dashboard_map_interactive_v2.js.
 * This file deliberately contains only the dashboard launcher and legacy
 * compatibility styling; it does not attach global click handlers to studio
 * maps, because those handlers made detached maps fight with one another.
 */
(function () {
    "use strict";

    function installLauncher() {
        const header = document.querySelector(".map-panel .panel-header");
        if (!header || header.querySelector(".map-insight-launcher-enhanced")) return;

        const button = document.createElement("button");
        button.className = "map-insight-launcher-enhanced";
        button.type = "button";
        button.innerHTML = "MAP STUDIO <b>↗</b>";
        button.title = "Open the interactive Chennai map workspace";
        button.addEventListener("click", () => {
            if (typeof openMapStudio === "function") openMapStudio("risk");
        });
        header.appendChild(button);
    }

    function installStyles() {
        if (document.getElementById("map-workspace-coordinator-css")) return;
        const style = document.createElement("style");
        style.id = "map-workspace-coordinator-css";
        style.textContent = `
            .map-insight-toolbar { display: none !important; }
            .map-insight-launcher-enhanced {
                margin-left: auto;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                border: 1px solid rgba(255,178,29,.34);
                border-radius: 9px;
                background: rgba(255,178,29,.07);
                color: #dce8f7;
                padding: 8px 11px;
                font: 800 9px/1 inherit;
                letter-spacing: .08em;
                cursor: pointer;
                white-space: nowrap;
            }
            .map-insight-launcher-enhanced:hover {
                border-color: rgba(255,178,29,.7);
                background: rgba(255,178,29,.13);
            }
        `;
        document.head.appendChild(style);
    }

    function init() {
        installStyles();
        installLauncher();

        const observer = new MutationObserver(() => installLauncher());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
