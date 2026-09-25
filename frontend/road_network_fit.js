/* ============================================================
   Road Network — initial viewport fit
   Normalises the visual canvas transform so the persisted road
   graph fits completely on first render while preserving the
   existing relative zoom behaviour.
   ============================================================ */
(function () {
    "use strict";

    if (window.__roadNetworkFitPatchInstalled) return;
    window.__roadNetworkFitPatchInstalled = true;

    const originalScale = CanvasRenderingContext2D.prototype.scale;
    const INITIAL_VIEW_SCALE = 1.24;

    CanvasRenderingContext2D.prototype.scale = function (x, y) {
        if (
            this.canvas &&
            this.canvas.classList &&
            this.canvas.classList.contains("road-canvas") &&
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            x === y &&
            x > 1
        ) {
            const normalised = x / INITIAL_VIEW_SCALE;
            return originalScale.call(this, normalised, normalised);
        }

        return originalScale.call(this, x, y);
    };
})();
