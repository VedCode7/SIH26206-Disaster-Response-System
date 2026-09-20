(function () {
    "use strict";
    try {
        Object.defineProperties(window, {
            realDashboardGeoCache: { configurable: true, get: () => typeof realDashboardGeoCache !== "undefined" ? realDashboardGeoCache : null },
            realDashboardAssessments: { configurable: true, get: () => typeof realDashboardAssessments !== "undefined" ? realDashboardAssessments : new Map() },
            selectedZoneId: { configurable: true, get: () => typeof selectedZoneId !== "undefined" ? selectedZoneId : null },
        });
    } catch (error) {
        console.warn("Could not expose dashboard map state:", error);
    }
})();
