/*
 * Map Studio compatibility/fix layer.
 *
 * This file deliberately sits on top of the existing Map Studio renderer.
 * It does not replace the geography renderer, routing graph, ward data, or
 * dashboard runtime. Its job is limited to restoring presentation/interaction
 * behavior that can safely be layered onto the existing studio windows.
 */
(function () {
    "use strict";

    const state = {
        z: 12000,
        queued: false,
    };

    function runtime() {
        return typeof DASHBOARD_RUNTIME !== "undefined" ? DASHBOARD_RUNTIME : null;
    }

    function assessments() {
        const r = runtime();
        if (r && r.assessments instanceof Map) return r.assessments;
        if (window.realDashboardAssessments instanceof Map) return window.realDashboardAssessments;
        return new Map();
    }

    function number(value, fallback = null) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function accessibilityPercent(assessment) {
        if (!assessment || !assessment.factors) return 100;

        const factors = assessment.factors;
        const direct = number(factors.accessibility_percent);
        if (direct !== null) return Math.max(0, Math.min(100, direct));

        const risk = number(factors.accessibility_risk);
        if (risk !== null) return Math.max(0, Math.min(100, 100 - risk));

        // No accessibility degradation has been recorded. A missing field must
        // never be interpreted as 0% accessibility.
        return 100;
    }

    function accessClass(percent) {
        if (percent < 35) return "critical";
        if (percent < 70) return "watch";
        return "good";
    }

    function repairAccessibility(win) {
        const title = win.querySelector(".map-studio-window-head strong");
        if (!title || title.textContent.trim() !== "Accessibility") return;

        const as = assessments();
        win.querySelectorAll(".studio-ward").forEach((ward) => {
            const id = ward.dataset.zoneId;
            const assessment = as.get(id);
            const cls = accessClass(accessibilityPercent(assessment));
            ward.classList.remove("good", "watch", "critical");
            ward.classList.add(cls);
        });

        // The accessibility view should only show blocked/restricted roads when
        // the actual road dataset says so. It must not inherit ward risk colour.
        win.querySelectorAll(".studio-road, .studio-zone-link").forEach((road) => {
            if (road.classList.contains("critical") || road.classList.contains("watch")) return;
            road.classList.add("good");
        });
    }

    function bringToFront(win) {
        state.z += 1;
        win.style.zIndex = String(state.z);
        win.classList.add("map-studio-active-window");
        document.querySelectorAll(".map-studio-window.map-studio-active-window").forEach((other) => {
            if (other !== win) other.classList.remove("map-studio-active-window");
        });
    }

    function toggleMaximize(win) {
        const maximized = win.classList.toggle("is-maximized");
        win.classList.remove("is-popout");
        const button = win.querySelector("[data-studio-action=\"maximize\"]");
        if (button) {
            button.textContent = maximized ? "↙" : "⛶";
            button.title = maximized ? "Restore window" : "Maximize map";
            button.setAttribute("aria-label", button.title);
        }
        const pop = win.querySelector("[data-studio-action=\"popout\"]");
        if (pop) {
            pop.textContent = "↗";
            pop.title = "Pop out map";
            pop.setAttribute("aria-label", pop.title);
        }
        bringToFront(win);
    }

    function togglePopout(win) {
        const popout = win.classList.toggle("is-popout");
        win.classList.remove("is-maximized");
        const button = win.querySelector("[data-studio-action=\"popout\"]");
        if (button) {
            button.textContent = popout ? "↙" : "↗";
            button.title = popout ? "Return map to workspace" : "Pop out map";
            button.setAttribute("aria-label", button.title);
        }
        const max = win.querySelector("[data-studio-action=\"maximize\"]");
        if (max) {
            max.textContent = "⛶";
            max.title = "Maximize map";
            max.setAttribute("aria-label", max.title);
        }
        bringToFront(win);
    }

    function ensureWindowControls(win) {
        const head = win.querySelector(".map-studio-window-head");
        const close = head?.querySelector(".map-studio-close");
        if (!head || !close || head.dataset.fixControls === "1") return;

        head.dataset.fixControls = "1";

        const actions = document.createElement("div");
        actions.className = "map-studio-window-actions";

        const popout = document.createElement("button");
        popout.type = "button";
        popout.className = "map-studio-window-action";
        popout.dataset.studioAction = "popout";
        popout.textContent = "↗";
        popout.title = "Pop out map";
        popout.setAttribute("aria-label", popout.title);

        const maximize = document.createElement("button");
        maximize.type = "button";
        maximize.className = "map-studio-window-action";
        maximize.dataset.studioAction = "maximize";
        maximize.textContent = "⛶";
        maximize.title = "Maximize map";
        maximize.setAttribute("aria-label", maximize.title);

        actions.append(popout, maximize);
        close.parentNode.insertBefore(actions, close);

        popout.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            togglePopout(win);
        });

        maximize.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleMaximize(win);
        });

        win.addEventListener("pointerdown", () => bringToFront(win), true);
        win.addEventListener("click", () => bringToFront(win), true);
    }

    function ensureLauncherStyle() {
        if (document.getElementById("map-studio-fix-style")) return;

        const style = document.createElement("style");
        style.id = "map-studio-fix-style";
        style.textContent = `
            .map-insight-launcher-final {
                appearance: none !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 9px !important;
                min-width: 158px !important;
                height: 42px !important;
                padding: 0 16px !important;
                border: 1px solid rgba(255,178,29,.58) !important;
                border-radius: 11px !important;
                background: linear-gradient(135deg, rgba(255,178,29,.18), rgba(255,178,29,.055)) !important;
                color: #f7fbff !important;
                box-shadow: 0 8px 24px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.06) !important;
                font: 800 11px/1 Inter, ui-sans-serif, system-ui, sans-serif !important;
                letter-spacing: .08em !important;
                cursor: pointer !important;
                transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease !important;
            }
            .map-insight-launcher-final b {
                font-size: 15px !important;
                line-height: 1 !important;
                color: #ffb21d !important;
            }
            .map-insight-launcher-final:hover {
                transform: translateY(-1px) !important;
                border-color: rgba(255,178,29,.95) !important;
                background: linear-gradient(135deg, rgba(255,178,29,.27), rgba(255,178,29,.09)) !important;
                box-shadow: 0 12px 30px rgba(0,0,0,.32), 0 0 22px rgba(255,178,29,.08) !important;
            }
            .map-studio-window-actions {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                margin-left: auto;
            }
            .map-studio-window-head > .map-studio-window-actions + .map-studio-close {
                flex: 0 0 auto;
            }
            .map-studio-window-action {
                width: 27px;
                height: 27px;
                display: grid;
                place-items: center;
                border: 1px solid rgba(127,150,184,.22);
                background: rgba(255,255,255,.035);
                color: #aebfd6;
                border-radius: 8px;
                cursor: pointer;
                font: 700 13px/1 Inter, ui-sans-serif, system-ui, sans-serif;
                transition: .16s ease;
            }
            .map-studio-window-action:hover {
                border-color: rgba(75,166,255,.60);
                background: rgba(75,166,255,.10);
                color: #fff;
                transform: translateY(-1px);
            }
            .map-studio-window.map-studio-active-window {
                box-shadow: 0 28px 78px rgba(0,0,0,.58), 0 0 0 1px rgba(75,166,255,.10) inset;
            }
            .map-studio-window.is-maximized {
                left: 24px !important;
                top: 84px !important;
                width: calc(100vw - 48px) !important;
                height: calc(100vh - 108px) !important;
                min-height: 0 !important;
                z-index: 20000 !important;
            }
            .map-studio-window.is-maximized .map-studio-body {
                height: calc(100% - 58px);
                display: flex;
                flex-direction: column;
            }
            .map-studio-window.is-maximized .map-studio-svg {
                height: calc(100% - 36px);
                min-height: 320px;
                flex: 1 1 auto;
            }
            .map-studio-window.is-popout {
                left: 50% !important;
                top: 50% !important;
                width: min(980px, calc(100vw - 64px)) !important;
                height: min(720px, calc(100vh - 128px)) !important;
                min-height: 0 !important;
                transform: translate(-50%, -50%) !important;
                z-index: 20000 !important;
            }
            .map-studio-window.is-popout .map-studio-body {
                height: calc(100% - 58px);
                display: flex;
                flex-direction: column;
            }
            .map-studio-window.is-popout .map-studio-svg {
                height: calc(100% - 36px);
                min-height: 300px;
                flex: 1 1 auto;
            }
            @media (max-width: 700px) {
                .map-insight-launcher-final {
                    min-width: 132px !important;
                    height: 38px !important;
                    padding: 0 12px !important;
                }
                .map-studio-window.is-maximized,
                .map-studio-window.is-popout {
                    left: 10px !important;
                    top: 76px !important;
                    width: calc(100vw - 20px) !important;
                    height: calc(100vh - 88px) !important;
                    transform: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function patchWindow(win) {
        if (!win || !win.matches(".map-studio-window")) return;
        ensureWindowControls(win);
        repairAccessibility(win);
    }

    function schedulePatch() {
        if (state.queued) return;
        state.queued = true;
        requestAnimationFrame(() => {
            state.queued = false;
            document.querySelectorAll(".map-studio-window").forEach(patchWindow);
        });
    }

    function boot() {
        ensureLauncherStyle();
        schedulePatch();

        const observer = new MutationObserver(() => schedulePatch());
        observer.observe(document.body, { childList: true, subtree: true });

        window.addEventListener("resize", schedulePatch, { passive: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();
