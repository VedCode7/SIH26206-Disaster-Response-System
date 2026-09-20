(function () {
    "use strict";

    const POLISH_STYLE_ID = "dashboard-simulation-polish-style";

    function escape(value) {
        return typeof escapeHTML === "function"
            ? escapeHTML(String(value ?? ""))
            : String(value ?? "");
    }

    function ensureStyles() {
        if (document.getElementById(POLISH_STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = POLISH_STYLE_ID;
        style.textContent = `
            .simulation-polish-strip {
                margin-top: 14px;
                padding: 12px 14px;
                border: 1px solid rgba(127,150,184,.14);
                border-radius: 11px;
                background: linear-gradient(135deg, rgba(255,255,255,.035), rgba(255,255,255,.015));
            }

            .simulation-polish-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 9px;
            }

            .simulation-polish-title {
                color: #eef5ff;
                font-size: 10px;
                font-weight: 800;
                letter-spacing: .12em;
                text-transform: uppercase;
            }

            .simulation-polish-badge {
                color: #8fa5c0;
                font-size: 9px;
                letter-spacing: .08em;
                text-transform: uppercase;
            }

            .simulation-polish-progress {
                height: 4px;
                overflow: hidden;
                border-radius: 999px;
                background: rgba(127,150,184,.12);
            }

            .simulation-polish-progress > i {
                display: block;
                width: 20%;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, #35d07f, #ffb21d);
                transition: width .35s ease;
            }

            .simulation-polish-stage {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 12px;
                align-items: center;
                margin-top: 9px;
            }

            .simulation-polish-stage strong {
                display: block;
                color: #dce8f7;
                font-size: 11px;
            }

            .simulation-polish-stage span {
                display: block;
                margin-top: 3px;
                color: #71859f;
                font-size: 9px;
                line-height: 1.4;
            }

            .simulation-polish-date {
                color: #35d07f !important;
                font-weight: 800;
                text-align: right;
                white-space: nowrap;
            }

            .simulation-context-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
                margin-top: 10px;
            }

            .simulation-context-card {
                padding: 9px 10px;
                border: 1px solid rgba(127,150,184,.12);
                border-radius: 9px;
                background: rgba(0,0,0,.10);
            }

            .simulation-context-card span {
                display: block;
                color: #71859f;
                font-size: 8px;
                letter-spacing: .1em;
                text-transform: uppercase;
            }

            .simulation-context-card strong {
                display: block;
                margin-top: 4px;
                color: #eef5ff;
                font-size: 11px;
            }

            .simulation-context-note {
                margin-top: 9px;
                color: #71859f;
                font-size: 8.5px;
                line-height: 1.5;
            }

            .simulation-complete-strip {
                border-color: rgba(53,208,127,.24);
                background: linear-gradient(135deg, rgba(53,208,127,.06), rgba(255,255,255,.015));
            }

            .simulation-complete-strip .simulation-polish-title {
                color: #35d07f;
            }

            .simulation-decision-note {
                margin-top: 10px;
                padding: 9px 10px;
                border-left: 2px solid rgba(255,178,29,.65);
                background: rgba(255,178,29,.035);
                color: #8fa5c0;
                font-size: 9px;
                line-height: 1.5;
            }

            .simulation-decision-note strong {
                color: #dce8f7;
            }

            @media (max-width: 700px) {
                .simulation-context-grid {
                    grid-template-columns: 1fr;
                }

                .simulation-polish-stage {
                    grid-template-columns: 1fr;
                }

                .simulation-polish-date {
                    text-align: left;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function getPanel() {
        return document.querySelector(".activity-panel");
    }

    function ensureStrip() {
        const panel = getPanel();
        if (!panel || panel.querySelector(".simulation-polish-strip")) return null;

        const timeline = panel.querySelector(".timeline");
        if (!timeline) return null;

        const strip = document.createElement("div");
        strip.className = "simulation-polish-strip";
        strip.innerHTML = `
            <div class="simulation-polish-head">
                <span class="simulation-polish-title">Replay control</span>
                <span class="simulation-polish-badge" data-simulation-polish-status>READY</span>
            </div>
            <div class="simulation-polish-progress" aria-hidden="true">
                <i data-simulation-polish-progress></i>
            </div>
            <div class="simulation-polish-stage">
                <div>
                    <strong data-simulation-polish-stage>Ready to replay the historical sequence</strong>
                    <span data-simulation-polish-description>
                        The dashboard will progressively update risk, road accessibility, routing and response context.
                    </span>
                </div>
                <span class="simulation-polish-date" data-simulation-polish-date>30 NOV 2015</span>
            </div>
        `;

        timeline.insertAdjacentElement("afterend", strip);
        return strip;
    }

    function ensureContext() {
        const panel = getPanel();
        if (!panel || panel.querySelector(".simulation-context-grid")) return;

        const strip = panel.querySelector(".simulation-polish-strip");
        if (!strip) return;

        const context = document.createElement("div");
        context.className = "simulation-context-grid";
        context.innerHTML = `
            <div class="simulation-context-card">
                <span>Historical anchor</span>
                <strong>294.1 mm / 24h</strong>
            </div>
            <div class="simulation-context-card">
                <span>Reservoir anchor</span>
                <strong>≈29,000 cusecs</strong>
            </div>
        `;

        strip.appendChild(context);

        const note = document.createElement("div");
        note.className = "simulation-context-note";
        note.textContent =
            "Historical rainfall and reservoir anchors drive the replay. Ward-level water, risk and accessibility impacts are model-generated decision-support outputs, not measured 2015 ward observations.";
        strip.appendChild(note);
    }

    function stageDescription(stage) {
        if (!stage) return "The dashboard will progressively update risk, road accessibility, routing and response context.";
        const response = stage.response || {};
        const counts = stage.risk_counts || {};
        const restricted = Number(stage.road_summary?.restricted || 0);
        const blocked = Number(stage.road_summary?.blocked || 0);
        const priority = Number(response.priority_zones?.length || 0);

        return `${Number(counts.critical || 0)} critical · ${Number(counts.high || 0)} high-risk wards · ${restricted} restricted roads · ${blocked} blocked · ${priority} priority wards`;
    }

    function updateProgress() {
        const panel = getPanel();
        if (!panel) return;

        const state = panel.querySelector(".simulation-state");
        const status = panel.querySelector("[data-simulation-polish-status]");
        const progress = panel.querySelector("[data-simulation-polish-progress]");
        const stage = panel.querySelector("[data-simulation-polish-stage]");
        const description = panel.querySelector("[data-simulation-polish-description]");
        const date = panel.querySelector("[data-simulation-polish-date]");

        if (!state || !status || !progress || !stage || !description || !date) return;

        const text = String(state.textContent || "READY").trim().toUpperCase();
        const match = text.match(/^STEP\s+(\d+)\s*\/\s*(\d+)$/);

        if (match) {
            const current = Number(match[1]);
            const total = Number(match[2]);
            const pct = Math.max(5, Math.min(100, (current / Math.max(total, 1)) * 100));
            progress.style.width = `${pct}%`;
            status.textContent = `STEP ${current} / ${total}`;

            const timelineItem = panel.querySelectorAll(".timeline-item")[current - 1];
            const title = timelineItem?.querySelector("strong")?.textContent || `Replay stage ${current}`;
            const parts = title.split(" · ");
            stage.textContent = parts.slice(1).join(" · ") || title;
            date.textContent = parts[0] || "HISTORICAL STAGE";
            description.textContent = "The system is propagating this historical stage through risk, roads and response logic.";
            return;
        }

        if (text === "LOADING") {
            progress.style.width = "8%";
            status.textContent = "LOADING";
            stage.textContent = "Preparing the historical replay";
            description.textContent = "Loading the deterministic Chennai 2015 scenario and current geography.";
            date.textContent = "SCENARIO";
            return;
        }

        if (text === "COMPLETE") {
            progress.style.width = "100%";
            status.textContent = "COMPLETE";
            stage.textContent = "Historical replay complete";
            description.textContent = "Final conditions are now reflected across the dashboard. Open the response plan for the system's final operational view.";
            date.textContent = "04 DEC 2015";
            panel.querySelector(".simulation-polish-strip")?.classList.add("simulation-complete-strip");
            return;
        }

        if (text === "ERROR") {
            progress.style.width = "0%";
            status.textContent = "ERROR";
            stage.textContent = "Replay interrupted";
            description.textContent = "The historical replay could not complete. Check the backend connection and retry.";
            date.textContent = "RETRY";
            return;
        }

        progress.style.width = "20%";
        status.textContent = "READY";
        stage.textContent = "Ready to replay the historical sequence";
        description.textContent = "The dashboard will progressively update risk, road accessibility, routing and response context.";
        date.textContent = "30 NOV 2015";
    }

    function enhanceResponseButton() {
        const button = document.querySelector(".secondary-button");
        if (!button) return;

        const complete = String(document.querySelector(".simulation-state")?.textContent || "")
            .trim()
            .toUpperCase() === "COMPLETE";

        button.textContent = complete
            ? "Open Final Response Plan"
            : "Generate Response Plan";
    }

    function addDecisionNote() {
        const panel = document.querySelector(".resources-panel");
        if (!panel || panel.querySelector(".simulation-decision-note")) return;

        const body = panel.querySelector(".dashboard-facility-loading");
        if (!body) return;

        const note = document.createElement("div");
        note.className = "simulation-decision-note";
        note.innerHTML =
            "<strong>Decision layer:</strong> the response plan combines current ward risk with resource availability and route traversability. During historical replay, these inputs evolve stage by stage.";
        body.insertAdjacentElement("afterend", note);
    }

    function observe() {
        const main = document.querySelector(".main-content");
        if (!main) return;

        const refresh = () => {
            ensureStrip();
            ensureContext();
            addDecisionNote();
            updateProgress();
            enhanceResponseButton();
        };

        refresh();

        const observer = new MutationObserver(refresh);
        observer.observe(main, { childList: true, subtree: true, characterData: true });
    }

    function boot() {
        ensureStyles();
        observe();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();
