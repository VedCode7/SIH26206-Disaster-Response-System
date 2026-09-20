/* Stable Map Studio fix layer. This augments the existing renderer without replacing it. */
(function () {
    "use strict";

    const state = { z: 12000, queued: false };

    function assessments() {
        if (typeof DASHBOARD_RUNTIME !== "undefined" && DASHBOARD_RUNTIME?.assessments instanceof Map) {
            return DASHBOARD_RUNTIME.assessments;
        }
        return window.realDashboardAssessments instanceof Map ? window.realDashboardAssessments : new Map();
    }

    function num(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function accessPercent(a) {
        const f = a?.factors;
        if (!f) return 100;
        const direct = num(f.accessibility_percent);
        if (direct !== null) return Math.max(0, Math.min(100, direct));
        const risk = num(f.accessibility_risk);
        if (risk !== null) return Math.max(0, Math.min(100, 100 - risk));
        return 100;
    }

    function accessClass(value) {
        return value < 35 ? "critical" : value < 70 ? "watch" : "good";
    }

    function repairAccessibility(win) {
        const heading = win.querySelector(".map-studio-window-head strong");
        if (!heading || heading.textContent.trim() !== "Accessibility") return;

        const as = assessments();
        win.querySelectorAll(".studio-ward").forEach((ward) => {
            const wanted = accessClass(accessPercent(as.get(ward.dataset.zoneId)));
            if (ward.classList.contains(wanted) &&
                !["good", "watch", "critical"].some((c) => c !== wanted && ward.classList.contains(c))) {
                return;
            }
            ward.classList.remove("good", "watch", "critical");
            ward.classList.add(wanted);
        });
    }

    function bringToFront(win) {
        win.style.zIndex = String(++state.z);
        document.querySelectorAll(".map-studio-window.map-studio-active-window").forEach((other) => {
            if (other !== win) other.classList.remove("map-studio-active-window");
        });
        win.classList.add("map-studio-active-window");
    }

    function actionButton(action, text, title) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "map-studio-window-action";
        b.dataset.studioAction = action;
        b.textContent = text;
        b.title = title;
        b.setAttribute("aria-label", title);
        return b;
    }

    function maximize(win, on) {
        win.classList.toggle("is-maximized", on);
        win.classList.remove("is-popout");
        const b = win.querySelector('[data-studio-action="maximize"]');
        if (b) {
            b.textContent = on ? "↙" : "⛶";
            b.title = on ? "Restore window" : "Maximize map";
            b.setAttribute("aria-label", b.title);
        }
        const p = win.querySelector('[data-studio-action="popout"]');
        if (p) {
            p.textContent = "↗";
            p.title = "Pop out map";
            p.setAttribute("aria-label", p.title);
        }
        bringToFront(win);
    }

    function popout(win, on) {
        win.classList.toggle("is-popout", on);
        win.classList.remove("is-maximized");
        const p = win.querySelector('[data-studio-action="popout"]');
        if (p) {
            p.textContent = on ? "↙" : "↗";
            p.title = on ? "Return map to workspace" : "Pop out map";
            p.setAttribute("aria-label", p.title);
        }
        const b = win.querySelector('[data-studio-action="maximize"]');
        if (b) {
            b.textContent = "⛶";
            b.title = "Maximize map";
            b.setAttribute("aria-label", b.title);
        }
        bringToFront(win);
    }

    function enhanceWindow(win) {
        if (!win || win.dataset.fixV2 === "1") {
            if (win) repairAccessibility(win);
            return;
        }
        win.dataset.fixV2 = "1";

        const head = win.querySelector(".map-studio-window-head");
        const close = head?.querySelector(".map-studio-close");
        if (!head || !close) return;

        const actions = document.createElement("div");
        actions.className = "map-studio-window-actions";
        const pop = actionButton("popout", "↗", "Pop out map");
        const max = actionButton("maximize", "⛶", "Maximize map");
        actions.append(pop, max);
        close.parentNode.insertBefore(actions, close);

        pop.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            popout(win, !win.classList.contains("is-popout"));
        });
        max.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            maximize(win, !win.classList.contains("is-maximized"));
        });

        win.addEventListener("pointerdown", () => bringToFront(win), true);
        win.addEventListener("click", () => bringToFront(win), true);
        repairAccessibility(win);
    }

    function installStyle() {
        if (document.getElementById("map-studio-fix-v2-style")) return;
        const style = document.createElement("style");
        style.id = "map-studio-fix-v2-style";
        style.textContent = `
            .map-insight-launcher-final {
                appearance:none!important; display:inline-flex!important; align-items:center!important;
                justify-content:center!important; gap:9px!important; min-width:158px!important; height:42px!important;
                padding:0 16px!important; border:1px solid rgba(255,178,29,.58)!important; border-radius:11px!important;
                background:linear-gradient(135deg,rgba(255,178,29,.18),rgba(255,178,29,.055))!important;
                color:#f7fbff!important; box-shadow:0 8px 24px rgba(0,0,0,.24),inset 0 1px 0 rgba(255,255,255,.06)!important;
                font:800 11px/1 Inter,ui-sans-serif,system-ui,sans-serif!important; letter-spacing:.08em!important;
                cursor:pointer!important; transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease!important;
            }
            .map-insight-launcher-final b{font-size:15px!important;line-height:1!important;color:#ffb21d!important}
            .map-insight-launcher-final:hover{transform:translateY(-1px)!important;border-color:rgba(255,178,29,.95)!important;background:linear-gradient(135deg,rgba(255,178,29,.27),rgba(255,178,29,.09))!important;box-shadow:0 12px 30px rgba(0,0,0,.32),0 0 22px rgba(255,178,29,.08)!important}
            .map-studio-window-actions{display:inline-flex;align-items:center;gap:5px;margin-left:auto}
            .map-studio-window-action{width:27px;height:27px;display:grid;place-items:center;border:1px solid rgba(127,150,184,.22);background:rgba(255,255,255,.035);color:#aebfd6;border-radius:8px;cursor:pointer;font:700 13px/1 Inter,ui-sans-serif,system-ui,sans-serif;transition:.16s ease}
            .map-studio-window-action:hover{border-color:rgba(75,166,255,.60);background:rgba(75,166,255,.10);color:#fff;transform:translateY(-1px)}
            .map-studio-window.map-studio-active-window{box-shadow:0 28px 78px rgba(0,0,0,.58),0 0 0 1px rgba(75,166,255,.10) inset}
            .map-studio-window.is-maximized{left:24px!important;top:84px!important;width:calc(100vw - 48px)!important;height:calc(100vh - 108px)!important;min-height:0!important;z-index:20000!important}
            .map-studio-window.is-maximized .map-studio-body{height:calc(100% - 58px);display:flex;flex-direction:column}
            .map-studio-window.is-maximized .map-studio-svg{height:calc(100% - 36px);min-height:320px;flex:1 1 auto}
            .map-studio-window.is-popout{left:50%!important;top:50%!important;width:min(980px,calc(100vw - 64px))!important;height:min(720px,calc(100vh - 128px))!important;min-height:0!important;transform:translate(-50%,-50%)!important;z-index:20000!important}
            .map-studio-window.is-popout .map-studio-body{height:calc(100% - 58px);display:flex;flex-direction:column}
            .map-studio-window.is-popout .map-studio-svg{height:calc(100% - 36px);min-height:300px;flex:1 1 auto}
            @media(max-width:700px){
                .map-insight-launcher-final{min-width:132px!important;height:38px!important;padding:0 12px!important}
                .map-studio-window.is-maximized,.map-studio-window.is-popout{left:10px!important;top:76px!important;width:calc(100vw - 20px)!important;height:calc(100vh - 88px)!important;transform:none!important}
            }
        `;
        document.head.appendChild(style);
    }

    function patchAll() {
        document.querySelectorAll(".map-studio-window").forEach(enhanceWindow);
    }

    function schedule() {
        if (state.queued) return;
        state.queued = true;
        requestAnimationFrame(() => {
            state.queued = false;
            patchAll();
        });
    }

    function boot() {
        installStyle();
        schedule();
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once:true });
    else boot();
})();
