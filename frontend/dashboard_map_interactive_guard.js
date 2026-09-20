/* Prevent legacy studio click handlers from re-rendering interactive maps. */
(function () {
    "use strict";

    function syncSelection(zoneId) {
        document.querySelectorAll(".map-studio-window").forEach((win) => {
            win.querySelectorAll(".studio-ward.selected, .studio-marker.selected").forEach((node) => node.classList.remove("selected"));
            if (zoneId) {
                const selector = `[data-zone-id="${CSS.escape(zoneId)}"]`;
                win.querySelectorAll(selector).forEach((node) => node.classList.add("selected"));
            }
        });
    }

    document.addEventListener("click", (event) => {
        const ward = event.target.closest?.(".map-studio-window .studio-ward");
        if (!ward) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        if (typeof selectDashboardZone === "function") {
            selectDashboardZone(ward.dataset.zoneId);
        }
        syncSelection(ward.dataset.zoneId);
    }, true);
})();
