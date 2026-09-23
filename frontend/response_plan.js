/*
 * Operational Response Plan pane.
 *
 * This view deliberately distinguishes:
 * - generated demand,
 * - verified operational inventory,
 * - actual allocations,
 * - routed deployments,
 * - site-to-facility routing context,
 * - the complete resource -> site -> mapped-facility narrative,
 * - unmet requirements.
 *
 * It never turns mapped facilities or 2015 scenario inventory into live
 * deployable resources.
 */

(function () {
    "use strict";

    const RESPONSE_NAV_ID = "response-plan-nav";

    function responseEscape(value) {
        return escapeHTML(value === null || value === undefined ? "" : String(value));
    }

    function responseResourceLabel(type) {
        return String(type || "resource")
            .replaceAll("_", " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function responseRiskClass(level) {
        return String(level || "normal").toLowerCase();
    }

    function responseFormatNumber(value, digits = 0) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
        return Number(value).toFixed(digits);
    }

    function responseAllocationByType(allocations) {
        const counts = {};
        (allocations || []).forEach((allocation) => {
            const type = allocation.resource_type || "unknown";
            counts[type] = (counts[type] || 0) + Number(allocation.quantity || 0);
        });
        return counts;
    }

    function responseDemandRows(plan) {
        const demands = Array.isArray(plan?.demands) ? plan.demands : [];
        const allocated = responseAllocationByType(plan?.allocations || []);

        if (!demands.length) {
            return `<div class="response-empty">No resource demand was generated for this risk state.</div>`;
        }

        return demands.map((demand) => {
            const fulfilled = Math.min(Number(demand.quantity || 0), allocated[demand.resource_type] || 0);
            const unmet = Math.max(0, Number(demand.quantity || 0) - fulfilled);
            const state = unmet === 0 ? "FULFILLED" : fulfilled > 0 ? "PARTIAL" : "UNMET";
            const stateClass = unmet === 0 ? "fulfilled" : fulfilled > 0 ? "partial" : "unmet";

            return `
                <div class="response-demand-row">
                    <div>
                        <strong>${responseEscape(responseResourceLabel(demand.resource_type))}</strong>
                        <span>Priority ${responseEscape(demand.priority)}</span>
                    </div>
                    <div class="response-demand-numbers">
                        <span>Required <strong>${responseEscape(demand.quantity)}</strong></span>
                        <span>Allocated <strong>${responseEscape(fulfilled)}</strong></span>
                        <span>Unmet <strong>${responseEscape(unmet)}</strong></span>
                    </div>
                    <span class="response-state ${stateClass}">${state}</span>
                </div>`;
        }).join("");
    }

    function responseInventoryRows(plan) {
        const inventory = Array.isArray(plan?.resource_inventory)
            ? plan.resource_inventory
            : [];

        if (!inventory.length) {
            return `
                <div class="response-empty response-warning">
                    <strong>NO VERIFIED OPERATIONAL RESOURCES REGISTERED</strong>
                    <span>
                        The system will not fabricate ambulances, rescue teams or boats.
                        Current allocations therefore remain unserved until verified units are registered.
                    </span>
                </div>`;
        }

        return inventory.map((resource) => `
            <div class="response-resource-row">
                <div>
                    <strong>${responseEscape(resource.id)}</strong>
                    <span>${responseEscape(responseResourceLabel(resource.resource_type))}</span>
                </div>
                <div>
                    <span>LOCATION</span>
                    <strong>${responseEscape(resource.current_zone_id)}</strong>
                </div>
                <div>
                    <span>STATUS</span>
                    <strong>${responseEscape(String(resource.status || "unknown").replaceAll("_", " ").toUpperCase())}</strong>
                </div>
                <div>
                    <span>OPERATOR</span>
                    <strong>${responseEscape(resource.operator || "—")}</strong>
                </div>
            </div>`).join("");
    }

    function responseAllocationRows(plan) {
        const allocations = Array.isArray(plan?.allocations) ? plan.allocations : [];
        const deployments = Array.isArray(plan?.deployments) ? plan.deployments : [];

        if (!allocations.length) {
            return `<div class="response-empty">No resources are currently allocated to this ward.</div>`;
        }

        return allocations.map((allocation) => {
            const deployment = deployments.find((item) =>
                item.allocation?.resource_id === allocation.resource_id
            );
            const route = deployment?.route;
            const routeText = route
                ? `${responseFormatNumber(route.total_distance_km, 2)} km · ${responseFormatNumber(route.total_travel_time_min, 1)} min`
                : "Route unavailable";

            return `
                <div class="response-allocation-row">
                    <div>
                        <strong>${responseEscape(allocation.resource_id)}</strong>
                        <span>${responseEscape(responseResourceLabel(allocation.resource_type))}</span>
                    </div>
                    <div>
                        <span>FROM</span>
                        <strong>${responseEscape(allocation.source_zone_id)}</strong>
                    </div>
                    <div>
                        <span>TO</span>
                        <strong>${responseEscape(allocation.destination_zone_id)}</strong>
                    </div>
                    <div>
                        <span>ROUTE</span>
                        <strong>${responseEscape(routeText)}</strong>
                    </div>
                </div>`;
        }).join("");
    }

    function responseFacilityRecommendations(plan) {
        return Array.isArray(plan?.facility_recommendations)
            ? plan.facility_recommendations
            : [];
    }

    function responsePrimaryFacility(plan) {
        const recommendations = responseFacilityRecommendations(plan);
        const accessible = recommendations.filter((item) => item.accessible);
        if (!accessible.length) return null;

        // Prefer a non-zero cross-zone leg for the demonstration so the
        // operator can see the second routing leg. Fall back to the nearest
        // accessible mapped facility when no cross-zone route exists.
        return accessible.find((item) =>
            item.destination_zone_id && item.destination_zone_id !== item.origin_zone_id
        ) || accessible[0];
    }

    function responseFacilityRows(plan) {
        const recommendations = responseFacilityRecommendations(plan);

        if (!recommendations.length) {
            return `<div class="response-empty">No mapped facility routing context is available for this site.</div>`;
        }

        return recommendations.slice(0, 8).map((facility) => {
            const routeText = facility.accessible
                ? `${responseFormatNumber(facility.total_distance_km, 2)} km · ${responseFormatNumber(facility.total_travel_time_min, 1)} min`
                : "No traversable route";
            const pathText = Array.isArray(facility.zone_path) && facility.zone_path.length
                ? facility.zone_path.join(" → ")
                : `${facility.origin_zone_id} → ${facility.destination_zone_id}`;

            return `
                <div class="response-facility-row">
                    <div>
                        <strong>${responseEscape(facility.facility_name || facility.facility_id)}</strong>
                        <span>${responseEscape(responseResourceLabel(facility.facility_type))} · ${responseEscape(facility.facility_id)}</span>
                    </div>
                    <div>
                        <span>SITE → FACILITY</span>
                        <strong>${responseEscape(pathText)}</strong>
                    </div>
                    <div>
                        <span>ROUTE</span>
                        <strong class="${facility.accessible ? "route-accessible" : "route-unavailable"}">${responseEscape(routeText)}</strong>
                    </div>
                </div>`;
        }).join("");
    }

    function responseChainRows(plan) {
        const allocations = Array.isArray(plan?.allocations) ? plan.allocations : [];
        const deployments = Array.isArray(plan?.deployments) ? plan.deployments : [];
        const facility = responsePrimaryFacility(plan);

        if (!allocations.length) {
            return `<div class="response-empty">No allocated operational unit is available to construct the response chain.</div>`;
        }

        return allocations.map((allocation) => {
            const deployment = deployments.find((item) =>
                item.allocation?.resource_id === allocation.resource_id
            );
            const resourceRoute = deployment?.route;
            const resourceRouteText = resourceRoute
                ? `${responseFormatNumber(resourceRoute.total_distance_km, 2)} km · ${responseFormatNumber(resourceRoute.total_travel_time_min, 1)} min`
                : "Route unavailable";

            const facilityRouteText = facility?.accessible
                ? `${responseFormatNumber(facility.total_distance_km, 2)} km · ${responseFormatNumber(facility.total_travel_time_min, 1)} min`
                : "No traversable facility route";

            return `
                <div class="response-chain-card">
                    <div class="response-chain-step">
                        <span class="response-chain-index">1</span>
                        <div>
                            <span>VERIFIED RESOURCE → INCIDENT SITE</span>
                            <strong>${responseEscape(allocation.resource_id)} → ${responseEscape(allocation.destination_zone_id)}</strong>
                            <small>${responseEscape(resourceRouteText)}</small>
                        </div>
                    </div>
                    <div class="response-chain-arrow" aria-hidden="true">↓</div>
                    <div class="response-chain-step facility-step">
                        <span class="response-chain-index">2</span>
                        <div>
                            <span>INCIDENT SITE → MAPPED FACILITY</span>
                            <strong>${facility ? responseEscape(facility.facility_name || facility.facility_id) : "No mapped destination"}</strong>
                            <small>${facility ? responseEscape(`${facility.destination_zone_id} · ${facilityRouteText}`) : "No accessible facility route returned"}</small>
                        </div>
                    </div>
                </div>`;
        }).join("");
    }

    function responseActionRows(plan) {
        const actions = Array.isArray(plan?.actions) ? plan.actions : [];
        if (!actions.length) return `<div class="response-empty">No operational actions generated.</div>`;

        return actions.map((action, index) => `
            <div class="response-action-row">
                <span class="response-action-number">${index + 1}</span>
                <div>
                    <strong>${responseEscape(action.action || action.title || action.description || "Response action")}</strong>
                    <span>${responseEscape(action.description || action.rationale || "Operational response action")}</span>
                </div>
            </div>`).join("");
    }

    function responseInsertNav() {
        if (document.getElementById(RESPONSE_NAV_ID)) return;

        const navigation = document.querySelector(".navigation");
        if (!navigation) return;

        const item = document.createElement("a");
        item.id = RESPONSE_NAV_ID;
        item.href = "#";
        item.className = "nav-item response-plan-nav-item";
        item.innerHTML = `<span>🚨</span>Response Plan`;
        navigation.appendChild(item);

        item.addEventListener("click", async (event) => {
            event.preventDefault();
            await responseShowPage();
        });
    }

    function responseSetActive() {
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
        const item = document.getElementById(RESPONSE_NAV_ID);
        if (item) item.classList.add("active");
    }

    async function responseShowPage() {
        responseSetActive();

        setPage(
            "Response Plan",
            "OPERATIONAL RESPONSE COORDINATION",
            "Translate the current ward risk state into explicit demand, verified allocation and route-aware deployment decisions.",
            `<div id="response-plan-view">
                <div class="view-loading">Loading operational response plan...</div>
            </div>`
        );

        const view = document.getElementById("response-plan-view");
        if (!view) return;

        try {
            const overview = await fetchJSON("/risk/overview");
            const assessments = Array.isArray(overview?.assessments) ? overview.assessments : [];
            const highest = assessments.reduce(
                (current, item) => !current || Number(item.risk_score || 0) > Number(current.risk_score || 0) ? item : current,
                null
            );

            if (!assessments.length) {
                view.innerHTML = `<div class="error-card"><strong>No risk assessments available</strong><span>The response planner cannot determine a target ward.</span></div>`;
                return;
            }

            const zoneOptions = assessments
                .slice()
                .sort((a, b) => Number(b.risk_score || 0) - Number(a.risk_score || 0))
                .map((assessment) => `
                    <option value="${responseEscape(assessment.zone_id)}">
                        ${responseEscape(assessment.zone_id)} · ${responseEscape(String(assessment.risk_level || "NORMAL").toUpperCase())} · ${responseFormatNumber(assessment.risk_score, 1)}/100
                    </option>`)
                .join("");

            view.innerHTML = `
                <div class="response-plan-toolbar data-card">
                    <div>
                        <span class="data-label">TARGET WARD</span>
                        <h3>Build operational plan</h3>
                    </div>
                    <select id="response-zone-select" class="form-select">${zoneOptions}</select>
                    <button id="response-refresh-btn" class="primary-button">Refresh Plan</button>
                </div>
                <div id="response-plan-body"></div>`;

            const select = document.getElementById("response-zone-select");
            if (select && highest) select.value = highest.zone_id;

            const refresh = async () => {
                const zoneId = select?.value;
                if (!zoneId) return;
                await responseRenderPlan(zoneId, assessments, document.getElementById("response-plan-body"));
            };

            document.getElementById("response-refresh-btn")?.addEventListener("click", refresh);
            select?.addEventListener("change", refresh);
            await refresh();
        } catch (error) {
            view.innerHTML = `<div class="error-card"><strong>Response plan unavailable</strong><span>${responseEscape(error.message)}</span></div>`;
        }
    }

    async function responseRenderPlan(zoneId, assessments, body) {
        if (!body) return;
        body.innerHTML = `<div class="view-loading">Recalculating plan for ${responseEscape(zoneId)}...</div>`;

        try {
            const [plan, roads] = await Promise.all([
                fetchJSON(`/response/plan/${encodeURIComponent(zoneId)}`),
                fetchJSON("/world/roads"),
            ]);

            const assessment = assessments.find((item) => item.zone_id === zoneId);
            const level = responseRiskClass(plan.risk_level);
            const demands = Array.isArray(plan.demands) ? plan.demands : [];
            const inventory = Array.isArray(plan.resource_inventory) ? plan.resource_inventory : [];
            const allocations = Array.isArray(plan.allocations) ? plan.allocations : [];
            const deployments = Array.isArray(plan.deployments) ? plan.deployments : [];
            const facilityRecommendations = responseFacilityRecommendations(plan);
            const blockedRoads = (roads?.roads || []).filter((road) => road.blocked).length;
            const totalRequired = demands.reduce((sum, demand) => sum + Number(demand.quantity || 0), 0);
            const totalAllocated = allocations.reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0);
            const totalUnmet = Math.max(0, totalRequired - totalAllocated);
            const primaryFacility = responsePrimaryFacility(plan);

            body.innerHTML = `
                <div class="response-hero-grid">
                    <article class="data-card response-hero-card">
                        <span class="data-label">TARGET</span>
                        <strong>${responseEscape(zoneId)}</strong>
                        <span>Current ward assessment</span>
                    </article>
                    <article class="data-card response-hero-card">
                        <span class="data-label">RISK</span>
                        <strong class="risk-text-${responseEscape(level)}">${responseEscape(String(plan.risk_level || "NORMAL").toUpperCase())}</strong>
                        <span>${responseFormatNumber(assessment?.risk_score, 2)} / 100</span>
                    </article>
                    <article class="data-card response-hero-card">
                        <span class="data-label">RESOURCE DEMAND</span>
                        <strong>${totalRequired}</strong>
                        <span>${demands.length} demand categories</span>
                    </article>
                    <article class="data-card response-hero-card">
                        <span class="data-label">UNMET</span>
                        <strong class="danger-number">${totalUnmet}</strong>
                        <span>No fabricated capacity</span>
                    </article>
                </div>

                <div class="response-notice ${inventory.length ? "verified" : "warning"}">
                    <strong>${inventory.length ? "VERIFIED OPERATIONAL INVENTORY CONNECTED" : "NO VERIFIED OPERATIONAL INVENTORY"}</strong>
                    <span>
                        ${inventory.length
                            ? `${inventory.length} individually tracked operational resource(s) are visible to the live planner.`
                            : "This plan will report unmet demand rather than substitute the historical 2015 scenario inventory."}
                    </span>
                </div>

                <div class="response-section-grid">
                    <section class="data-card response-section">
                        <div class="section-heading"><div><span class="data-label">REQUIREMENTS</span><h3>Resource Demand</h3></div></div>
                        <div class="response-demand-list">${responseDemandRows(plan)}</div>
                    </section>

                    <section class="data-card response-section">
                        <div class="section-heading"><div><span class="data-label">LIVE INVENTORY</span><h3>Verified Resources</h3></div></div>
                        <div class="response-resource-list">${responseInventoryRows(plan)}</div>
                    </section>
                </div>

                <section class="data-card response-section">
                    <div class="section-heading">
                        <div><span class="data-label">DEPLOYMENT — LEG 1</span><h3>Verified Resource → Incident Site</h3></div>
                        <span class="facility-zone-badge">${deployments.length} ROUTED</span>
                    </div>
                    <div class="response-allocation-list">${responseAllocationRows(plan)}</div>
                </section>

                <section class="data-card response-section">
                    <div class="section-heading">
                        <div>
                            <span class="data-label">FACILITY ACCESS — LEG 2</span>
                            <h3>Incident Site → Mapped Facility</h3>
                        </div>
                        <span class="facility-zone-badge">${facilityRecommendations.length} FACILITY ROUTES</span>
                    </div>
                    <div class="response-facility-summary">
                        <div>
                            <span>ORIGIN SITE</span>
                            <strong>${responseEscape(zoneId)}</strong>
                        </div>
                        <div>
                            <span>PRIMARY MAPPED DESTINATION</span>
                            <strong>${primaryFacility ? responseEscape(primaryFacility.facility_name || primaryFacility.facility_id) : "No accessible facility"}</strong>
                        </div>
                        <div>
                            <span>ROUTE</span>
                            <strong>${primaryFacility?.accessible ? `${responseFormatNumber(primaryFacility.total_distance_km, 2)} km · ${responseFormatNumber(primaryFacility.total_travel_time_min, 1)} min` : "No traversable route"}</strong>
                        </div>
                    </div>
                    <div class="response-facility-list">${responseFacilityRows(plan)}</div>
                </section>

                <section class="data-card response-section response-chain-section">
                    <div class="section-heading">
                        <div>
                            <span class="data-label">END-TO-END RESPONSE CHAIN</span>
                            <h3>Resource → Site → Facility</h3>
                        </div>
                        <span class="facility-zone-badge">TWO-LEG ROUTING</span>
                    </div>
                    <div class="response-chain-list">${responseChainRows(plan)}</div>
                    <p class="response-disclaimer">
                        Leg 1 uses verified operational resources. Leg 2 uses mapped facilities only as routing destinations. A mapped facility does not establish beds, staffing, equipment, capacity or live readiness, and is not converted into operational inventory.
                    </p>
                </section>

                <div class="response-section-grid">
                    <section class="data-card response-section">
                        <div class="section-heading"><div><span class="data-label">ACTION ORDER</span><h3>Recommended Actions</h3></div></div>
                        <div class="response-action-list">${responseActionRows(plan)}</div>
                    </section>

                    <section class="data-card response-section">
                        <div class="section-heading"><div><span class="data-label">NETWORK CONDITIONS</span><h3>Deployment Context</h3></div></div>
                        <div class="response-context-grid">
                            <div><span>BLOCKED ROADS</span><strong>${blockedRoads}</strong></div>
                            <div><span>ALLOCATED UNITS</span><strong>${totalAllocated}</strong></div>
                            <div><span>ROUTED DEPLOYMENTS</span><strong>${deployments.length}</strong></div>
                            <div><span>FACILITY ROUTES</span><strong>${facilityRecommendations.length}</strong></div>
                        </div>
                        <p class="response-disclaimer">
                            Facilities are geographic context only. A mapped hospital, fire station or shelter is not treated as a deployable resource unless an individually tracked operational resource is registered.
                        </p>
                    </section>
                </div>`;
        } catch (error) {
            body.innerHTML = `<div class="error-card"><strong>Plan calculation failed</strong><span>${responseEscape(error.message)}</span></div>`;
        }
    }

    function injectResponseStyles() {
        if (document.getElementById("response-plan-styles")) return;
        const style = document.createElement("style");
        style.id = "response-plan-styles";
        style.textContent = `
            .response-plan-toolbar{display:grid;grid-template-columns:1fr minmax(280px,420px) auto;gap:18px;align-items:end;margin-bottom:18px}
            .response-hero-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:16px}
            .response-hero-card strong{display:block;font-size:24px;margin:7px 0 3px}
            .response-section-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-bottom:16px}
            .response-section{min-width:0;margin-bottom:16px}
            .response-demand-row,.response-resource-row,.response-allocation-row,.response-action-row,.response-facility-row{display:grid;gap:12px;align-items:center;padding:13px 0;border-top:1px solid rgba(130,155,190,.12)}
            .response-demand-row{grid-template-columns:1.2fr 2fr auto}
            .response-resource-row{grid-template-columns:1.4fr 1fr 1.2fr 1.3fr}
            .response-allocation-row{grid-template-columns:1.3fr .8fr .8fr 1.6fr}
            .response-action-row{grid-template-columns:34px 1fr}
            .response-facility-row{grid-template-columns:1.3fr 1.3fr 1fr}
            .response-demand-row:first-child,.response-resource-row:first-child,.response-allocation-row:first-child,.response-action-row:first-child,.response-facility-row:first-child{border-top:0}
            .response-demand-row span,.response-resource-row span,.response-allocation-row span,.response-action-row span,.response-facility-row span,.response-facility-summary span,.response-chain-step span{display:block;font-size:11px;color:var(--muted,#8b9bb5)}
            .response-demand-numbers{display:flex;gap:16px}
            .response-state{padding:5px 8px;border-radius:6px;text-align:center;font-size:10px!important;font-weight:700}
            .response-state.fulfilled{color:#35d07f;background:rgba(53,208,127,.10)}
            .response-state.partial{color:#ffb738;background:rgba(255,183,56,.10)}
            .response-state.unmet{color:#ff6670;background:rgba(255,102,112,.10)}
            .response-notice{display:flex;justify-content:space-between;gap:18px;align-items:center;padding:14px 16px;border-radius:8px;margin-bottom:16px;border:1px solid rgba(255,102,112,.25);background:rgba(255,102,112,.05)}
            .response-notice.verified{border-color:rgba(53,208,127,.25);background:rgba(53,208,127,.05)}
            .response-notice strong{font-size:12px}
            .response-notice span{font-size:12px;color:var(--muted,#8b9bb5)}
            .response-empty{padding:18px;border:1px dashed rgba(130,155,190,.20);border-radius:7px;color:var(--muted,#8b9bb5);font-size:12px}
            .response-empty.response-warning{display:flex;flex-direction:column;gap:6px;color:#ffb738;border-color:rgba(255,183,56,.25)}
            .response-context-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
            .response-context-grid div{padding:12px;border-radius:7px;background:rgba(130,155,190,.05)}
            .response-context-grid span{font-size:10px;color:var(--muted,#8b9bb5)}
            .response-context-grid strong{display:block;margin-top:5px}
            .response-disclaimer{font-size:11px;line-height:1.6;color:var(--muted,#8b9bb5);margin:14px 0 0}
            .response-action-number{display:grid!important;place-items:center;width:28px;height:28px;border-radius:50%;background:rgba(75,166,255,.10);color:#65b4ff;font-weight:700}
            .response-facility-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:10px}
            .response-facility-summary>div{padding:12px;border-radius:7px;background:rgba(130,155,190,.05)}
            .response-facility-summary strong{display:block;margin-top:5px}
            .route-accessible{color:#35d07f}.route-unavailable{color:#ff6670}
            .response-chain-section{overflow:hidden}
            .response-chain-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
            .response-chain-card{padding:15px;border:1px solid rgba(130,155,190,.12);border-radius:9px;background:rgba(130,155,190,.025)}
            .response-chain-step{display:grid;grid-template-columns:32px 1fr;gap:10px;align-items:start}
            .response-chain-step strong{display:block;margin:5px 0 3px}
            .response-chain-step small{display:block;color:var(--muted,#8b9bb5);font-size:11px}
            .response-chain-index{display:grid!important;place-items:center;width:28px;height:28px;border-radius:50%;background:rgba(255,183,56,.12);color:#ffb738;font-weight:700}
            .facility-step .response-chain-index{background:rgba(53,208,127,.12);color:#35d07f}
            .response-chain-arrow{text-align:center;color:var(--muted,#8b9bb5);font-size:18px;line-height:22px}
            .risk-text-critical{color:#ff6670}.risk-text-high{color:#ff8a5c}.risk-text-watch{color:#ffb738}.risk-text-normal{color:#35d07f}
            @media(max-width:900px){.response-hero-grid,.response-section-grid,.response-chain-list{grid-template-columns:1fr 1fr}.response-plan-toolbar{grid-template-columns:1fr}.response-resource-row,.response-allocation-row,.response-facility-row{grid-template-columns:1fr 1fr}.response-facility-summary{grid-template-columns:1fr}}
            @media(max-width:620px){.response-hero-grid,.response-section-grid,.response-chain-list{grid-template-columns:1fr}.response-demand-row,.response-facility-row{grid-template-columns:1fr}.response-demand-numbers{flex-wrap:wrap}.response-context-grid{grid-template-columns:1fr 1fr}}
        `;
        document.head.appendChild(style);
    }

    document.addEventListener("DOMContentLoaded", () => {
        injectResponseStyles();
        // Let the existing six-item SPA navigation initialize first. This
        // item is intentionally appended afterwards so its addition cannot
        // shift the positional navigation mapping in app.js.
        setTimeout(responseInsertNav, 0);
    });
})();
