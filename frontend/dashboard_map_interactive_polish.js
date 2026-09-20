/* Final workspace polish: restore per-map close controls after legacy CSS overrides. */
(function () {
    "use strict";

    if (document.getElementById("map-interactive-polish-css")) return;

    const style = document.createElement("style");
    style.id = "map-interactive-polish-css";
    style.textContent = `
        .map-studio-window-head > .map-studio-close {
            display: grid !important;
            place-items: center;
            flex: 0 0 30px;
            width: 30px;
            height: 30px;
            border: 1px solid rgba(127,150,184,.22);
            background: rgba(255,255,255,.035);
            color: #aebfd6;
            border-radius: 8px;
            cursor: pointer;
            font-size: 17px;
            line-height: 1;
        }
        .map-studio-window-head > .map-studio-close:hover {
            border-color: rgba(255,76,96,.55);
            color: #fff;
            background: rgba(255,76,96,.10);
        }
    `;
    document.head.appendChild(style);
})();
