const API_BASE = "http://127.0.0.1:8000";


// ============================================================
// API
// ============================================================

async function fetchJSON(endpoint, options = {}) {
    const response = await fetch(
        `${API_BASE}${endpoint}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
        }
    );

    if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;

        try {
            const errorBody = await response.json();
            if (errorBody.detail) {
                message = errorBody.detail;
            }
        } catch {
            // keep HTTP message
        }

        throw new Error(message);
    }

    return response.json();
}


// ============================================================
// DOM HELPERS
// ============================================================

function setText(selector, value) {
    const element = document.querySelector(selector);
    if (element) {
        element.textContent = value;
    }
}

function getElement(selector) {
    return document.querySelector(selector);
}


// ============================================================
// BACKEND STATUS
// ============================================================

async function checkBackend() {
    try {
        await fetchJSON("/health");
        console.log("Backend connection: OK");

        const status = getElement(".system-status strong");
        const statusText = getElement(".system-status span");

        if (status) status.textContent = "System Online";
        if (statusText) statusText.textContent = "Backend connected";

    } catch (error) {
        console.error("Backend connection failed:", error);

        const status = getElement(".system-status strong");
        const statusText = getElement(".system-status span");

        if (status) status.textContent = "System Offline";
        if (statusText) statusText.textContent = "Backend unavailable";
    }
}


// ============================================================
// RISK OVERVIEW
// ============================================================

async function loadRiskOverview() {
    try {
        const overview = await fetchJSON("/risk/overview");
        console.log("Risk overview:", overview);
        updateDashboard(overview);
    } catch (error) {
        console.error("Could not load risk overview:", error);
    }
}

function updateDashboard(overview) {
    setText(".stat-card:nth-child(1) .stat-value", overview.total_zones);
    setText(".stat-card:nth-child(2) .stat-value", overview.critical_count);

    updateNetworkMap(overview.assessments || []);

    if (overview.assessments && overview.assessments.length > 0) {
        const highestRisk = overview.assessments.reduce(
            (highest, current) =>
                current.risk_score > highest.risk_score ? current : highest
        );
        updateHighestRisk(highestRisk);
    }
}


// ============================================================
// LIVE NETWORK MAP
// ============================================================

function updateNetworkMap(assessments) {
    const zones = document.querySelectorAll(".network-zone");

    zones.forEach((zoneElement) => {
        const zoneId = zoneElement.dataset.zoneId;
        const assessment = assessments.find((item) => item.zone_id === zoneId);

        if (!assessment) return;

        const level = String(assessment.risk_level).toLowerCase();

        zoneElement.classList.remove("normal", "watch", "high", "critical");
        zoneElement.classList.add(level);
    });

    console.log("Network map updated:", assessments);
}


// ============================================================
// ROAD NETWORK
// ============================================================

async function loadRoadNetwork() {
    try {
        const result = await fetchJSON("/world/roads");
        updateRoadNetwork(result.roads || []);
        console.log("Road network:", result.roads);
    } catch (error) {
        console.error("Could not load road network:", error);
    }
}

function updateRoadNetwork(roads) {
    const roadElements = document.querySelectorAll(".network-road");

    roadElements.forEach((roadElement) => {
        const roadId = roadElement.dataset.roadId;
        const road = roads.find((item) => item.id === roadId);

        if (!road) return;

        roadElement.classList.remove("blocked", "restricted");

        if (road.blocked) {
            roadElement.classList.add("blocked");
            return;
        }

        if (road.accessibility_percent !== undefined && road.accessibility_percent < 50) {
            roadElement.classList.add("restricted");
        }
    });
}


// ============================================================
// ACTIVE INCIDENT
// ============================================================

function updateHighestRisk(assessment) {
    setText(".incident-id", assessment.zone_id);

    const riskScore = getElement(".incident-risk");
    if (riskScore) {
        riskScore.innerHTML = `
            ${assessment.risk_score}
            <span>/ 100</span>
        `;
    }

    const riskBadge = getElement(".risk-badge");
    if (riskBadge) {
        const level = String(assessment.risk_level).toLowerCase();
        riskBadge.textContent = level.toUpperCase();
        riskBadge.classList.remove("normal", "watch", "high", "critical");
        riskBadge.classList.add(level);
    }

    const progressFill = getElement(".risk-progress-fill");
    if (progressFill) {
        progressFill.style.width = `${assessment.risk_score}%`;
    }

    console.log("Highest-risk zone:", assessment.zone_id);
    console.log("Risk score:", assessment.risk_score);
    console.log("Risk level:", assessment.risk_level);
    console.log("Risk factors:", assessment.factors);
}


// ============================================================
// SIMULATION
// ============================================================

async function runFloodSimulation() {
    const button = getElement(".primary-button");
    if (!button) return;

    button.disabled = true;
    button.textContent = "Running Simulation...";
    setSimulationState("RUNNING");

    try {
        console.log("Starting flood response simulation...");

        const result = await fetchJSON("/simulation/flood/response", {
            method: "POST",
        });

        console.log("Flood response simulation:", result);

        if (!result.steps || result.steps.length === 0) {
            throw new Error("Simulation returned no steps.");
        }

        for (let index = 0; index < result.steps.length; index++) {
            const step = result.steps[index];
            displaySimulationStep(step, index, result.steps);
            await delay(700);
        }

        setSimulationState("COMPLETE");

        const finalStep = result.steps[result.steps.length - 1];
        showSimulationResult(finalStep);

    } catch (error) {
        console.error("Flood simulation failed:", error);
        setSimulationState("ERROR");
        showMessage("Simulation failed", error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Run Flood Simulation";
    }
}


// ============================================================
// DISPLAY ONE SIMULATION STEP
// ============================================================

function displaySimulationStep(step, index, steps) {
    console.log(`Simulation step ${index + 1}:`, step);

    // Step counter
    const simulationState = getElement(".simulation-state");
    if (simulationState) {
        simulationState.textContent = `STEP ${index + 1}`;
    }

    const assessment = {
        zone_id: "Z001",
        risk_score: step.risk_score,
        risk_level: step.risk_level,
        factors: step.factors,
    };

    updateHighestRisk(assessment);
    updateIncidentFromFactors(step);
    updateTimeline(index, steps);
}


// ============================================================
// UPDATE INCIDENT FROM SIMULATION FACTORS
// ============================================================

function updateIncidentFromFactors(step) {
    if (!step.factors) return;

    const factors = step.factors;
    const conditions = document.querySelectorAll(".condition");
    if (conditions.length < 4) return;

    // Water (backend: water_depth / 2 * 100)
    const waterDepth = Math.min(factors.water / 100 * 2, 2.5);
    conditions[0].querySelector("strong").textContent =
        `${Number(waterDepth.toFixed(2))} m`;

    // Rainfall (backend: rainfall / 150 * 100)
    const rainfall = factors.rainfall / 100 * 150;
    conditions[1].querySelector("strong").textContent =
        `${Math.round(rainfall)} mm/hr`;

    // Accessibility (risk = 100 - actual)
    const accessibility = 100 - factors.accessibility_risk;
    conditions[2].querySelector("strong").textContent =
        `${Math.round(accessibility)}%`;

    // Response
    const level = String(step.risk_level).toLowerCase();
    conditions[3].querySelector("strong").textContent =
        (level === "critical" || level === "high") ? "REQUIRED" : "MONITOR";
}


// ============================================================
// TIMELINE
// ============================================================

function updateTimeline(activeIndex, steps = []) {
    const items = document.querySelectorAll(".timeline-item");

    items.forEach((item, index) => {
        item.classList.remove("active", "current");

        const step = steps[index];

        if (step) {
            const title = item.querySelector("strong");
            const description = item.querySelector("span");

            if (title) {
                title.textContent = formatSimulationStepName(step.step);
            }

            if (description) {
                description.textContent =
                    `${String(step.risk_level).toUpperCase()} · ` +
                    `${Number(step.risk_score).toFixed(1)} / 100`;
            }
        }

        if (index < activeIndex) {
            item.classList.add("active");
        }

        if (index === activeIndex) {
            item.classList.add("active", "current");
        }
    });
}

function formatSimulationStepName(stepName) {
    if (!stepName) return "Simulation Step";

    return String(stepName)
        .replaceAll("_", " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function setSimulationState(state) {
    const element = getElement(".simulation-state");
    if (element) {
        element.textContent = state;
    }
}


// ============================================================
// SIMULATION RESULT  (correct nested structure)
// ============================================================

function showSimulationResult(step) {
    const actions = step.actions || [];
    const allocations = step.allocations || [];
    const deployments = step.deployments || [];

    let html = `
        <div class="simulation-result">
            <div class="result-hero">
                <div>
                    <div class="result-label">FINAL RISK · Z001</div>
                    <div class="result-risk">
                        ${escapeHTML(String(step.risk_score))}
                        <span>/ 100</span>
                    </div>
                </div>
                <div class="result-level">
                    ${escapeHTML(String(step.risk_level).toUpperCase())}
                </div>
            </div>
    `;

    // RESPONSE ACTIONS
    html += `
        <div class="result-section">
            <div class="result-label">RESPONSE ACTIONS</div>
            <div class="result-list">
    `;

    if (actions.length === 0) {
        html += `<div class="result-empty">No response action required at this stage.</div>`;
    } else {
        actions.forEach((action) => {
            const name = action.action_type || action.action || action.name || "Response action";
            html += `
                <div class="result-item result-action">
                    <span class="result-icon">✓</span>
                    <strong>${escapeHTML(String(name))}</strong>
                </div>
            `;
        });
    }

    html += `</div></div>`;

    // RESOURCE ALLOCATIONS
    html += `
        <div class="result-section">
            <div class="result-label">RESOURCE ALLOCATIONS</div>
            <div class="result-list">
    `;

    if (allocations.length === 0) {
        html += `<div class="result-empty">No resources allocated.</div>`;
    } else {
        allocations.forEach((allocation) => {
            const quantity = allocation.quantity ?? 0;
            const type = allocation.resource_type || "resource";
            const destination = allocation.destination_zone_id || "target zone";
            const priority = allocation.priority ?? "—";

            html += `
                <div class="result-item">
                    <div class="result-item-main">
                        <strong>${escapeHTML(String(quantity))}</strong>
                        <span>× ${escapeHTML(String(type))}</span>
                    </div>
                    <div class="result-item-meta">
                        → ${escapeHTML(String(destination))}
                        <span>P${escapeHTML(String(priority))}</span>
                    </div>
                </div>
            `;
        });
    }

    html += `</div></div>`;

    // DEPLOYMENTS (nested structure)
    html += `
        <div class="result-section">
            <div class="result-label">DEPLOYMENTS</div>
            <div class="result-list">
    `;

    if (deployments.length === 0) {
        html += `<div class="result-empty">No deployments generated.</div>`;
    } else {
        deployments.forEach((deployment) => {
            const alloc = deployment.allocation || {};
            const route = deployment.route || {};

            const type = alloc.resource_type || "resource";
            const source = alloc.source_zone_id || route.origin_zone_id || "source";
            const destination = alloc.destination_zone_id || route.destination_zone_id || "target";
            const quantity = alloc.quantity ?? 1;
            const priority = alloc.priority ?? "—";
            const id = alloc.resource_id || "deployment";
            const distance = route.total_distance_km;
            const travelTime = route.total_travel_time_min;

            html += `
                <div class="deployment-result">
                    <div class="deployment-result-top">
                        <strong>${escapeHTML(String(type))}</strong>
                        <span>P${escapeHTML(String(priority))}</span>
                    </div>

                    <div class="deployment-result-route">
                        <strong>${escapeHTML(String(source))}</strong>
                        <span>→</span>
                        <strong>${escapeHTML(String(destination))}</strong>
                    </div>

                    <div class="deployment-result-meta">
                        <span>
                            QUANTITY
                            <strong>${escapeHTML(String(quantity))}</strong>
                        </span>
                        <span>
                            ID
                            <strong>${escapeHTML(String(id))}</strong>
                        </span>
                    </div>
            `;

            if (distance !== undefined || travelTime !== undefined) {
                html += `
                    <div class="deployment-result-meta" style="margin-top:8px;border-top:none;padding-top:0;">
                        <span>
                            DISTANCE
                            <strong>${escapeHTML(String(distance ?? "—"))} km</strong>
                        </span>
                        <span>
                            TIME
                            <strong>${escapeHTML(String(travelTime ?? "—"))} min</strong>
                        </span>
                    </div>
                `;
            }

            html += `</div>`;
        });
    }

    html += `</div></div></div>`;

    showModal("Flood Response Result", html);
}


// ============================================================
// RESPONSE PLAN
// ============================================================

async function generateResponsePlan() {
    const button = getElement(".secondary-button");
    if (!button) return;

    button.disabled = true;
    button.textContent = "Generating...";

    try {
        const plan = await fetchJSON("/response/plan/Z001");
        console.log("Response plan:", plan);

        let html = "";

        if (plan.actions && plan.actions.length > 0) {
            html += `
                <div class="result-section">
                    <div class="result-label">RESPONSE ACTIONS</div>
                    <div class="result-list">
            `;
            plan.actions.forEach((action) => {
                html += `
                    <div class="result-item">
                        ${escapeHTML(String(action.action_type || action.action || action.name || "Response action"))}
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        if (plan.allocations && plan.allocations.length > 0) {
            html += `
                <div class="result-section">
                    <div class="result-label">RESOURCE ALLOCATIONS</div>
                    <div class="result-list">
            `;
            plan.allocations.forEach((allocation) => {
                html += `
                    <div class="result-item">
                        <strong>${escapeHTML(String(allocation.quantity))}</strong>
                        × ${escapeHTML(String(allocation.resource_type))}
                        → ${escapeHTML(String(allocation.destination_zone_id))}
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        if (plan.deployments && plan.deployments.length > 0) {
            html += `
                <div class="result-section">
                    <div class="result-label">DEPLOYMENTS</div>
                    <div class="result-list">
            `;
            plan.deployments.forEach((deployment) => {
                const alloc = deployment.allocation || deployment;
                html += `
                    <div class="result-item">
                        ${escapeHTML(String(alloc.resource_type || alloc.resource_id || "Resource"))}
                        → ${escapeHTML(String(alloc.destination_zone_id || "target zone"))}
                    </div>
                `;
            });
            html += `</div></div>`;
        }

        if (!html) {
            html = `
                <div class="result-section">
                    <div class="result-label">RESPONSE PLAN</div>
                    <div class="result-item">No response actions were generated.</div>
                </div>
            `;
        }

        showModal("Response Plan — Z001", html);

    } catch (error) {
        console.error("Response plan failed:", error);
        showMessage("Response plan failed", error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Generate Response Plan";
    }
}


// ============================================================
// MODAL
// ============================================================

function createModalStyles() {
    if (document.getElementById("dynamic-modal-styles")) return;

    const style = document.createElement("style");
    style.id = "dynamic-modal-styles";

    style.textContent = `
        .dynamic-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.72);
            display: grid;
            place-items: center;
            z-index: 9999;
            padding: 20px;
        }
        .dynamic-modal {
            width: min(620px, 100%);
            max-height: 82vh;
            overflow-y: auto;
            background: #10151d;
            border: 1px solid #2b3440;
            border-radius: 12px;
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
        }
        .dynamic-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 18px 20px;
            border-bottom: 1px solid #222a35;
        }
        .dynamic-modal-header h3 {
            font-size: 15px;
            color: #f2f5f8;
        }
        .dynamic-modal-close {
            border: 1px solid #303945;
            background: transparent;
            color: #8b96a5;
            width: 30px;
            height: 30px;
            border-radius: 7px;
            cursor: pointer;
            font-size: 16px;
        }
        .dynamic-modal-close:hover {
            color: #f2f5f8;
            background: rgba(255,255,255,0.05);
        }
        .dynamic-modal-body {
            padding: 20px;
        }
        .dynamic-modal-error {
            color: #ff6670;
            font-size: 12px;
        }
    `;

    document.head.appendChild(style);
}

function showModal(title, html) {
    createModalStyles();

    const existing = document.querySelector(".dynamic-modal-backdrop");
    if (existing) existing.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "dynamic-modal-backdrop";

    backdrop.innerHTML = `
        <div class="dynamic-modal">
            <div class="dynamic-modal-header">
                <h3>${escapeHTML(title)}</h3>
                <button class="dynamic-modal-close" aria-label="Close">×</button>
            </div>
            <div class="dynamic-modal-body">
                ${html}
            </div>
        </div>
    `;

    document.body.appendChild(backdrop);

    backdrop.querySelector(".dynamic-modal-close").addEventListener("click", () => backdrop.remove());

    backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) backdrop.remove();
    });

    document.addEventListener("keydown", function closeOnEscape(event) {
        if (event.key === "Escape") {
            backdrop.remove();
            document.removeEventListener("keydown", closeOnEscape);
        }
    });
}

function showMessage(title, message) {
    showModal(title, `
        <div class="dynamic-modal-error">
            ${escapeHTML(String(message))}
        </div>
    `);
}


// ============================================================
// UTILITIES
// ============================================================

function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ============================================================
// BUTTON WIRING
// ============================================================

function initializeControls() {
    const simulationButton = getElement(".primary-button");
    const responseButton = getElement(".secondary-button");

    if (simulationButton) {
        simulationButton.addEventListener("click", runFloodSimulation);
    }

    if (responseButton) {
        responseButton.addEventListener("click", generateResponsePlan);
    }

    console.log("Dashboard controls initialized.");
}


// ============================================================
// INITIALIZATION
// ============================================================

async function initializeDashboard() {
    console.log("SIH26206 Disaster Response Dashboard loaded.");
    initializeControls();
    await checkBackend();
    await loadRiskOverview();
    await loadRoadNetwork();
}

document.addEventListener("DOMContentLoaded", initializeDashboard);


// ============================================================
// SIDEBAR NAVIGATION
// ============================================================

let dashboardHTML = null;

function riskClass(level) {
    return String(level || "normal").toLowerCase();
}

function formatRisk(level) {
    return String(level || "normal").toUpperCase();
}

function setActiveNavigation(view) {
    document.querySelectorAll(".nav-item").forEach((item) => {
        item.classList.remove("active");
    });

    const activeItem = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (activeItem) activeItem.classList.add("active");
}

function setPage(title, kicker, subtitle, content) {
    const main = document.querySelector(".main-content");
    if (!main) return;

    main.innerHTML = `
        <header class="topbar">
            <div>
                <p class="eyebrow">${escapeHTML(kicker)}</p>
                <h2>${escapeHTML(title)}</h2>
                <p class="subtitle">${escapeHTML(subtitle)}</p>
            </div>
            <div class="prototype-badge">PROTOTYPE</div>
        </header>
        <section class="page-content">
            ${content}
        </section>
        <footer>
            SIH26206 • Disaster Response Decision Support System
        </footer>
    `;
}

async function showDashboard() {
    if (dashboardHTML === null) {
        console.error("Dashboard snapshot was not captured.");
        return;
    }

    const main = document.querySelector(".main-content");
    if (!main) return;

    main.innerHTML = dashboardHTML;
    setActiveNavigation("dashboard");
    initializeDashboardButtons();
    await loadRiskOverview();
}

async function showRiskOverview() {
    setActiveNavigation("risk");

    setPage(
        "Risk Overview",
        "SITUATIONAL AWARENESS",
        "Live risk assessment across all monitored zones.",
        `<div class="view-loading" id="risk-view">Loading risk assessment...</div>`
    );

    try {
        const overview = await fetchJSON("/risk/overview");
        const assessments = overview.assessments || [];

        const cards = assessments.map((assessment) => {
            const level = riskClass(assessment.risk_level);
            const factors = assessment.factors || {};

            return `
                <article class="data-card risk-view-card">
                    <div class="data-card-header">
                        <div>
                            <span class="data-label">ZONE</span>
                            <h3>${escapeHTML(assessment.zone_id)}</h3>
                        </div>
                        <span class="risk-badge ${level}">
                            ${escapeHTML(formatRisk(assessment.risk_level))}
                        </span>
                    </div>
                    <div class="large-risk-score">
                        ${Number(assessment.risk_score).toFixed(2)}
                        <span>/ 100</span>
                    </div>
                    <div class="risk-progress">
                        <div class="risk-progress-fill ${level}"
                             style="width:${Math.min(Number(assessment.risk_score), 100)}%">
                        </div>
                    </div>
                    <div class="factor-grid">
                        <div>
                            <span>RAINFALL</span>
                            <strong>${Number(factors.rainfall ?? 0).toFixed(1)}</strong>
                        </div>
                        <div>
                            <span>VULNERABILITY</span>
                            <strong>${Number(factors.vulnerability ?? 0).toFixed(1)}</strong>
                        </div>
                        <div>
                            <span>POPULATION</span>
                            <strong>${Number(factors.population ?? 0).toFixed(1)}</strong>
                        </div>
                        <div>
                            <span>ACCESSIBILITY RISK</span>
                            <strong>${Number(factors.accessibility_risk ?? factors.accessibility ?? 0).toFixed(1)}</strong>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

        const highestRisk = assessments.length > 0
            ? assessments.reduce((h, c) => c.risk_score > h.risk_score ? c : h)
            : null;

        const container = document.querySelector("#risk-view");
        if (!container) return;

        container.innerHTML = `
            <div class="overview-summary">
                <div class="data-card summary-card">
                    <span class="data-label">MONITORED ZONES</span>
                    <strong>${overview.total_zones ?? assessments.length}</strong>
                </div>
                <div class="data-card summary-card">
                    <span class="data-label">CRITICAL</span>
                    <strong class="danger-number">${overview.critical_count ?? 0}</strong>
                </div>
                <div class="data-card summary-card">
                    <span class="data-label">HIGH</span>
                    <strong>${overview.high_count ?? 0}</strong>
                </div>
                <div class="data-card summary-card">
                    <span class="data-label">HIGHEST RISK</span>
                    <strong>${highestRisk ? escapeHTML(highestRisk.zone_id) : "—"}</strong>
                </div>
            </div>
            <div class="section-heading">
                <div>
                    <p class="panel-kicker">ZONE ASSESSMENTS</p>
                    <h3>Current Risk State</h3>
                </div>
            </div>
            <div class="data-grid">
                ${cards || `<div class="data-card">No risk assessments available.</div>`}
            </div>
        `;
    } catch (error) {
        console.error("Could not load risk overview:", error);
        const container = document.querySelector("#risk-view");
        if (container) {
            container.innerHTML = `
                <div class="error-card">
                    <strong>Risk data unavailable</strong>
                    <span>Could not connect to the backend.</span>
                </div>
            `;
        }
    }
}

