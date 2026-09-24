/*
 * Simulation command console
 *
 * Turns the historical replay panel into a live decision-support console.
 * This layer is presentation-only: the existing replay engine remains the
 * source of truth and continues to call /simulation/chennai-2015/response.
 */
(function () {
    "use strict";

    const CONSOLE_ID = "simulation-command-console";
    const STYLE_ID = "simulation-command-console-style";

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .simulation-command-console {
                position: relative;
                margin: 0 18px 18px;
                padding: 16px;
                border: 1px solid rgba(62, 116, 161, .34);
                border-radius: 10px;
                background:
                    radial-gradient(circle at 92% 12%, rgba(28, 112, 160, .12), transparent 30%),
                    radial-gradient(circle at 8% 92%, rgba(24, 180, 122, .07), transparent 28%),
                    rgba(4, 11, 19, .76);
                box-shadow: inset 0 1px rgba(255,255,255,.025), 0 12px 30px rgba(0,0,0,.16);
                overflow: hidden;
            }
            .simulation-command-console::before {
                content: "";
                position: absolute;
                inset: 0;
                pointer-events: none;
                background-image: linear-gradient(rgba(94,142,180,.035) 1px, transparent 1px),
                                  linear-gradient(90deg, rgba(94,142,180,.035) 1px, transparent 1px);
                background-size: 24px 24px;
                mask-image: linear-gradient(to bottom, black, transparent 92%);
            }
            .simulation-console-head,
            .simulation-console-grid,
            .simulation-console-progress { position: relative; z-index: 1; }
            .simulation-console-head {
                display:flex;
                justify-content:space-between;
                align-items:flex-start;
                gap:16px;
                padding-bottom:13px;
                border-bottom:1px solid rgba(127,150,184,.13);
            }
            .simulation-console-kicker {
                margin:0 0 5px;
                color:#5d88aa;
                font-size:8px;
                font-weight:700;
                letter-spacing:.18em;
                text-transform:uppercase;
            }
            .simulation-console-title {
                margin:0;
                color:#eaf3fb;
                font-size:15px;
                font-weight:700;
                letter-spacing:.01em;
            }
            .simulation-console-state {
                display:inline-flex;
                align-items:center;
                gap:7px;
                padding:6px 9px;
                border:1px solid rgba(34, 213, 143, .22);
                border-radius:999px;
                color:#36e39b;
                background:rgba(24, 184, 119, .055);
                font-size:8px;
                font-weight:800;
                letter-spacing:.12em;
                white-space:nowrap;
            }
            .simulation-console-state::before {
                content:"";
                width:5px;
                height:5px;
                border-radius:50%;
                background:currentColor;
                box-shadow:0 0 9px currentColor;
            }
            .simulation-console-state.busy { color:#ffb21d; border-color:rgba(255,178,29,.25); background:rgba(255,178,29,.055); }
            .simulation-console-state.error { color:#ff5b68; border-color:rgba(255,91,104,.25); background:rgba(255,91,104,.055); }
            .simulation-console-grid {
                display:grid;
                grid-template-columns:1.35fr repeat(3, 1fr);
                gap:9px;
                margin-top:12px;
            }
            .simulation-console-cell {
                min-width:0;
                padding:11px;
                border:1px solid rgba(127,150,184,.12);
                border-radius:7px;
                background:rgba(255,255,255,.018);
            }
            .simulation-console-cell span {
                display:block;
                color:#627b96;
                font-size:7px;
                font-weight:700;
                letter-spacing:.14em;
                text-transform:uppercase;
            }
            .simulation-console-cell strong {
                display:block;
                margin-top:5px;
                color:#e9f3fc;
                font-size:12px;
                line-height:1.25;
                overflow:hidden;
                text-overflow:ellipsis;
                white-space:nowrap;
            }
            .simulation-console-cell strong.accent { color:#38e29a; }
            .simulation-console-progress {
                display:flex;
                align-items:center;
                gap:10px;
                margin-top:12px;
                padding-top:11px;
                border-top:1px solid rgba(127,150,184,.09);
            }
            .simulation-console-progress-track {
                flex:1;
                height:3px;
                overflow:hidden;
                border-radius:999px;
                background:#172432;
            }
            .simulation-console-progress-fill {
                width:0%;
                height:100%;
                border-radius:inherit;
                background:linear-gradient(90deg,#22d78e,#53d8ff);
                box-shadow:0 0 10px rgba(53,220,157,.35);
                transition:width .35s ease;
            }
            .simulation-console-step {
                min-width:52px;
                color:#7088a1;
                font-size:8px;
                font-weight:800;
                letter-spacing:.1em;
                text-align:right;
            }
            @media (max-width:900px) {
                .simulation-console-grid { grid-template-columns:repeat(2, 1fr); }
            }
            @media (max-width:560px) {
                .simulation-console-head { flex-direction:column; }
                .simulation-console-grid { grid-template-columns:1fr; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureConsole(panel) {
        let consoleEl = document.getElementById(CONSOLE_ID);
        if (consoleEl && consoleEl.parentElement === panel) return consoleEl;

        consoleEl = document.createElement("div");
        consoleEl.id = CONSOLE_ID;
        consoleEl.className = "simulation-command-console";
        consoleEl.innerHTML = `
            <div class="simulation-console-head">
                <div>
                    <p class="simulation-console-kicker">SIMULATION ENGINE // HISTORICAL SCENARIO</p>
                    <h4 class="simulation-console-title">Decision-support reconstruction channel</h4>
                </div>
                <span class="simulation-console-state" data-console-state>READY</span>
            </div>
            <div class="simulation-console-grid">
                <div class="simulation-console-cell">
                    <span>Current stage</span>
                    <strong data-console-stage>30 NOV · SECOND RAINFALL SPELL</strong>
                </div>
                <div class="simulation-console-cell">
                    <span>Active risk</span>
                    <strong data-console-risk>10.0 / 100</strong>
                </div>
                <div class="simulation-console-cell">
                    <span>Monitored zones</span>
                    <strong data-console-zones>200</strong>
                </div>
                <div class="simulation-console-cell">
                    <span>Network</span>
                    <strong data-console-network class="accent">READY</strong>
                </div>
            </div>
            <div class="simulation-console-progress">
                <div class="simulation-console-progress-track">
                    <div class="simulation-console-progress-fill" data-console-progress></div>
                </div>
                <span class="simulation-console-step" data-console-step>READY</span>
            </div>
        `;

        const timeline = panel.querySelector(".timeline");
        if (timeline) timeline.insertAdjacentElement("afterend", consoleEl);
        else panel.appendChild(consoleEl);

        return consoleEl;
    }

    function readText(selector, fallback = "—") {
        const node = document.querySelector(selector);
        const text = node?.textContent?.replace(/\s+/g, " ").trim();
        return text || fallback;
    }

    function syncConsole() {
        const panel = document.querySelector(".activity-panel");
        if (!panel) return;

        const consoleEl = ensureConsole(panel);
        const stateEl = consoleEl.querySelector("[data-console-state]");
        const stageEl = consoleEl.querySelector("[data-console-stage]");
        const riskEl = consoleEl.querySelector("[data-console-risk]");
        const zonesEl = consoleEl.querySelector("[data-console-zones]");
        const networkEl = consoleEl.querySelector("[data-console-network]");
        const progressEl = consoleEl.querySelector("[data-console-progress]");
        const stepEl = consoleEl.querySelector("[data-console-step]");

        const state = readText(".simulation-state", "READY").toUpperCase();
        const activeTimeline = panel.querySelector(".timeline-item.current")
            || panel.querySelector(".timeline-item.active:last-of-type")
            || panel.querySelector(".timeline-item.active");
        const stage = activeTimeline?.querySelector("strong")?.textContent?.replace(/\s+/g, " ").trim();
        const risk = readText(".incident-risk", "—").replace(/\s+/g, " ");
        const zones = readText(".stats-grid .stat-card:first-child .stat-value", "—");
        const network = readText(".stats-grid .stat-card:last-child .stat-value", "READY");

        if (stage) stageEl.textContent = stage.toUpperCase();
        riskEl.textContent = risk;
        zonesEl.textContent = zones;
        networkEl.textContent = network.toUpperCase();

        stateEl.textContent = state;
        stateEl.classList.toggle("busy", state === "LOADING" || state.startsWith("STEP"));
        stateEl.classList.toggle("error", state === "ERROR");

        const stepMatch = state.match(/STEP\s+(\d+)\s*\/\s*(\d+)/);
        const progress = stepMatch
            ? (Number(stepMatch[1]) / Number(stepMatch[2])) * 100
            : state === "COMPLETE" ? 100 : 0;

        progressEl.style.width = `${Math.max(0, Math.min(100, progress))}%`;
        stepEl.textContent = stepMatch ? `${stepMatch[1]} / ${stepMatch[2]}` : state;
        networkEl.classList.toggle("accent", /READY|ONLINE|OPERATIONAL/.test(network.toUpperCase()));
    }

    function boot() {
        injectStyles();
        syncConsole();

        const observer = new MutationObserver(syncConsole);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        window.addEventListener("resize", syncConsole, { passive: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }
})();
