/*
 * Real Chennai facility intelligence for the dashboard.
 *
 * Facilities are geographical context only. This module deliberately does
 * not display quantities, staffing, capacity, or live operational status.
 * The dashboard combines the complete mapped facility catalogue with the
 * bounded routing result set for the currently selected ward.
 */

let facilityInsightCatalog = null;
let facilityInsightCatalogRequest = null;
let facilityInsightZone = null;
let facilityInsightPanel = null;
let facilityInsightRequestToken = 0;

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

async function loadFacilityInsightCatalog() {
    if (facilityInsightCatalog) return facilityInsightCatalog;
    if (facilityInsightCatalogRequest) return facilityInsightCatalogRequest;

    facilityInsightCatalogRequest = fetchJSON("/world/facilities")
        .then((payload) => {
            facilityInsightCatalog = Array.isArray(payload?.facilities)
                ? payload.facilities
                : [];
            return facilityInsightCatalog;
        })
        .finally(() => {
            facilityInsightCatalogRequest = null;
        });

    return facilityInsightCatalogRequest;
}

function updateFacilityDashboardMetric(mappedCount) {
    const card = document.querySelector(".stat-card:nth-child(3)");
    if (!card) return;

    const label = card.querySelector(".stat-label");
    const value = card.querySelector(".stat-value");
    const description = card.querySelector(".stat-description");

    if (label) label.textContent = "MAPPED FACILITIES";
    if (value) value.textContent = Number(mappedCount || 0).toLocaleString();
    if (description) description.textContent = "OpenStreetMap geographic records";
}

function facilityCountsByType(facilities) {
    const counts = new Map();
    facilities.forEach((facility) => {
        const type = facility.resource_type || "other";
        counts.set(type, (counts.get(type) || 0) + 1);
    });
    return counts;
}

function renderFacilityInsights(catalog, routingPayload, zoneId, panel) {
    if (!panel || !panel.isConnected) return;

    const facilities = Array.isArray(catalog) ? catalog : [];
    const routeResults = Array.isArray(routingPayload?.facilities)
        ? routingPayload.facilities
        : [];
    const accessible = routeResults.filter((facility) => facility.accessible);
    const localFacilities = facilities.filter((facility) => facility.current_zone_id === zoneId);
    const byType = facilityCountsByType(facilities);

    updateFacilityDashboardMetric(facilities.length);

    const preferredTypeOrder = [
        "hospital",
        "clinic",
        "police_station",
        "shelter",
        "fire_station",
    ];

    const typeSummary = preferredTypeOrder
        .filter((type) => byType.has(type))
        .map((type) => `
            <div class="facility-type-chip">
                <span class="facility-type-icon">${facilityInsightEscape(facilityTypeIcon(type))}</span>
                <span>${facilityInsightEscape(facilityTypeLabel(type))}</span>
                <strong>${byType.get(type)}</strong>
            </div>`)
        .join("");

    const nearest = routeResults.slice(0, 3).map((facility) => {
        const distance = Number.isFinite(Number(facility.total_distance_km))
            ? `${Number(facility.total_distance_km).toFixed(2)} km`
            : "Route unavailable";
        const travel = Number.isFinite(Number(facility.total_travel_time_min))
            ? ` · ${Number(facility.total_travel_time_min).toFixed(1)} min`
            : "";
        const statusClass = facility.accessible ? "accessible" : "unreachable";
        const status = facility.accessible ? "OPEN ROUTE" : "NO ROUTE";

        return `
            <div class="dashboard-facility-route-row">
                <div class="dashboard-facility-route-main">
                    <span class="facility-type-icon">${facilityInsightEscape(facilityTypeIcon(facility.facility_type))}</span>
                    <div>
                        <strong>${facilityInsightEscape(facility.facility_name || "Unnamed facility")}</strong>
                        <span>${facilityInsightEscape(facilityTypeLabel(facility.facility_type))} · ${facilityInsightEscape(distance + travel)}</span>
                    </div>
                </div>
                <span class="facility-access ${statusClass}">${status}</span>
            </div>`;
    }).join("");

    panel.dataset.facilityZone = zoneId;
    panel.dataset.facilityRendered = "true";
    panel.innerHTML = `
        <div class="panel-header">
            <div>
                <p class="panel-kicker">FACILITY INTELLIGENCE</p>
                <h3>Nearby Facilities</h3>
            </div>
            <span class="facility-zone-badge">${facilityInsightEscape(zoneId)}</span>
        </div>

        <div class="facility-dashboard-summary">
            <div class="facility-summary-stat">
                <strong>${facilities.length.toLocaleString()}</strong>
                <span>Mapped</span>
            </div>
            <div class="facility-summary-stat">
                <strong>${localFacilities.length.toLocaleString()}</strong>
                <span>In ward</span>
            </div>
            <div class="facility-summary-stat">
                <strong>${accessible.length.toLocaleString()}</strong>
                <span>Accessible</span>
            </div>
        </div>

        <div class="facility-section-label">CITYWIDE FACILITY MIX</div>
        <div class="facility-type-chip-grid">
            ${typeSummary || '<div class="facility-empty">No facility catalogue available.</div>'}
        </div>

        <div class="facility-section-label">ROUTING-AWARE NEARBY RESULTS</div>
        <div class="dashboard-facility-route-list">
            ${nearest || '<div class="facility-empty">No routing results available for this ward.</div>'}
        </div>

        <div class="facility-dashboard-footer">
            ${accessible.length} accessible result${accessible.length === 1 ? "" : "s"} in the current top-${routeResults.length || 20} routing window.
            Geographic presence does not imply operational capacity or live availability.
        </div>`;
}