async function showRoadNetwork() {
    setActiveNavigation("roads");

    setPage(
        "Road Network",
        "DISASTER-AWARE ROUTING",
        "Current road accessibility and network condition.",
        `<div class="view-loading" id="road-view">Loading road network...</div>`
    );

    try {
        const data = await fetchJSON("/world/roads");
        const roads = data.roads || [];

        const rows = roads.map((road) => {
            const accessibility = Number(road.accessibility_percent ?? 0);
            let condition = "GOOD";

            if (road.blocked) condition = "BLOCKED";
            else if (accessibility <= 25) condition = "SEVERE";
            else if (accessibility < 50) condition = "DEGRADED";
            else if (accessibility < 75) condition = "LIMITED";

            return `
                <div class="road-row">
                    <div>
                        <strong>${escapeHTML(road.id)}</strong>
                        <span>${escapeHTML(road.from_zone_id)} → ${escapeHTML(road.to_zone_id)}</span>
                    </div>
                    <div>
                        <span class="data-label">DISTANCE</span>
                        <strong>${Number(road.distance_km ?? 0).toFixed(1)} km</strong>
                    </div>
                    <div>
                        <span class="data-label">TRAVEL TIME</span>
                        <strong>${Number(road.travel_time_min ?? 0).toFixed(1)} min</strong>
                    </div>
                    <div>
                        <span class="data-label">ACCESSIBILITY</span>
                        <strong>${accessibility.toFixed(0)}%</strong>
                    </div>
                    <span class="condition-badge ${road.blocked ? "blocked" : condition === "GOOD" ? "good" : "degraded"}">
                        ${condition}
                    </span>
                </div>
            `;
        }).join("");

        const container = document.querySelector("#road-view");
        if (!container) return;

        container.innerHTML = `
            <div class="data-card network-summary">
                <div>
                    <span class="data-label">ACTIVE ROAD LINKS</span>
                    <strong>${roads.length}</strong>
                </div>
                <div>
                    <span class="data-label">ROUTING STATUS</span>
                    <strong class="success-number">OPERATIONAL</strong>
                </div>
            </div>
            <div class="section-heading">
                <div>
                    <p class="panel-kicker">NETWORK CONDITION</p>
                    <h3>Road Links</h3>
                </div>
            </div>
            <div class="data-card road-list">
                ${rows || "<div>No road data available.</div>"}
            </div>
            <div class="info-card">
                <strong>How routing uses this data</strong>
                <span>
                    Routes account for road accessibility when calculating traversal cost.
                    Blocked roads are excluded from routing.
                </span>
            </div>
        `;
    } catch (error) {
        console.error("Could not load road network:", error);
        const container = document.querySelector("#road-view");
        if (container) {
            container.innerHTML = `
                <div class="error-card">
                    <strong>Road network unavailable</strong>
                    <span>Could not connect to the backend.</span>
                </div>
            `;
        }
    }
}

