/*
 * Dashboard command-centre presentation controller.
 *
 * Presentation-only. Reads existing DOM state and adds visual telemetry/HUD
 * affordances; it does not change API payloads, risk calculations, routing,
 * simulation state, or facility semantics.
 */
(function () {
    "use strict";

    const SELECTORS = {
        map: ".map-area",
        incidentId: ".incident-id",
        riskBadge: ".risk-badge",
        riskScore: ".incident-risk",
        timeline: ".activity-panel .timeline",
        facilityPanel: ".resources-panel",
        totalZones: ".stat-card:nth-child(1) .stat-value",
    };

    function text(selector, fallback = "—") {
        const element = document.querySelector(selector);
        const value = element?.textContent?.trim();
        return value || fallback;
    }

    function setTextIfChanged(element, value) {
        if (element && element.textContent !== value) {
            element.textContent = value;
        }
    }

    function setClassState(element, classes) {
        if (!element) return;
        const next = classes.join(" ");
        if (element.dataset.ccClassState === next) return;
        element.classList.remove("on", "warn", "alert");
        classes.forEach((className) => element.classList.add(className));
        element.dataset.ccClassState = next;
    }

    function createMapHUD() {
        const map = document.querySelector(SELECTORS.map);
        if (!map || map.querySelector(".cc-map-overlay")) return;

        const overlay = document.createElement("div");
        overlay.className = "cc-map-overlay";
        overlay.setAttribute("aria-hidden", "true");
        overlay.innerHTML = `
            <div class="cc-map-scanline"></div>
            <div class="cc-map-corner cc-map-corner-tl">
                GEOSPATIAL TELEMETRY
                <br><span>WARD NETWORK // LIVE</span>
            </div>
            <div class="cc-map-corner cc-map-corner-tr">
                NETWORK <strong>ONLINE</strong>
                <br><span class="cc-map-clock">--:--:--</span>
            </div>
            <div class="cc-map-focus">
                <div class="cc-map-focus-ping"></div>
            </div>
            <div class="cc-map-readout">
                <span class="cc-map-readout-label">ACTIVE FOCUS</span>
                <strong class="cc-map-readout-zone">—</strong>
                <span class="cc-map-readout-state">SYNCING RISK STATE</span>
            </div>
            <div class="cc-map-signal">
                <div class="cc-map-signal-head">
                    <span>RISK SIGNAL</span>
                    <span class="cc-map-signal-state">STABLE</span>
                </div>
                <div class="cc-map-signal-bars">
                    ${Array.from({ length: 12 }, () => "<i></i>").join("")}
                </div>
            </div>
        `;

        map.appendChild(overlay);
    }

    function updateClock() {
        const clock = document.querySelector(".cc-map-clock");
        if (!clock) return;
        const value = new Intl.DateTimeFormat("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        }).format(new Date());
        setTextIfChanged(clock, value);
    }

    function updateMapHUD() {
        const zone = text(SELECTORS.incidentId);
        const badge = text(SELECTORS.riskBadge, "SYNCING").toUpperCase();
        const score = Number.parseFloat(text(SELECTORS.riskScore, "0"));
        const total = Number.parseInt(text(SELECTORS.totalZones, "0").replaceAll(",", ""), 10) || 0;

        const zoneElement = document.querySelector(".cc-map-readout-zone");
        const stateElement = document.querySelector(".cc-map-readout-state");
        const signalState = document.querySelector(".cc-map-signal-state");
        const bars = document.querySelectorAll(".cc-map-signal-bars i");

        setTextIfChanged(zoneElement, zone);
        setTextIfChanged(
            stateElement,
            `${badge} // ${Number.isFinite(score) ? score.toFixed(1) : "—"} / 100`
        );

        const level = badge.toLowerCase();
        const signal = level === "critical"
            ? "CRITICAL"
            : level === "high"
                ? "ELEVATED"
                : level === "watch"
                    ? "WATCH"
                    : "STABLE";
        setTextIfChanged(signalState, signal);

        const activeBars = level === "critical"
            ? 12
            : level === "high"
                ? 9
                : level === "watch"
                    ? 6
                    : Math.max(3, Math.min(4, Math.round((Number.isFinite(score) ? score : 10) / 10)));

        bars.forEach((bar, index) => {
            if (index < activeBars) {
                setClassState(bar, [level === "critical" ? "alert" : level === "high" || level === "watch" ? "warn" : "on"]);
            } else {
                setClassState(bar, []);
            }
        });

        const overlay = document.querySelector(".cc-map-overlay");
        if (overlay) {
            const stateKey = `${zone}|${level}|${total}`;
            if (overlay.dataset.stateKey !== stateKey) {
                overlay.dataset.stateKey = stateKey;
                overlay.dataset.zone = zone;
                overlay.dataset.level = level;
                overlay.dataset.totalZones = String(total);
            }
        }
    }

    function decorateReplayPanel() {
        const panel = document.querySelector(".activity-panel");
        const timeline = panel?.querySelector(SELECTORS.timeline);
        if (!panel || !timeline || panel.querySelector(".cc-replay-console")) return;

        const consoleBar = document.createElement("div");
        consoleBar.className = "cc-replay-console";
        consoleBar.innerHTML = `
            <span class="cc-replay-console-label">SIMULATION ENGINE // HISTORICAL SCENARIO</span>
            <span class="cc-replay-console-state">READY</span>
        `;
        panel.appendChild(consoleBar);
    }

    function updateReplayConsole() {
        const state = document.querySelector(".simulation-state")?.textContent?.trim() || "READY";
        const target = document.querySelector(".cc-replay-console-state");
        setTextIfChanged(target, state);
    }

    function decorateFacilityPanel() {
        const panel = document.querySelector(SELECTORS.facilityPanel);
        if (!panel || panel.dataset.commandConsole === "true") return;
        panel.dataset.commandConsole = "true";
    }

    function observeState() {
        const watched = [
            document.querySelector(".incident-panel"),
            document.querySelector(".activity-panel"),
            document.querySelector(".resources-panel"),
        ].filter(Boolean);

        if (!watched.length) return;

        let scheduled = false;
        const refresh = () => {
            scheduled = false;
            createMapHUD();
            decorateReplayPanel();
            decorateFacilityPanel();
            updateMapHUD();
            updateReplayConsole();
        };

        const observer = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            window.requestAnimationFrame(refresh);
        });

        watched.forEach((element) => {
            observer.observe(element, {
                childList: true,
                characterData: true,
                subtree: true,
            });
        });

        refresh();
    }

    function init() {
        createMapHUD();
        decorateReplayPanel();
        decorateFacilityPanel();
        updateMapHUD();
        updateReplayConsole();
        updateClock();
        window.setInterval(updateClock, 1000);
        window.setInterval(updateMapHUD, 1200);
        observeState();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
