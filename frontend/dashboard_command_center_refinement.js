/*
 * Command-centre refinement controller.
 *
 * Presentation-only. Derives telemetry from existing dashboard DOM state and
 * does not introduce a second data source or alter application behaviour.
 */
(function () {
    "use strict";

    const SELECTORS = {
        activity: ".activity-panel",
        incident: ".incident-panel",
        incidentRisk: ".incident-panel .incident-risk",
        incidentBadge: ".incident-panel .risk-badge",
        totalZones: ".stats-grid .stat-card:nth-child(1) .stat-value",
        networkStatus: ".stats-grid .stat-card:nth-child(4) .stat-value",
        replayState: ".activity-panel .simulation-state",
        currentStage: ".activity-panel .timeline-item.current strong",
    };

    function getText(selector, fallback = "—") {
        const element = document.querySelector(selector);
        const value = element?.textContent?.trim();
        return value || fallback;
    }

    function parseRisk() {
        const raw = getText(SELECTORS.incidentRisk, "0");
        const match = raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
        return match ? Math.max(0, Math.min(100, Number(match[0]))) : 0;
    }

    function riskColor(level) {
        switch (level) {
            case "critical": return "#ff4d5a";
            case "high": return "#ff7448";
            case "watch": return "#ffb020";
            default: return "#35d07f";
        }
    }

    function updateIncidentInstrument() {
        const incident = document.querySelector(SELECTORS.incident);
        if (!incident) return;

        const score = parseRisk();
        const level = getText(SELECTORS.incidentBadge, "NORMAL").toLowerCase();
        incident.style.setProperty("--cc-risk-pct", `${score}%`);
        incident.style.setProperty("--cc-risk-color", riskColor(level));
    }

    function ensureTelemetry() {
        const panel = document.querySelector(SELECTORS.activity);
        if (!panel) return null;

        let telemetry = panel.querySelector(".cc-replay-telemetry");
        if (telemetry) return telemetry;

        telemetry = document.createElement("div");
        telemetry.className = "cc-replay-telemetry";
        telemetry.innerHTML = `
            <div class="cc-replay-telemetry-main">
                <span class="cc-replay-telemetry-label">SCENARIO CHANNEL</span>
                <strong class="cc-replay-telemetry-value" data-cc-field="stage">READY FOR REPLAY</strong>
                <span class="cc-replay-telemetry-sub" data-cc-field="state-sub">Historical decision-support reconstruction</span>
            </div>
            <div class="cc-replay-telemetry-cell">
                <span class="cc-replay-telemetry-label">ACTIVE RISK</span>
                <strong class="cc-replay-telemetry-value" data-cc-field="risk">—</strong>
                <span class="cc-replay-telemetry-sub">Current highest-risk score</span>
            </div>
            <div class="cc-replay-telemetry-cell">
                <span class="cc-replay-telemetry-label">MONITORED ZONES</span>
                <strong class="cc-replay-telemetry-value" data-cc-field="zones">—</strong>
                <span class="cc-replay-telemetry-sub">Live Chennai ward network</span>
            </div>
            <div class="cc-replay-telemetry-cell">
                <span class="cc-replay-telemetry-label">NETWORK</span>
                <strong class="cc-replay-telemetry-value" data-cc-field="network">—</strong>
                <span class="cc-replay-telemetry-sub">Routing system state</span>
            </div>
        `;

        const consoleBar = panel.querySelector(".cc-replay-console");
        if (consoleBar) {
            consoleBar.insertAdjacentElement("beforebegin", telemetry);
        } else {
            panel.appendChild(telemetry);
        }

        return telemetry;
    }

    function setField(root, name, value) {
        const element = root.querySelector(`[data-cc-field="${name}"]`);
        if (element && element.textContent !== value) {
            element.textContent = value;
        }
    }

    function updateTelemetry() {
        const telemetry = ensureTelemetry();
        if (!telemetry) return;

        const risk = parseRisk();
        const riskLevel = getText(SELECTORS.incidentBadge, "NORMAL").toUpperCase();
        const stage = getText(SELECTORS.currentStage, "READY FOR REPLAY");
        const replayState = getText(SELECTORS.replayState, "READY").toUpperCase();
        const zones = getText(SELECTORS.totalZones, "—");
        const network = getText(SELECTORS.networkStatus, "—").toUpperCase();

        setField(telemetry, "stage", stage);
        setField(telemetry, "state-sub", `${replayState} // HISTORICAL DECISION-SUPPORT RECONSTRUCTION`);
        setField(telemetry, "risk", `${risk.toFixed(1)} / 100 · ${riskLevel}`);
        setField(telemetry, "zones", zones);
        setField(telemetry, "network", network);

        updateIncidentInstrument();
    }

    function boot() {
        updateTelemetry();

        let scheduled = false;
        const scheduleRefresh = () => {
            if (scheduled) return;
            scheduled = true;
            window.requestAnimationFrame(() => {
                scheduled = false;
                updateTelemetry();
            });
        };

        const observed = [
            document.querySelector(SELECTORS.activity),
            document.querySelector(SELECTORS.incident),
            document.querySelector(".stats-grid"),
        ].filter(Boolean);

        if (!observed.length) return;

        const observer = new MutationObserver(scheduleRefresh);
        observed.forEach((element) => {
            observer.observe(element, {
                childList: true,
                characterData: true,
                subtree: true,
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();