async function showResources() {
    setActiveNavigation("resources");

    setPage(
        "Resources",
        "RESPONSE CAPACITY",
        "Emergency resources available for deployment.",
        `
            <div class="resources-view">
                <div class="data-grid resource-view-grid">
                    <article class="data-card resource-large-card">
                        <div class="resource-view-icon">+</div>
                        <div>
                            <span class="data-label">MEDICAL RESPONSE</span>
                            <h3>Ambulances</h3>
                            <span>Emergency medical transport</span>
                        </div>
                        <strong>2</strong>
                    </article>
                    <article class="data-card resource-large-card">
                        <div class="resource-view-icon">+</div>
                        <div>
                            <span class="data-label">FIELD RESPONSE</span>
                            <h3>Rescue Teams</h3>
                            <span>Search and rescue personnel</span>
                        </div>
                        <strong>2</strong>
                    </article>
                    <article class="data-card resource-large-card">
                        <div class="resource-view-icon">≈</div>
                        <div>
                            <span class="data-label">FLOOD RESPONSE</span>
                            <h3>Rescue Boat</h3>
                            <span>Water rescue capability</span>
                        </div>
                        <strong>1</strong>
                    </article>
                </div>
                <div class="info-card">
                    <strong>Current resource base</strong>
                    <span>
                        Demo response resources are stationed at Z002 and can be allocated
                        to higher-priority disaster demands.
                    </span>
                </div>
            </div>
        `
    );
}

