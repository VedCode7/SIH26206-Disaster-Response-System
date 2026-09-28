const API_BASE = "http://127.0.0.1:8000";

// ============================================================
// API
// ============================================================

async function fetchJSON(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        let message = `${response.status} ${response.statusText}`;
        try {
            const errorBody = await response.json();
            if (errorBody.detail) message = errorBody.detail;
        } catch {}
        throw new Error(message);
    }
    return response.json();
}

// ============================================================
// DOM HELPERS
// ============================================================

function setText(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
}

function getElement(selector) {
    return document.querySelector(selector);
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// ============================================================
// BACKEND STATUS
// ============================================================

async function checkBackend() {
    try {
        await fetchJSON("/health");
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
        updateDashboard(overview);
    } catch (error) {
        console.error("Could not load risk overview:", error);
    }
}

function updateDashboard(overview) {
    setText(".stat-card:nth-child(1) .stat-value", overview.total_zones);
    setText(".stat-card:nth-child(2) .stat-value", overview.critical_count);
    updateNetworkMap(overview.assessments || []);

    if (overview.assessments?.length > 0) {
        const highest = overview.assessments.reduce((h, c) =>
            c.risk_score > h.risk_score ? c : h
        );
        updateHighestRisk(highest);
    }
}

// ============================================================
// LIVE NETWORK MAP
// ============================================================

function updateNetworkMap(assessments) {
    document.querySelectorAll(".network-zone").forEach((zoneEl) => {
        const zoneId = zoneEl.dataset.zoneId;
        const assessment = assessments.find((a) => a.zone_id === zoneId);
        if (!assessment) return;

        const level = String(assessment.risk_level).toLowerCase();
        zoneEl.classList.remove("normal", "watch", "high", "critical");
        zoneEl.classList.add(level);
    });
}

// ============================================================
// ROAD NETWORK
// ============================================================

async function loadRoadNetwork() {
    try {
        const result = await fetchJSON("/world/roads");
        updateRoadNetwork(result.roads || []);
    } catch (error) {
        console.error("Could not load road network:", error);
    }
}

function updateRoadNetwork(roads) {
    document.querySelectorAll(".network-road").forEach((roadEl) => {
        const roadId = roadEl.dataset.roadId;
        const road = roads.find((r) => r.id === roadId);
        if (!road) return;

        roadEl.classList.remove("blocked", "restricted");
        if (road.blocked) {
            roadEl.classList.add("blocked");
        } else if (road.accessibility_percent !== undefined && road.accessibility_percent < 50) {
            roadEl.classList.add("restricted");
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
        riskScore.innerHTML = `${assessment.risk_score}<span>/ 100</span>`;
    }

    const riskBadge = getElement(".risk-badge");
    if (riskBadge) {
        const level = String(assessment.risk_level).toLowerCase();
        riskBadge.textContent = level.toUpperCase();
        riskBadge.classList.remove("normal", "watch", "high", "critical");
        riskBadge.classList.add(level);
    }

    const progressFill = getElement(".risk-progress-fill");
    if (progressFill) progressFill.style.width = `${assessment.risk_score}%`;
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
        const result = await fetchJSON("/simulation/flood/response", { method: "POST" });
        console.log("Flood response simulation:", result);

        if (!result.steps?.length) throw new Error("Simulation returned no steps.");

        for (let i = 0; i < result.steps.length; i++) {
            displaySimulationStep(result.steps[i], i, result.steps);
            await delay(700);
        }

        setSimulationState("COMPLETE");
        showSimulationResult(result.steps[result.steps.length - 1]);
    } catch (error) {
        console.error(error);
        setSimulationState("ERROR");
        showMessage("Simulation failed", error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Run Flood Simulation";
    }
}

function displaySimulationStep(step, index, steps) {
    const simulationState = getElement(".simulation-state");
    if (simulationState) simulationState.textContent = `STEP ${index + 1}`;

    updateHighestRisk({
        zone_id: "Z001",
        risk_score: step.risk_score,
        risk_level: step.risk_level,
        factors: step.factors,
    });
    updateIncidentFromFactors(step);
    updateTimeline(index, steps);
}

function updateIncidentFromFactors(step) {
    if (!step.factors) return;
    const factors = step.factors;
    const conditions = document.querySelectorAll(".condition");
    if (conditions.length < 4) return;

    const waterDepth = Math.min((factors.water / 100) * 2, 2.5);
    conditions[0].querySelector("strong").textContent = `${Number(waterDepth.toFixed(2))} m`;

    const rainfall = (factors.rainfall / 100) * 150;
    conditions[1].querySelector("strong").textContent = `${Math.round(rainfall)} mm/hr`;

    const accessibility = 100 - factors.accessibility_risk;
    conditions[2].querySelector("strong").textContent = `${Math.round(accessibility)}%`;

    const level = String(step.risk_level).toLowerCase();
    conditions[3].querySelector("strong").textContent =
        level === "critical" || level === "high" ? "REQUIRED" : "MONITOR";
}

function updateTimeline(activeIndex, steps = []) {
    document.querySelectorAll(".timeline-item").forEach((item, index) => {
        item.classList.remove("active", "current");
        const step = steps[index];

        if (step) {
            const title = item.querySelector("strong");
            const desc = item.querySelector("span");
            if (title) title.textContent = formatSimulationStepName(step.step);
            if (desc) {
                desc.textContent = `${String(step.risk_level).toUpperCase()} · ${Number(step.risk_score).toFixed(1)} / 100`;
            }
        }

        if (index < activeIndex) item.classList.add("active");
        if (index === activeIndex) item.classList.add("active", "current");
    });
}

function formatSimulationStepName(name) {
    if (!name) return "Simulation Step";
    return String(name).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function setSimulationState(state) {
    const el = getElement(".simulation-state");
    if (el) el.textContent = state;
}

// ============================================================
// SIMULATION RESULT
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
                    <div class="result-risk">${escapeHTML(String(step.risk_score))}<span>/ 100</span></div>
                </div>
                <div class="result-level">${escapeHTML(String(step.risk_level).toUpperCase())}</div>
            </div>
    `;

    // Actions
    html += `<div class="result-section"><div class="result-label">RESPONSE ACTIONS</div><div class="result-list">`;
    if (!actions.length) {
        html += `<div class="result-empty">No response action required at this stage.</div>`;
    } else {
        actions.forEach((a) => {
            const name = a.action_type || a.action || a.name || "Response action";
            html += `<div class="result-item result-action"><span class="result-icon">✓</span><strong>${escapeHTML(name)}</strong></div>`;
        });
    }
    html += `</div></div>`;

    // Allocations
    html += `<div class="result-section"><div class="result-label">RESOURCE ALLOCATIONS</div><div class="result-list">`;
    if (!allocations.length) {
        html += `<div class="result-empty">No resources allocated.</div>`;
    } else {
        allocations.forEach((a) => {
            html += `
                <div class="result-item">
                    <div class="result-item-main">
                        <strong>${escapeHTML(String(a.quantity ?? 0))}</strong>
                        <span>× ${escapeHTML(a.resource_type || "resource")}</span>
                    </div>
                    <div class="result-item-meta">
                        → ${escapeHTML(a.destination_zone_id || "target")}
                        <span>P${escapeHTML(String(a.priority ?? "—"))}</span>
                    </div>
                </div>`;
        });
    }
    html += `</div></div>`;

    // Deployments (nested)
    html += `<div class="result-section"><div class="result-label">DEPLOYMENTS</div><div class="result-list">`;
    if (!deployments.length) {
        html += `<div class="result-empty">No deployments generated.</div>`;
    } else {
        deployments.forEach((d) => {
            const alloc = d.allocation || {};
            const route = d.route || {};
            const type = alloc.resource_type || "resource";
            const source = alloc.source_zone_id || route.origin_zone_id || "source";
            const dest = alloc.destination_zone_id || route.destination_zone_id || "target";
            const qty = alloc.quantity ?? 1;
            const prio = alloc.priority ?? "—";
            const id = alloc.resource_id || "deployment";
            const dist = route.total_distance_km;
            const time = route.total_travel_time_min;

            html += `
                <div class="deployment-result">
                    <div class="deployment-result-top">
                        <strong>${escapeHTML(type)}</strong>
                        <span>P${escapeHTML(String(prio))}</span>
                    </div>
                    <div class="deployment-result-route">
                        <strong>${escapeHTML(source)}</strong>
                        <span>→</span>
                        <strong>${escapeHTML(dest)}</strong>
                    </div>
                    <div class="deployment-result-meta">
                        <span>QUANTITY<strong>${escapeHTML(String(qty))}</strong></span>
                        <span>ID<strong>${escapeHTML(id)}</strong></span>
                    </div>`;
            if (dist !== undefined || time !== undefined) {
                html += `
                    <div class="deployment-result-meta" style="margin-top:8px;border-top:none;padding-top:0;">
                        <span>DISTANCE<strong>${escapeHTML(String(dist ?? "—"))} km</strong></span>
                        <span>TIME<strong>${escapeHTML(String(time ?? "—"))} min</strong></span>
                    </div>`;
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
        let html = "";

        if (plan.actions?.length) {
            html += `<div class="result-section"><div class="result-label">RESPONSE ACTIONS</div><div class="result-list">`;
            plan.actions.forEach((a) => {
                html += `<div class="result-item">${escapeHTML(a.action_type || a.action || a.name || "Action")}</div>`;
            });
            html += `</div></div>`;
        }

        if (plan.allocations?.length) {
            html += `<div class="result-section"><div class="result-label">RESOURCE ALLOCATIONS</div><div class="result-list">`;
            plan.allocations.forEach((a) => {
                html += `<div class="result-item"><strong>${escapeHTML(String(a.quantity))}</strong> × ${escapeHTML(a.resource_type)} → ${escapeHTML(a.destination_zone_id)}</div>`;
            });
            html += `</div></div>`;
        }

        if (plan.deployments?.length) {
            html += `<div class="result-section"><div class="result-label">DEPLOYMENTS</div><div class="result-list">`;
            plan.deployments.forEach((d) => {
                const alloc = d.allocation || d;
                html += `<div class="result-item">${escapeHTML(alloc.resource_type || alloc.resource_id || "Resource")} → ${escapeHTML(alloc.destination_zone_id || "target")}</div>`;
            });
            html += `</div></div>`;
        }

        if (!html) {
            html = `<div class="result-section"><div class="result-label">RESPONSE PLAN</div><div class="result-item">No response actions were generated.</div></div>`;
        }

        showModal("Response Plan — Z001", html);
    } catch (error) {
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
        .dynamic-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.72);display:grid;place-items:center;z-index:9999;padding:20px}
        .dynamic-modal{width:min(620px,100%);max-height:82vh;overflow-y:auto;background:#10151d;border:1px solid #2b3440;border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.55)}
        .dynamic-modal-header{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid #222a35}
        .dynamic-modal-header h3{font-size:15px;color:#f2f5f8}
        .dynamic-modal-close{border:1px solid #303945;background:transparent;color:#8b96a5;width:30px;height:30px;border-radius:7px;cursor:pointer;font-size:16px}
        .dynamic-modal-close:hover{color:#f2f5f8;background:rgba(255,255,255,.05)}
        .dynamic-modal-body{padding:20px}
        .dynamic-modal-error{color:#ff6670;font-size:12px}
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
                <button class="dynamic-modal-close">×</button>
            </div>
            <div class="dynamic-modal-body">${html}</div>
        </div>`;
    document.body.appendChild(backdrop);

    backdrop.querySelector(".dynamic-modal-close").onclick = () => backdrop.remove();
    backdrop.onclick = (e) => { if (e.target === backdrop) backdrop.remove(); };
    document.addEventListener("keydown", function esc(e) {
        if (e.key === "Escape") {
            backdrop.remove();
            document.removeEventListener("keydown", esc);
        }
    });
}

function showMessage(title, message) {
    showModal(title, `<div class="dynamic-modal-error">${escapeHTML(message)}</div>`);
}

function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// BUTTON WIRING + INIT
// ============================================================

function initializeControls() {
    const simBtn = getElement(".primary-button");
    const planBtn = getElement(".secondary-button");
    if (simBtn) simBtn.addEventListener("click", runFloodSimulation);
    if (planBtn) planBtn.addEventListener("click", generateResponsePlan);
}

async function initializeDashboard() {
    console.log("SIH26206 Disaster Response Dashboard loaded.");
    initializeControls();
    await checkBackend();
    await loadRiskOverview();
    await loadRoadNetwork();
}

document.addEventListener("DOMContentLoaded", initializeDashboard);

// ============================================================
// SIDEBAR NAVIGATION + NEW PAGES
// ============================================================

let dashboardHTML = null;

function setActiveNavigation(view) {
    document.querySelectorAll(".nav-item").forEach((i) => i.classList.remove("active"));
    const active = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (active) active.classList.add("active");
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
        <section class="page-content">${content}</section>
        <footer>SIH26206 • Disaster Response Decision Support System</footer>`;
}

async function showDashboard() {
    if (!dashboardHTML) return;
    const main = document.querySelector(".main-content");
    if (!main) return;
    main.innerHTML = dashboardHTML;
    setActiveNavigation("dashboard");
    initializeDashboardButtons();
    await loadRiskOverview();
}

function initializeDashboardButtons() {
    const simBtn = document.querySelector(".primary-button");
    const planBtn = document.querySelector(".secondary-button");
    if (simBtn && !simBtn.dataset.bound) {
        simBtn.dataset.bound = "true";
        simBtn.addEventListener("click", runFloodSimulation);
    }
    if (planBtn && !planBtn.dataset.bound) {
        planBtn.dataset.bound = "true";
        planBtn.addEventListener("click", generateResponsePlan);
    }
}

// ---------- Risk Overview (existing) ----------
async function showRiskOverview() {
    setActiveNavigation("risk");
    setPage("Risk Overview", "SITUATIONAL AWARENESS", "Live risk assessment across all monitored zones.",
        `<div class="view-loading" id="risk-view">Loading risk assessment...</div>`);

    try {
        const overview = await fetchJSON("/risk/overview");
        const assessments = overview.assessments || [];
        const cards = assessments.map((a) => {
            const level = String(a.risk_level || "normal").toLowerCase();
            const f = a.factors || {};
            return `
                <article class="data-card risk-view-card">
                    <div class="data-card-header">
                        <div><span class="data-label">ZONE</span><h3>${escapeHTML(a.zone_id)}</h3></div>
                        <span class="risk-badge ${level}">${escapeHTML(String(a.risk_level).toUpperCase())}</span>
                    </div>
                    <div class="large-risk-score">${Number(a.risk_score).toFixed(2)}<span>/ 100</span></div>
                    <div class="risk-progress"><div class="risk-progress-fill ${level}" style="width:${Math.min(Number(a.risk_score),100)}%"></div></div>
                    <div class="factor-grid">
                        <div><span>RAINFALL</span><strong>${Number(f.rainfall??0).toFixed(1)}</strong></div>
                        <div><span>VULNERABILITY</span><strong>${Number(f.vulnerability??0).toFixed(1)}</strong></div>
                        <div><span>POPULATION</span><strong>${Number(f.population??0).toFixed(1)}</strong></div>
                        <div><span>ACCESSIBILITY RISK</span><strong>${Number(f.accessibility_risk??f.accessibility??0).toFixed(1)}</strong></div>
                    </div>
                </article>`;
        }).join("");

        const highest = assessments.length ? assessments.reduce((h,c)=>c.risk_score>h.risk_score?c:h) : null;
        document.querySelector("#risk-view").innerHTML = `
            <div class="overview-summary">
                <div class="data-card summary-card"><span class="data-label">MONITORED ZONES</span><strong>${overview.total_zones??assessments.length}</strong></div>
                <div class="data-card summary-card"><span class="data-label">CRITICAL</span><strong class="danger-number">${overview.critical_count??0}</strong></div>
                <div class="data-card summary-card"><span class="data-label">HIGH</span><strong>${overview.high_count??0}</strong></div>
                <div class="data-card summary-card"><span class="data-label">HIGHEST RISK</span><strong>${highest?escapeHTML(highest.zone_id):"—"}</strong></div>
            </div>
            <div class="section-heading"><h3>Current Risk State</h3></div>
            <div class="data-grid">${cards||`<div class="data-card">No assessments</div>`}</div>`;
    } catch (e) {
        document.querySelector("#risk-view").innerHTML = `<div class="error-card"><strong>Risk data unavailable</strong><span>${escapeHTML(e.message)}</span></div>`;
    }
}

// ---------- Road Network (existing) ----------
async function showRoadNetwork() {
    setActiveNavigation("roads");
    setPage("Road Network", "DISASTER-AWARE ROUTING", "Current road accessibility and network condition.",
        `<div class="view-loading" id="road-view">Loading road network...</div>`);

    try {
        const data = await fetchJSON("/world/roads");
        const roads = data.roads || [];
        const rows = roads.map((r) => {
            const acc = Number(r.accessibility_percent ?? 0);
            let cond = "GOOD";
            if (r.blocked) cond = "BLOCKED";
            else if (acc <= 25) cond = "SEVERE";
            else if (acc < 50) cond = "DEGRADED";
            else if (acc < 75) cond = "LIMITED";

            return `
                <div class="road-row">
                    <div><strong>${escapeHTML(r.id)}</strong><span>${escapeHTML(r.from_zone_id)} → ${escapeHTML(r.to_zone_id)}</span></div>
                    <div><span class="data-label">DISTANCE</span><strong>${Number(r.distance_km??0).toFixed(1)} km</strong></div>
                    <div><span class="data-label">TRAVEL TIME</span><strong>${Number(r.travel_time_min??0).toFixed(1)} min</strong></div>
                    <div><span class="data-label">ACCESSIBILITY</span><strong>${acc.toFixed(0)}%</strong></div>
                    <span class="condition-badge ${r.blocked?"blocked":cond==="GOOD"?"good":"degraded"}">${cond}</span>
                </div>`;
        }).join("");

        document.querySelector("#road-view").innerHTML = `
            <div class="data-card network-summary">
                <div><span class="data-label">ACTIVE ROAD LINKS</span><strong>${roads.length}</strong></div>
                <div><span class="data-label">ROUTING STATUS</span><strong class="success-number">OPERATIONAL</strong></div>
            </div>
            <div class="section-heading"><div><p class="panel-kicker">NETWORK CONDITION</p><h3>Road Links</h3></div></div>
            <div class="data-card road-list">${rows||"<div>No roads</div>"}</div>
            <div class="info-card"><strong>How routing uses this data</strong><span>Routes account for road accessibility. Blocked roads are excluded.</span></div>`;
    } catch (e) {
        document.querySelector("#road-view").innerHTML = `<div class="error-card"><strong>Road network unavailable</strong><span>${escapeHTML(e.message)}</span></div>`;
    }
}

// ---------- Resources (existing) ----------
async function showResources() {
    setActiveNavigation("resources");
    setPage("Resources", "RESPONSE CAPACITY", "Emergency resources available for deployment.", `
        <div class="resources-view">
            <div class="data-grid resource-view-grid">
                <article class="data-card resource-large-card">
                    <div class="resource-view-icon">+</div>
                    <div><span class="data-label">MEDICAL RESPONSE</span><h3>Ambulances</h3><span>Emergency medical transport</span></div>
                    <strong>2</strong>
                </article>
                <article class="data-card resource-large-card">
                    <div class="resource-view-icon">+</div>
                    <div><span class="data-label">FIELD RESPONSE</span><h3>Rescue Teams</h3><span>Search and rescue personnel</span></div>
                    <strong>2</strong>
                </article>
                <article class="data-card resource-large-card">
                    <div class="resource-view-icon">≈</div>
                    <div><span class="data-label">FLOOD RESPONSE</span><h3>Rescue Boat</h3><span>Water rescue capability</span></div>
                    <strong>1</strong>
                </article>
            </div>
            <div class="info-card"><strong>Current resource base</strong><span>Demo resources are stationed at Z002.</span></div>
        </div>`);
}

// ============================================================
// NEW: ROUTING PAGE
// ============================================================

async function showRouting() {
    setActiveNavigation("routing");
    setPage(
        "Routing",
        "DISASTER-AWARE PATHFINDING",
        "Calculate the best available route between two zones.",
        `
        <div class="control-grid">
            <div class="data-card control-card">
                <div class="section-heading" style="padding-top:0;margin-bottom:18px">
                    <div>
                        <p class="panel-kicker">FIND ROUTE</p>
                        <h3>Route Calculator</h3>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="data-label">ORIGIN ZONE</label>
                        <select id="route-origin" class="form-select">
                            <option value="Z001">Z001</option>
                            <option value="Z002" selected>Z002</option>
                            <option value="Z003">Z003</option>
                            <option value="Z004">Z004</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="data-label">DESTINATION ZONE</label>
                        <select id="route-dest" class="form-select">
                            <option value="Z001" selected>Z001</option>
                            <option value="Z002">Z002</option>
                            <option value="Z003">Z003</option>
                            <option value="Z004">Z004</option>
                        </select>
                    </div>
                </div>

                <button id="find-route-btn" class="primary-button" style="width:100%;margin-top:16px">
                    Find Best Route
                </button>

                <div id="route-result" style="margin-top:20px"></div>
            </div>

            <div class="info-card">
                <strong>How it works</strong>
                <span>
                    Uses the current road network (including accessibility and blocked status)
                    to compute the lowest-cost path between the selected zones.
                </span>
            </div>
        </div>`
    );

    document.getElementById("find-route-btn").addEventListener("click", async () => {
        const origin = document.getElementById("route-origin").value;
        const dest = document.getElementById("route-dest").value;
        const resultBox = document.getElementById("route-result");

        if (origin === dest) {
            resultBox.innerHTML = `<div class="error-card"><strong>Invalid selection</strong><span>Origin and destination must be different.</span></div>`;
            return;
        }

        resultBox.innerHTML = `<div class="view-loading" style="padding:24px">Calculating route...</div>`;

        try {
            const route = await fetchJSON(`/route/${origin}/${dest}`);
            console.log("Route:", route);

            const zonePath = (route.zone_path || []).join(" → ");
            const roadPath = (route.road_path || []).join(", ");

            resultBox.innerHTML = `
                <div class="data-card" style="margin-top:8px">
                    <div class="result-label" style="margin-bottom:12px">ROUTE FOUND</div>
                    <div class="deployment-result-route" style="margin-bottom:16px">
                        <strong>${escapeHTML(origin)}</strong>
                        <span>→</span>
                        <strong>${escapeHTML(dest)}</strong>
                    </div>
                    <div class="deployment-result-meta">
                        <span>DISTANCE<strong>${escapeHTML(String(route.total_distance_km ?? "—"))} km</strong></span>
                        <span>TIME<strong>${escapeHTML(String(route.total_travel_time_min ?? "—"))} min</strong></span>
                    </div>
                    <div style="margin-top:14px">
                        <span class="data-label">ZONE PATH</span>
                        <strong style="display:block;margin-top:4px;font-size:13px">${escapeHTML(zonePath || "—")}</strong>
                    </div>
                    <div style="margin-top:12px">
                        <span class="data-label">ROAD PATH</span>
                        <strong style="display:block;margin-top:4px;font-size:13px">${escapeHTML(roadPath || "—")}</strong>
                    </div>
                </div>`;
        } catch (err) {
            resultBox.innerHTML = `<div class="error-card"><strong>No route available</strong><span>${escapeHTML(err.message)}</span></div>`;
        }
    });
}

// ============================================================
// NEW: WORLD CONTROLS PAGE
// ============================================================

async function showWorldControls() {
    setActiveNavigation("world");
    setPage(
        "World Controls",
        "LIVE STATE MANAGEMENT",
        "Update zone conditions and road accessibility in real time.",
        `
        <div class="control-grid two-col">
            <!-- UPDATE ZONE -->
            <div class="data-card control-card">
                <div class="section-heading" style="padding-top:0;margin-bottom:18px">
                    <div>
                        <p class="panel-kicker">ZONE UPDATE</p>
                        <h3>Update Zone Conditions</h3>
                    </div>
                </div>

                <div class="form-group">
                    <label class="data-label">ZONE</label>
                    <select id="zone-id" class="form-select">
                        <option value="Z001">Z001</option>
                        <option value="Z002">Z002</option>
                        <option value="Z003">Z003</option>
                        <option value="Z004">Z004</option>
                    </select>
                </div>

                <div class="form-row" style="margin-top:14px">
                    <div class="form-group">
                        <label class="data-label">WATER DEPTH (m)</label>
                        <input id="zone-water" type="number" min="0" step="0.1" class="form-input" placeholder="e.g. 1.5">
                    </div>
                    <div class="form-group">
                        <label class="data-label">RAINFALL (mm/hr)</label>
                        <input id="zone-rain" type="number" min="0" step="1" class="form-input" placeholder="e.g. 80">
                    </div>
                </div>

                <div class="form-group" style="margin-top:14px">
                    <label class="data-label">ACCESSIBILITY (%)</label>
                    <input id="zone-access" type="number" min="0" max="100" step="1" class="form-input" placeholder="0 – 100">
                </div>

                <button id="update-zone-btn" class="primary-button" style="width:100%;margin-top:18px">
                    Update Zone
                </button>
                <div id="zone-result" style="margin-top:14px"></div>
            </div>

            <!-- UPDATE ROAD -->
            <div class="data-card control-card">
                <div class="section-heading" style="padding-top:0;margin-bottom:18px">
                    <div>
                        <p class="panel-kicker">ROAD UPDATE</p>
                        <h3>Update Road Status</h3>
                    </div>
                </div>

                <div class="form-group">
                    <label class="data-label">ROAD</label>
                    <select id="road-id" class="form-select">
                        <option value="R001">R001 (Z002 → Z001)</option>
                        <option value="R002">R002 (Z002 → Z003)</option>
                        <option value="R003">R003 (Z003 → Z004)</option>
                        <option value="R004">R004 (Z002 → Z004)</option>
                    </select>
                </div>

                <div class="form-group" style="margin-top:14px">
                    <label class="data-label">ACCESSIBILITY (%)</label>
                    <input id="road-access" type="number" min="0" max="100" step="1" class="form-input" placeholder="0 – 100">
                </div>

                <div class="form-group" style="margin-top:14px">
                    <label class="data-label">BLOCKED</label>
                    <select id="road-blocked" class="form-select">
                        <option value="">— leave unchanged —</option>
                        <option value="true">Yes (Blocked)</option>
                        <option value="false">No (Open)</option>
                    </select>
                </div>

                <button id="update-road-btn" class="primary-button" style="width:100%;margin-top:18px">
                    Update Road
                </button>
                <div id="road-result" style="margin-top:14px"></div>
            </div>
        </div>

        <div class="info-card" style="margin-top:8px">
            <strong>Tip</strong>
            <span>
                After updating a zone or road, go back to the Dashboard or Risk Overview and click
                “Run Flood Simulation” or “Generate Response Plan” to see the impact of your changes.
            </span>
        </div>`
    );

    // Zone update handler
    document.getElementById("update-zone-btn").addEventListener("click", async () => {
        const zoneId = document.getElementById("zone-id").value;
        const water = document.getElementById("zone-water").value;
        const rain = document.getElementById("zone-rain").value;
        const access = document.getElementById("zone-access").value;
        const box = document.getElementById("zone-result");

        const body = {};
        if (water !== "") body.water_depth_m = Number(water);
        if (rain !== "") body.rainfall_mm_per_hr = Number(rain);
        if (access !== "") body.accessibility_percent = Number(access);

        if (Object.keys(body).length === 0) {
            box.innerHTML = `<div class="error-card"><strong>Nothing to update</strong><span>Fill at least one field.</span></div>`;
            return;
        }

        box.innerHTML = `<div class="view-loading" style="padding:16px">Updating zone...</div>`;

        try {
            const res = await fetchJSON(`/world/zones/${zoneId}/update`, {
                method: "POST",
                body: JSON.stringify(body),
            });
            box.innerHTML = `
                <div class="data-card" style="border-color:rgba(53,208,127,0.3)">
                    <div class="result-label" style="color:var(--success)">ZONE UPDATED</div>
                    <strong>${escapeHTML(zoneId)}</strong> successfully updated.
                </div>`;
            console.log("Zone update:", res);
        } catch (err) {
            box.innerHTML = `<div class="error-card"><strong>Update failed</strong><span>${escapeHTML(err.message)}</span></div>`;
        }
    });

    // Road update handler
    document.getElementById("update-road-btn").addEventListener("click", async () => {
        const roadId = document.getElementById("road-id").value;
        const access = document.getElementById("road-access").value;
        const blockedVal = document.getElementById("road-blocked").value;
        const box = document.getElementById("road-result");

        const body = {};
        if (access !== "") body.accessibility_percent = Number(access);
        if (blockedVal !== "") body.blocked = blockedVal === "true";

        if (Object.keys(body).length === 0) {
            box.innerHTML = `<div class="error-card"><strong>Nothing to update</strong><span>Fill at least one field.</span></div>`;
            return;
        }

        box.innerHTML = `<div class="view-loading" style="padding:16px">Updating road...</div>`;

        try {
            const res = await fetchJSON(`/world/roads/${roadId}/update`, {
                method: "POST",
                body: JSON.stringify(body),
            });
            box.innerHTML = `
                <div class="data-card" style="border-color:rgba(53,208,127,0.3)">
                    <div class="result-label" style="color:var(--success)">ROAD UPDATED</div>
                    <strong>${escapeHTML(roadId)}</strong> successfully updated.
                </div>`;
            console.log("Road update:", res);
            // refresh map roads if we are later on dashboard
            await loadRoadNetwork();
        } catch (err) {
            box.innerHTML = `<div class="error-card"><strong>Update failed</strong><span>${escapeHTML(err.message)}</span></div>`;
        }
    });
}

// ============================================================
// NAVIGATION INIT
// ============================================================

function initializeNavigation() {
    const main = document.querySelector(".main-content");
    if (!main) return;
    if (dashboardHTML === null) dashboardHTML = main.innerHTML;

    const views = ["dashboard", "risk", "roads", "resources", "routing", "world"];
    const navItems = document.querySelectorAll(".nav-item");

    navItems.forEach((item, index) => {
        const view = views[index];
        if (!view) return;
        item.dataset.view = view;
        item.setAttribute("href", "#");

        item.addEventListener("click", async (e) => {
            e.preventDefault();
            if (view === "dashboard") await showDashboard();
            else if (view === "risk") await showRiskOverview();
            else if (view === "roads") await showRoadNetwork();
            else if (view === "resources") await showResources();
            else if (view === "routing") await showRouting();
            else if (view === "world") await showWorldControls();
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initializeNavigation();
});