async function loadFacilityInsights(zoneId, panel) {
    if (!zoneId || !panel) return;

    const requestToken = ++facilityInsightRequestToken;
    const targetPanel = panel;

    try {
        const [catalog, routingPayload] = await Promise.all([
            loadFacilityInsightCatalog(),
            fetchJSON(`/world/facilities/accessible/${encodeURIComponent(zoneId)}?limit=20`),
        ]);

        if (requestToken !== facilityInsightRequestToken) return;
        if (!targetPanel.isConnected) return;

        facilityInsightZone = zoneId;
        facilityInsightPanel = targetPanel;
        renderFacilityInsights(catalog, routingPayload, zoneId, targetPanel);
    } catch (error) {
        if (requestToken !== facilityInsightRequestToken) return;
        console.error("Could not load Chennai facility intelligence:", error);

        if (targetPanel.isConnected) {
            targetPanel.innerHTML = `
                <div class="panel-header">
                    <div>
                        <p class="panel-kicker">FACILITY INTELLIGENCE</p>
                        <h3>Data unavailable</h3>
                    </div>
                </div>
                <div class="facility-empty facility-dashboard-error">
                    Could not load the current geographic facility context.
                    <span>${facilityInsightEscape(error.message)}</span>
                </div>`;
        }
    }
}

function observeFacilityInsightZone() {
    const refresh = () => {
        const panel = document.querySelector(".resources-panel");
        const incidentId = document.querySelector(".incident-id");
        const zoneId = incidentId?.textContent?.trim();

        if (!panel || !zoneId || zoneId === "—") return;

        const panelAlreadyRenderedForZone =
            panel === facilityInsightPanel &&
            panel.dataset.facilityRendered === "true" &&
            panel.dataset.facilityZone === zoneId;

        if (panelAlreadyRenderedForZone) return;

        loadFacilityInsights(zoneId, panel);
    };

    refresh();

    const observer = new MutationObserver(() => {
        window.requestAnimationFrame(refresh);
    });
    observer.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true,
    });

    window.refreshDashboardFacilityInsights = refresh;
}

document.addEventListener("DOMContentLoaded", observeFacilityInsightZone);
