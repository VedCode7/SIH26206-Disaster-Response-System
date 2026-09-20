/*
 * Real Chennai facility intelligence for the dashboard.
 *
 * Facilities are geographical context only. This module deliberately does
 * not display quantities, staffing, capacity, or live operational status.
 * The dashboard consumes the routing endpoint's bounded top-20 result set.
 */

let facilityInsightRequest = null;
let facilityInsightZone = null;

function facilityInsightEscape(value) {
    return escapeHTML(value === null || value === undefined ? "" : String(value));
}

function facilityTypeLabel(type) {
    return String(type || "facility")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function facilityTypeIcon(type) {
    const icons = {
        hospital: "✚",
        clinic: "＋",
        fire_station: "◇",
        police_station: "◈",
        shelter: "⌂",
    };
    return icons[type] || "•";
}

function updateFacilityDashboardMetric(reachableCount) {
    const card = document.querySelector(".stat-card:nth-child(3)");
    if (!card) return;

    const label = card.querySelector(".stat-label");
    const value = card.querySelector(".stat-value");
    const description = card.querySelector(".stat-description");

    if (label) label.textContent = "ROUTING RESULTS";
    if (value) value.textContent = String(reachableCount);
    if (description) description.textContent = "Accessible facilities in top 20";
}

function renderFacilityInsights(payload) {
    const panel = document.querySelector(".resources-panel");
    if (!panel) return;

    const facilities = Array.isArray(payload?.facilities) ? payload.facilities : [];
    const accessible = facilities.filter((facility) => facility.accessible);
    const byType = new Map();

    updateFacilityDashboardMetric(accessible.length);

    facilities.forEach((facility) => {
        const type = facility.facility_type || "other";
        byType.set(type, (byType.get(type) || 0) + 1);
    });

    const typeSummary = [...byType.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `
            <div class="facility-type-row">
                <span class="facility-type-icon">${facilityInsightEscape(facilityTypeIcon(type))}</span>
                <span>${facilityInsightEscape(facilityTypeLabel(type))}</span>
                <strong>${count}</strong>
            </div>`)
        .join("");

    const recommendations = facilities.slice(0, 5).map((facility) => {
        const distance = facility.total_distance_km === null || facility.total_distance_km === undefined
            ? "No route"
            : `${Number(facility.total_distance_km).toFixed(2)} km`;
        const travel = facility.total_travel_time_min === null || facility.total_travel_time_min === undefined
            ? ""
            : ` · ${Number(facility.total_travel_time_min).toFixed(1)} min`;
        const status = facility.accessible ? "ACCESSIBLE" : "UNREACHABLE";
        const statusClass = facility.accessible ? "accessible" : "unreachable";

        return `
            <div class="facility-recommendation">
                <div class="facility-recommendation-main">
                    <span class="facility-type-icon">${facilityInsightEscape(facilityTypeIcon(facility.facility_type))}</span>
                    <div>
                        <strong>${facilityInsightEscape(facility.facility_name || "Unnamed facility")}</strong>
                        <span>${facilityInsightEscape(facilityTypeLabel(facility.facility_type))} · ${facilityInsightEscape(distance + travel)}</span>
                    </div>
                </div>
                <span class="facility-access ${statusClass}">${status}</span>
            </div>`;
    }).join("");

    panel.innerHTML = `
        <div class="panel-header">
            <div>
                <p class="panel-kicker">FACILITY INTELLIGENCE</p>
                <h3>Routing-Aware Facilities</h3>
            </div>
            <span class="facility-zone-badge">${facilityInsightEscape(payload?.origin_zone_id || "—")}</span>
        </div>

        <div class="facility-summary">
            <div class="facility-summary-stat">
                <strong>${facilities.length}</strong>
                <span>Results</span>
            </div>
            <div class="facility-summary-stat">
                <strong>${accessible.length}</strong>
                <span>Accessible</span>
            </div>
            <div class="facility-summary-stat">
                <strong>${byType.size}</strong>
                <span>Types</span>
            </div>
        </div>

        <div class="facility-section-label">RESULT MIX</div>
        <div class="facility-type-list">
            ${typeSummary || '<div class="facility-empty">No routing results found.</div>'}
        </div>

        <div class="facility-section-label">ROUTING-AWARE RECOMMENDATIONS</div>
        <div class="facility-recommendation-list">
            ${recommendations || '<div class="facility-empty">No facility recommendations available.</div>'}
        </div>

        <div class="facility-disclaimer">
            Results are ranked using the current road network. Geographic accessibility does not
            imply operational capacity, staffing, equipment, or live availability.
        </div>`;
}

async function loadFacilityInsights(zoneId) {
    if (!zoneId || zoneId === facilityInsightZone) return;
    if (facilityInsightRequest) return;

    facilityInsightRequest = (async () => {
        try {
            const payload = await fetchJSON(
                `/world/facilities/accessible/${encodeURIComponent(zoneId)}?limit=20`
            );
            facilityInsightZone = zoneId;
            renderFacilityInsights(payload);
        } catch (error) {
            console.error("Could not load Chennai facility intelligence:", error);
        } finally {
            facilityInsightRequest = null;
        }
    })();

    await facilityInsightRequest;
}

function observeFacilityInsightZone() {
    const main = document.querySelector(".main-content");
    if (!main) return;

    const refresh = () => {
        const incidentId = main.querySelector(".incident-id");
        if (incidentId) loadFacilityInsights(incidentId.textContent.trim());
    };

    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(main, { childList: true, characterData: true, subtree: true });
}

document.addEventListener("DOMContentLoaded", observeFacilityInsightZone);
