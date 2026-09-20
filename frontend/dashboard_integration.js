/*
 * Real Chennai Dashboard integration.
 *
 * Keeps the existing dashboard layout intact while replacing the remaining
 * demo-zone assumptions with live /risk/overview data.
 */

function getHighestRiskAssessment(overview) {
    const assessments = Array.isArray(overview?.assessments) ? overview.assessments : [];
    if (!assessments.length) return null;
    return assessments.reduce((highest, current) =>
        Number(current.risk_score ?? 0) > Number(highest.risk_score ?? 0) ? current : highest
    );
}

function updateDashboard(overview) {
    const assessments = Array.isArray(overview?.assessments) ? overview.assessments : [];
    setText(".stat-card:nth-child(1) .stat-value", overview?.total_zones ?? assessments.length);
    setText(".stat-card:nth-child(2) .stat-value", overview?.critical_count ?? 0);
    updateNetworkMap(assessments);

    const highest = getHighestRiskAssessment(overview);
    if (highest) updateHighestRisk(highest);
}

function updateHighestRisk(assessment) {
    setText(".incident-id", assessment.zone_id);

    const riskScore = getElement(".incident-risk");
    if (riskScore) {
        riskScore.innerHTML = `${escapeHTML(Number(assessment.risk_score ?? 0).toFixed(2))}<span>/ 100</span>`;
    }

    const riskBadge = getElement(".risk-badge");
    if (riskBadge) {
        const level = String(assessment.risk_level || "normal").toLowerCase();
        riskBadge.textContent = level.toUpperCase();
        riskBadge.classList.remove("normal", "watch", "high", "critical");
        riskBadge.classList.add(level);
    }

    const progressFill = getElement(".risk-progress-fill");
    if (progressFill) {
        progressFill.style.width = `${Math.min(Math.max(Number(assessment.risk_score ?? 0), 0), 100)}%`;
    }

    const factors = assessment.factors || {};
    const conditions = document.querySelectorAll(".condition");
    if (conditions.length >= 4) {
        const water = Number(factors.water_depth_m ?? factors.water ?? 0);
        const rainfall = Number(factors.rainfall_mm_per_hr ?? factors.rainfall ?? 0);
        const accessibilityRisk = Number(factors.accessibility_risk ?? 0);
        const accessibility = factors.accessibility_percent !== undefined
            ? Number(factors.accessibility_percent)
            : Math.max(0, 100 - accessibilityRisk);
        const level = String(assessment.risk_level || "normal").toLowerCase();

        conditions[0].querySelector("strong").textContent = `${water.toFixed(2)} m`;
        conditions[1].querySelector("strong").textContent = `${rainfall.toFixed(0)} mm/hr`;
        conditions[2].querySelector("strong").textContent = `${accessibility.toFixed(0)}%`;
        conditions[3].querySelector("strong").textContent =
            level === "critical" || level === "high" ? "REQUIRED" : "MONITOR";
    }
}

async function generateResponsePlan() {
    const button = getElement(".secondary-button");
    if (!button) return;

    button.disabled = true;
    button.textContent = "Generating...";

    try {
        const overview = await fetchJSON("/risk/overview");
        const target = getHighestRiskAssessment(overview);
        if (!target?.zone_id) throw new Error("No real Chennai ward is available for response planning.");

        const plan = await fetchJSON(`/response/plan/${encodeURIComponent(target.zone_id)}`);
        let html = `
            <div class="result-hero">
                <div>
                    <div class="result-label">RESPONSE PLAN · ${escapeHTML(target.zone_id)}</div>
                    <div class="result-risk">${escapeHTML(Number(target.risk_score ?? 0).toFixed(2))}<span>/ 100</span></div>
                </div>
                <div class="result-level">${escapeHTML(String(target.risk_level || "normal").toUpperCase())}</div>
            </div>`;

        if (plan.actions?.length) {
            html += `<div class="result-section"><div class="result-label">RESPONSE ACTIONS</div><div class="result-list">`;
            plan.actions.forEach((action) => {
                html += `<div class="result-item">${escapeHTML(action.action_type || action.action || action.name || "Action")}</div>`;
            });
            html += `</div></div>`;
        }

        if (plan.allocations?.length) {
            html += `<div class="result-section"><div class="result-label">RESOURCE ALLOCATIONS</div><div class="result-list">`;
            plan.allocations.forEach((allocation) => {
                html += `<div class="result-item"><strong>${escapeHTML(String(allocation.quantity ?? 0))}</strong> × ${escapeHTML(allocation.resource_type || "resource")} → ${escapeHTML(allocation.destination_zone_id || target.zone_id)}</div>`;
            });
            html += `</div></div>`;
        }

        if (plan.deployments?.length) {
            html += `<div class="result-section"><div class="result-label">DEPLOYMENTS</div><div class="result-list">`;
            plan.deployments.forEach((deployment) => {
                const allocation = deployment.allocation || deployment;
                const route = deployment.route || {};
                const source = allocation.source_zone_id || route.origin_zone_id || "source";
                const destination = allocation.destination_zone_id || route.destination_zone_id || target.zone_id;
                const quantity = allocation.quantity ?? 1;
                const resourceType = allocation.resource_type || allocation.resource_id || "Resource";
                const distance = route.total_distance_km;
                const time = route.total_travel_time_min;

                html += `<div class="deployment-result">
                    <div class="deployment-result-top"><strong>${escapeHTML(resourceType)}</strong><span>P${escapeHTML(String(allocation.priority ?? "—"))}</span></div>
                    <div class="deployment-result-route"><strong>${escapeHTML(source)}</strong><span>→</span><strong>${escapeHTML(destination)}</strong></div>
                    <div class="deployment-result-meta"><span>QUANTITY<strong>${escapeHTML(String(quantity))}</strong></span><span>ID<strong>${escapeHTML(allocation.resource_id || "deployment")}</strong></span></div>`;
                if (distance !== undefined || time !== undefined) {
                    html += `<div class="deployment-result-meta" style="margin-top:8px;border-top:none;padding-top:0;"><span>DISTANCE<strong>${escapeHTML(String(distance ?? "—"))} km</strong></span><span>TIME<strong>${escapeHTML(String(time ?? "—"))} min</strong></span></div>`;
                }
                html += `</div>`;
            });
            html += `</div></div>`;
        }

        if (!plan.actions?.length && !plan.allocations?.length && !plan.deployments?.length) {
            html += `<div class="result-section"><div class="result-label">RESPONSE PLAN</div><div class="result-item">No response actions were generated.</div></div>`;
        }

        showModal(`Response Plan — ${target.zone_id}`, html);
    } catch (error) {
        showMessage("Response plan failed", error.message);
    } finally {
        button.disabled = false;
        button.textContent = "Generate Response Plan";
    }
}
