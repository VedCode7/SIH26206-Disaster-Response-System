/*
 * Legacy focused-map renderer intentionally disabled.
 *
 * The routing page now has one authoritative renderer:
 *   frontend/routing_visual.js
 *
 * That renderer draws the persisted OSM road network in a stable SVG
 * viewport and overlays the physical route geometry returned by the backend.
 * This compatibility file remains because older index.html revisions load it;
 * it must not replace the map, mutate viewBox, apply transforms, fit bounds,
 * pan, zoom, or create a second route visualization.
 */
(function () {
    "use strict";
})();