function initializeDashboardButtons() {
    const simulationButton = document.querySelector(".primary-button");
    const responseButton = document.querySelector(".secondary-button");

    if (simulationButton && !simulationButton.dataset.bound) {
        simulationButton.dataset.bound = "true";
        simulationButton.addEventListener("click", async () => {
            if (typeof runFloodSimulation === "function") {
                await runFloodSimulation();
            }
        });
    }

    if (responseButton && !responseButton.dataset.bound) {
        responseButton.dataset.bound = "true";
        responseButton.addEventListener("click", async () => {
            if (typeof generateResponsePlan === "function") {
                await generateResponsePlan();
            }
        });
    }
}

function initializeNavigation() {
    const main = document.querySelector(".main-content");
    if (!main) return;

    if (dashboardHTML === null) {
        dashboardHTML = main.innerHTML;
    }

    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach((item, index) => {
        const views = ["dashboard", "risk", "roads", "resources"];
        const view = views[index];
        if (!view) return;

        item.dataset.view = view;
        item.setAttribute("href", "#");

        item.addEventListener("click", async (event) => {
            event.preventDefault();

            if (view === "dashboard") {
                await showDashboard();
                return;
            }
            if (view === "risk") {
                await showRiskOverview();
                return;
            }
            if (view === "roads") {
                await showRoadNetwork();
                return;
            }
            if (view === "resources") {
                await showResources();
            }
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initializeNavigation();
});