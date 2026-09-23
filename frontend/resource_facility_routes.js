/*
 * Per-resource second-leg routing.
 *
 * This module deliberately renders the route that was missing from the
 * response-plan demonstration:
 *
 *   verified resource -> incident site -> mapped facility
 *
 * The backend supplies resource_facility_routes. No facility capacity or
 * operational readiness is inferred here.
 */

(function () {
    "use strict";

    const SECTION_ID = "response-resource-facility-routes";

    function escapeRoute(value) {
        if (typeof responseEscape === "function") return responseEscape(value);
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatRoute(value, digits) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
        return Number(value).toFixed(digits);
    }

    function label(value) {
        return String(value || "resource")
            .replaceAll("_", " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function routePath(route) {
        if (Array.isArray(route.zone_path) && route.zone_path.length) {
            return route.zone_path.join(" → ");
        }
        return `${route.origin_zone_id} → ${route.destination_zone_id}`;
    }

    function roadPath(route) {
        if (Array.isArray(route.road_path) && route.road_path.length) {
            return route.road_path.join(" → ");
        }
        return "No traversable road path";
    }

    function routeRows(routes) {
        return routes.map((route) => {
            const accessible = route.accessible === true;
            const routeText = accessible
                ? `${formatRoute(route.total_distance_km, 2)} km · ${formatRoute(route.total_travel_time_min, 1)} min`
                : "NO TRAVERSABLE ROUTE";

            return `
                <article class="resource-facility-route-card">
                    <div class="resource-facility-route-header">
                        <div>
                            <span class="resource-facility-kicker">${escapeRoute(label(route.resource_type))}</span>
                            <strong>${escapeRoute(route.resource_id)}</strong>
                        </div>
                        <span class="resource-facility-status ${accessible ? "accessible" : "blocked"}">
                            ${accessible ? "ROUTE AVAILABLE" : "ROUTE UNAVAILABLE"}
                        </span>
                    </div>

                    <div class="resource-facility-chain">
                        <div class="resource-facility-node resource-node">
                            <span>INCIDENT SITE</span>
                            <strong>${escapeRoute(route.origin_zone_id)}</strong>
                        </div>
                        <div class="resource-facility-arrow" aria-hidden="true">→</div>
                        <div class="resource-facility-node facility-node">
                            <span>MAPPED FACILITY</span>
                            <strong>${escapeRoute(route.facility_name || route.facility_id)}</strong>
                            <small>${escapeRoute(label(route.facility_type))} · ${escapeRoute(route.facility_id)}</small>
                        </div>
                    </div>

                    <div class="resource-facility-route-metrics">
                        <div>
                            <span>ROUTE</span>
                            <strong>${escapeRoute(routeText)}</strong>
                        </div>
                        <div>
                            <span>ZONE PATH</span>
                            <strong>${escapeRoute(routePath(route))}</strong>
                        </div>
                        <div>
                            <span>ROAD PATH</span>
                            <strong>${escapeRoute(roadPath(route))}</strong>
                        </div>
                    </div>
                </article>`;
        }).join("");
    }

    function render(plan, zoneId) {
        const body = document.getElementById("response-plan-body");
        if (!body) return;

        document.getElementById(SECTION_ID)?.remove();

        const routes = Array.isArray(plan?.resource_facility_routes)
            ? plan.resource_facility_routes
            : [];

        const section = document.createElement("section");
        section.id = SECTION_ID;
        section.className = "data-card response-section resource-facility-route-section";

        section.innerHTML = `
            <div class="section-heading">
                <div>
                    <span class="data-label">EVACUATION / DESTINATION ROUTING — LEG 2</span>
                    <h3>Incident Site → Mapped Facility by Resource</h3>
                </div>
                <span class="facility-zone-badge">${routes.length} RESOURCE ROUTES</span>
            </div>

            <div class="resource-facility-explanation">
                <strong>Every allocated resource has an explicit second-leg route.</strong>
                <span>
                    The route starts at the incident site after deployment and ends at a mapped facility selected by resource type.
                    Facilities remain geographic destinations only; no capacity, staffing, readiness or live availability is inferred.
                </span>
            </div>

            <div class="resource-facility-route-list">
                ${routes.length
                    ? routeRows(routes)
                    : `<div class="response-empty">
                        No mapped facility route could be constructed for the allocated resources under the current road-network state.
                    </div>`}
            </div>
        `;

        const deploymentSection = Array.from(
            body.querySelectorAll("section.response-section")
        ).find((sectionNode) =>
            sectionNode.textContent.includes("Verified Resource → Incident Site")
        );

        if (deploymentSection) {
            deploymentSection.insertAdjacentElement("afterend", section);
        } else {
            body.prepend(section);
        }
    }

    async function refresh() {
        const select = document.getElementById("response-zone-select");
        const zoneId = select?.value;
        if (!zoneId) return;

        try {
            const plan = await fetchJSON(`/response/plan/${encodeURIComponent(zoneId)}`);
            render(plan, zoneId);
        } catch (error) {
            const body = document.getElementById("response-plan-body");
            if (!body) return;
            document.getElementById(SECTION_ID)?.remove();
            const section = document.createElement("section");
            section.id = SECTION_ID;
            section.className = "data-card response-section resource-facility-route-section";
            section.innerHTML = `
                <div class="section-heading">
                    <div>
                        <span class="data-label">EVACUATION / DESTINATION ROUTING — LEG 2</span>
                        <h3>Incident Site → Mapped Facility by Resource</h3>
                    </div>
                </div>
                <div class="response-empty response-warning">
                    Unable to load second-leg routing: ${escapeRoute(error.message)}
                </div>`;
            body.appendChild(section);
        }
    }

    function installStyles() {
        if (document.getElementById("resource-facility-route-styles")) return;
        const style = document.createElement("style");
        style.id = "resource-facility-route-styles";
        style.textContent = `
            .resource-facility-route-section{margin-bottom:16px}
            .resource-facility-explanation{display:flex;flex-direction:column;gap:5px;padding:13px 15px;margin-bottom:12px;border:1px solid rgba(75,166,255,.18);border-radius:8px;background:rgba(75,166,255,.04);font-size:12px;line-height:1.55}
            .resource-facility-explanation span{color:var(--muted,#8b9bb5)}
            .resource-facility-route-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
            .resource-facility-route-card{padding:15px;border:1px solid rgba(130,155,190,.14);border-radius:9px;background:rgba(130,155,190,.025)}
            .resource-facility-route-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:13px}
            .resource-facility-route-header strong{display:block;font-size:16px;margin-top:3px}
            .resource-facility-kicker{font-size:10px!important;color:var(--muted,#8b9bb5);display:block}
            .resource-facility-status{font-size:9px;padding:5px 7px;border-radius:5px;font-weight:700;white-space:nowrap}
            .resource-facility-status.accessible{color:#35d07f;background:rgba(53,208,127,.10)}
            .resource-facility-status.blocked{color:#ff6670;background:rgba(255,102,112,.10)}
            .resource-facility-chain{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(0,1.5fr);gap:8px;align-items:center}
            .resource-facility-node{padding:11px;border-radius:7px;background:rgba(130,155,190,.05);min-width:0}
            .resource-facility-node span,.resource-facility-route-metrics span{display:block;font-size:9px;color:var(--muted,#8b9bb5)}
            .resource-facility-node strong{display:block;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .resource-facility-node small{display:block;margin-top:3px;color:var(--muted,#8b9bb5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            .resource-facility-arrow{text-align:center;font-size:18px;color:#ffb738}
            .resource-facility-route-metrics{display:grid;grid-template-columns:.8fr 1.2fr 1.2fr;gap:8px;margin-top:10px}
            .resource-facility-route-metrics>div{padding:9px;border-top:1px solid rgba(130,155,190,.10);min-width:0}
            .resource-facility-route-metrics strong{display:block;margin-top:4px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
            @media(max-width:900px){.resource-facility-route-list{grid-template-columns:1fr}.resource-facility-chain{grid-template-columns:1fr}.resource-facility-arrow{transform:rotate(90deg)}}
        `;
        document.head.appendChild(style);
    }

    function install() {
        installStyles();

        const observer = new MutationObserver(() => {
            const body = document.getElementById("response-plan-body");
            if (!body) return;
            if (!document.getElementById(SECTION_ID)) {
                refresh();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        document.addEventListener("change", (event) => {
            if (event.target?.id === "response-zone-select") {
                window.setTimeout(refresh, 50);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", install);
    } else {
        install();
    }
})();
