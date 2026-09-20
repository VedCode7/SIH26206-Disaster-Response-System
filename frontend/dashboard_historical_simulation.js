(function () {
    "use strict";

    const ENDPOINT = "/simulation/chennai-2015/response";
    let replayResult = null;
    let running = false;

    const STAGE_FALLBACK = [
        ["30 NOV", "Second Rainfall Spell"],
        ["1 DEC", "Reservoir Release"],
        ["2 DEC", "Peak Inundation"],
        ["3 DEC", "Persistent Flooding"],
        ["4 DEC", "Early Recession"],
    ];

    function fetchSimulation() {
        if (typeof dashboardRuntimeFetch === "function") {
            return dashboardRuntimeFetch(ENDPOINT, { method: "POST" });
        }
        return fetchJSON(ENDPOINT, { method: "POST" });
    }

    function escape(value) {
        return typeof escapeHTML === "function"
            ? escapeHTML(String(value ?? ""))
            : String(value ?? "");
    }

    function ensureStyles() {
        if (document.getElementById("historical-simulation-style")) return;

        const style = document.createElement("style");
        style.id = "historical-simulation-style";
        style.textContent = `
            .historical-replay-meta {
                display:grid;
                grid-template-columns:repeat(3,minmax(0,1fr));
                gap:10px;
                margin-top:16px;
            }
            .historical-replay-metric {
                padding:11px 12px;
                border:1px solid rgba(127,150,184,.16);
                border-radius:9px;
                background:rgba(255,255,255,.025);
            }
            .historical-replay-metric span {
                display:block;
                color:#71859f;
                font-size:9px;
                letter-spacing:.12em;
                text-transform:uppercase;
            }
            .historical-replay-metric strong {
                display:block;
                margin-top:5px;
                color:#eef5ff;
                font-size:13px;
            }
            .historical-replay-note {
                margin-top:14px;
                padding:11px 12px;
                border-left:2px solid rgba(255,178,29,.65);
                color:#8fa5c0;
                background:rgba(255,178,29,.035);
                font-size:10px;
                line-height:1.55;
            }
            .historical-response-grid {
                display:grid;
                grid-template-columns:repeat(2,minmax(0,1fr));
                gap:10px;
            }
            .historical-response-card {
                padding:12px;
                border:1px solid rgba(127,150,184,.16);
                border-radius:10px;
                background:rgba(255,255,255,.025);
            }
            .historical-response-card .data-label {
                display:block;
                margin-bottom:6px;
            }
            .historical-response-card strong {
                color:#f2f7ff;
                font-size:14px;
            }
            @media (max-width:700px) {
                .historical-replay-meta,
                .historical-response-grid {
                    grid-template-columns:1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function rewriteSimulationPanel() {
        const panel = document.querySelector(".activity-panel");
        if (!panel) return;

        const simulationButton = document.querySelector(".primary-button");
        if (simulationButton) {
            simulationButton.textContent = "Replay 2015 Chennai Floods";
        }

        const kicker = panel.querySelector(".panel-kicker");
        const title = panel.querySelector(".panel-header h3");
        const state = panel.querySelector(".simulation-state");

        if (kicker) kicker.textContent = "HISTORICAL REPLAY";
        if (title) title.textContent = "Chennai Floods — December 2015";
        if (state && !running) state.textContent = "READY";

        const timeline = panel.querySelector(".timeline");
        if (!timeline) return;

        timeline.innerHTML = STAGE_FALLBACK.map(
            ([date, titleText], index) => `
                <div class="timeline-item${index === 0 ? " active" : ""}">
                    <div class="timeline-dot"></div>
                    <div>
                        <strong>${date} · ${titleText}</strong>
                        <span>Historical replay stage</span>
                    </div>
                </div>
            `
        ).join("");
    }

    function setReplayState(text) {
        const state = document.querySelector(".simulation-state");
        if (state) state.textContent = text;
    }

    function updateTimeline(index, stages) {
        document.querySelectorAll(".timeline-item").forEach((item, itemIndex) => {
            const stage = stages[itemIndex];
            item.classList.remove("active", "current");

            if (stage) {
                const title = item.querySelector("strong");
                const description = item.querySelector("span");

                if (title) {
                    title.textContent = `${stage.date} · ${stage.title}`;
                }

                if (description) {
                    const counts = stage.risk_counts || {};
                    description.textContent =
                        `${String(stage.highest_risk?.risk_level || "normal").toUpperCase()} · ` +
                        `${Number(stage.highest_risk?.risk_score || 0).toFixed(1)} / 100 · ` +
                        `${Number(counts.critical || 0)} critical`;
                }
            }

            if (itemIndex < index) item.classList.add("active");
            if (itemIndex === index) item.classList.add("active", "current");
        });
    }

    function updateRoadState(changes) {
        if (!Array.isArray(DASHBOARD_RUNTIME.roads)) return;

        const byId = new Map(changes.map((change) => [change.road_id, change]));

        DASHBOARD_RUNTIME.roads = DASHBOARD_RUNTIME.roads.map((road) => {
            const change = byId.get(road.id);
            if (!change) return road;

            return {
                ...road,
                accessibility_percent: change.accessibility_percent,
                blocked: change.blocked,
            };
        });
    }

    function applyStage(stage, index, stages) {
        const assessments = stage.assessments || [];

        if (typeof DASHBOARD_RUNTIME !== "undefined") {
            DASHBOARD_RUNTIME.assessments = new Map(
                assessments.map((assessment) => [
                    assessment.zone_id,
                    assessment,
                ])
            );

            updateRoadState(stage.road_changes || []);

            if (typeof dashboardRenderOverview === "function") {
                dashboardRenderOverview({
                    total_zones: assessments.length,
                    critical_count: stage.risk_counts?.critical || 0,
                    assessments,
                });
            }

            if (typeof dashboardRenderMap === "function") {
                dashboardRenderMap();
            }

            if (stage.highest_risk && typeof dashboardUpdateIncident === "function") {
                dashboardUpdateIncident(stage.highest_risk);
            }

            const mapStatus = document.querySelector(".map-status");
            if (mapStatus) {
                mapStatus.textContent =
                    `● HISTORICAL REPLAY · ${stage.date.toUpperCase()}`;
            }
        }

        updateTimeline(index, stages);
        setReplayState(`STEP ${index + 1} / ${stages.length}`);
    }

    function renderStageModal(stage) {
        const response = stage.response || {};
        const counts = stage.risk_counts || {};
        const highest = stage.highest_risk || {};
        const allocationCount = response.allocations?.length || 0;
        const deploymentCount = response.deployments?.length || 0;

        const html = `
            <div class="result-hero">
                <div>
                    <div class="result-label">
                        HISTORICAL REPLAY · ${escape(stage.date)}
                    </div>
                    <div class="result-risk">
                        ${escape(Number(highest.risk_score || 0).toFixed(2))}
                        <span>/ 100</span>
                    </div>
                </div>
                <div class="result-level">
                    ${escape(String(highest.risk_level || "normal").toUpperCase())}
                </div>
            </div>

            <div class="historical-replay-meta">
                <div class="historical-replay-metric">
                    <span>24h observed rainfall</span>
                    <strong>
                        ${stage.observed_rainfall_24h_mm == null
                            ? "—"
                            : `${Number(stage.observed_rainfall_24h_mm).toFixed(1)} mm`}
                    </strong>
                </div>
                <div class="historical-replay-metric">
                    <span>Model peak intensity</span>
                    <strong>${escape(Number(stage.model_rainfall_mm_per_hr).toFixed(0))} mm/hr</strong>
                </div>
                <div class="historical-replay-metric">
                    <span>Chembarambakkam release</span>
                    <strong>${escape(Number(stage.reservoir_release_cusecs).toLocaleString())} cusecs</strong>
                </div>
            </div>

            <div class="historical-response-grid" style="margin-top:12px">
                <div class="historical-response-card">
                    <span class="data-label">CRITICAL WARDS</span>
                    <strong>${escape(counts.critical || 0)}</strong>
                </div>
                <div class="historical-response-card">
                    <span class="data-label">HIGH-RISK WARDS</span>
                    <strong>${escape(counts.high || 0)}</strong>
                </div>
                <div class="historical-response-card">
                    <span class="data-label">RESTRICTED ROADS</span>
                    <strong>${escape(stage.road_summary?.restricted || 0)}</strong>
                </div>
                <div class="historical-response-card">
                    <span class="data-label">BLOCKED ROADS</span>
                    <strong>${escape(stage.road_summary?.blocked || 0)}</strong>
                </div>
            </div>

            <div class="result-section">
                <div class="result-label">SYSTEM RESPONSE</div>
                <div class="result-item">${escape(stage.narrative)}</div>
            </div>

            <div class="result-section">
                <div class="result-label">
                    PRIORITY ZONES · ${escape(response.priority_zones?.length || 0)}
                </div>
                <div class="result-list">
                    ${(response.priority_zones || []).slice(0, 8).map((zone) => `
                        <div class="result-item">
                            <strong>${escape(zone.zone_id)}</strong>
                            <span>
                                ${escape(String(zone.risk_level).toUpperCase())}
                                · ${escape(Number(zone.risk_score).toFixed(1))}/100
                            </span>
                        </div>
                    `).join("") || `<div class="result-empty">No high-priority zones at this stage.</div>`}
                </div>
            </div>

            <div class="result-section">
                <div class="result-label">
                    RESOURCE ACTION · ${escape(allocationCount)} allocations · ${escape(deploymentCount)} deployments
                </div>
                <div class="result-list">
                    ${(response.deployments || []).map((deployment) => {
                        const allocation = deployment.allocation || {};
                        const route = deployment.route || {};
                        return `
                            <div class="deployment-result">
                                <div class="deployment-result-top">
                                    <strong>${escape(allocation.resource_type || "resource")}</strong>
                                    <span>P${escape(allocation.priority ?? "—")}</span>
                                </div>
                                <div class="deployment-result-route">
                                    <strong>${escape(allocation.source_zone_id || route.origin_zone_id || "source")}</strong>
                                    <span>→</span>
                                    <strong>${escape(allocation.destination_zone_id || route.destination_zone_id || "target")}</strong>
                                </div>
                                <div class="deployment-result-meta">
                                    <span>QUANTITY<strong>${escape(allocation.quantity ?? 0)}</strong></span>
                                    <span>TIME<strong>${escape(route.total_travel_time_min ?? "—")} min</strong></span>
                                </div>
                            </div>
                        `;
                    }).join("") || `<div class="result-empty">No deployment route available.</div>`}
                </div>
            </div>

            ${(response.unserved_demands || []).length
                ? `
                    <div class="result-section">
                        <div class="result-label">UNSERVED DEMANDS</div>
                        <div class="result-list">
                            ${response.unserved_demands.map((demand) => `
                                <div class="result-item">
                                    <strong>${escape(demand.zone_id)}</strong>
                                    <span>
                                        ${escape(demand.resource_type)}
                                        × ${escape(demand.quantity)}
                                        · ${escape(demand.reason)}
                                    </span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `
                : ""
            }

            <div class="historical-replay-note">
                This is a historical reconstruction, not a ward-by-ward replay of
                observed 2015 flood depths. Historical rainfall and reservoir
                anchors are combined with the dashboard's current Chennai ward
                geometry and routing network to drive a deterministic decision-support
                simulation.
            </div>
        `;

        if (typeof showModal === "function") {
            showModal(`Chennai Floods — ${stage.date}`, html);
        }
    }

    function renderFinalResult(stages) {
        const finalStage = stages[stages.length - 1];
        if (!finalStage) return;

        const response = finalStage.response || {};
        const priority = response.priority_zones || [];
        const deployments = response.deployments || [];

        const html = `
            <div class="result-hero">
                <div>
                    <div class="result-label">FLAGSHIP SIMULATION COMPLETE</div>
                    <div class="result-risk">
                        ${escape(Number(finalStage.highest_risk?.risk_score || 0).toFixed(2))}
                        <span>/ 100</span>
                    </div>
                </div>
                <div class="result-level">
                    ${escape(String(finalStage.highest_risk?.risk_level || "normal").toUpperCase())}
                </div>
            </div>

            <div class="result-section">
                <div class="result-label">FINAL SYSTEM RESPONSE</div>
                <div class="result-list">
                    <div class="result-item"><strong>${escape(priority.length)}</strong><span>priority wards</span></div>
                    <div class="result-item"><strong>${escape(response.allocations?.length || 0)}</strong><span>resource allocations</span></div>
                    <div class="result-item"><strong>${escape(deployments.length)}</strong><span>routable deployments</span></div>
                    <div class="result-item"><strong>${escape(response.unserved_demands?.length || 0)}</strong><span>unserved demands</span></div>
                </div>
            </div>

            <div class="result-section">
                <div class="result-label">WHAT THE SYSTEM DID</div>
                <div class="result-list">
                    ${(response.actions || []).slice(0, 10).map((action) => `
                        <div class="result-item">
                            <strong>${escape(action.action_type || "action")}</strong>
                            <span>${escape(action.description || "")}</span>
                        </div>
                    `).join("")}
                </div>
            </div>

            <div class="historical-replay-note">
                Historical anchors: Chennai recorded 294.1 mm in 24 hours on
                2 December 2015, while the Central Water Commission documented
                approximately 29,000 cusecs released from Chembarambakkam during
                the flood. The replay uses those anchors as scenario inputs.
            </div>
        `;

        if (typeof showModal === "function") {
            showModal("Chennai Floods — Simulation Report", html);
        }
    }

    async function runReplay() {
        if (running) return;

        const button = document.querySelector(".primary-button");
        if (!button) return;

        running = true;
        button.disabled = true;
        button.textContent = "Replaying 2015 Floods…";
        setReplayState("LOADING");

        try {
            const result = await fetchSimulation();
            const stages = result.stages || [];

            if (!stages.length) {
                throw new Error("Historical simulation returned no stages.");
            }

            replayResult = result;

            for (let index = 0; index < stages.length; index += 1) {
                applyStage(stages[index], index, stages);
                await new Promise((resolve) => setTimeout(resolve, 1100));
            }

            setReplayState("COMPLETE");
            renderFinalResult(stages);
        } catch (error) {
            console.error("2015 Chennai flood replay failed:", error);
            setReplayState("ERROR");

            if (typeof showMessage === "function") {
                showMessage("Historical simulation failed", error.message);
            }
        } finally {
            running = false;
            button.disabled = false;
            button.textContent = "Replay 2015 Chennai Floods";
        }
    }

    async function generateHistoricalResponsePlan() {
        const selectedZone =
            typeof DASHBOARD_RUNTIME !== "undefined"
                ? DASHBOARD_RUNTIME.selectedZoneId
                : null;

        if (replayResult?.stages?.length) {
            const latest = replayResult.stages[replayResult.stages.length - 1];
            renderStageModal(latest);
            return;
        }

        if (selectedZone && typeof dashboardRuntimeFetch === "function") {
            try {
                const plan = await dashboardRuntimeFetch(
                    `/response/plan/${encodeURIComponent(selectedZone)}`
                );

                const html = `
                    <div class="result-hero">
                        <div>
                            <div class="result-label">CURRENT RESPONSE PLAN · ${escape(selectedZone)}</div>
                            <div class="result-risk">
                                ${escape(Number(
                                    DASHBOARD_RUNTIME.assessments.get(selectedZone)?.risk_score || 0
                                ).toFixed(2))}
                                <span>/ 100</span>
                            </div>
                        </div>
                        <div class="result-level">
                            ${escape(String(plan.risk_level || "normal").toUpperCase())}
                        </div>
                    </div>
                    <div class="result-section">
                        <div class="result-label">ACTIONS</div>
                        <div class="result-list">
                            ${(plan.actions || []).map((action) => `
                                <div class="result-item">
                                    <strong>${escape(action.action_type || "action")}</strong>
                                    <span>${escape(action.description || "")}</span>
                                </div>
                            `).join("") || `<div class="result-empty">No action generated.</div>`}
                        </div>
                    </div>
                    <div class="result-section">
                        <div class="result-label">ALLOCATIONS</div>
                        <div class="result-list">
                            ${(plan.allocations || []).map((allocation) => `
                                <div class="result-item">
                                    <strong>${escape(allocation.quantity)} × ${escape(allocation.resource_type)}</strong>
                                    <span>${escape(allocation.source_zone_id)} → ${escape(allocation.destination_zone_id)}</span>
                                </div>
                            `).join("") || `<div class="result-empty">No allocation generated.</div>`}
                        </div>
                    </div>
                `;

                if (typeof showModal === "function") {
                    showModal(`Response Plan — ${selectedZone}`, html);
                }
                return;
            } catch (error) {
                if (typeof showMessage === "function") {
                    showMessage("Response plan failed", error.message);
                }
                return;
            }
        }

        if (typeof showMessage === "function") {
            showMessage("Response plan unavailable", "Select a Chennai ward first.");
        }
    }

    function interceptDashboardButtons() {
        document.addEventListener(
            "click",
            (event) => {
                const simulationButton = event.target.closest?.(".primary-button");
                if (simulationButton) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    runReplay();
                    return;
                }

                const responseButton = event.target.closest?.(".secondary-button");
                if (responseButton) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    generateHistoricalResponsePlan();
                }
            },
            true
        );
    }

    function boot() {
        ensureStyles();
        rewriteSimulationPanel();
        interceptDashboardButtons();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot, { once: true });
    } else {
        boot();
    }

    window.runChennai2015Replay = runReplay;
})();
