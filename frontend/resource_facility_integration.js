/*
 * Real Chennai facility browser.
 *
 * Facilities are geographic context, not operational inventory. This page
 * deliberately avoids quantities, staffing, capacity, or live availability.
 */

let resourceFacilityCache = null;
let resourceWardCache = null;
let resourceSelectedFacility = null;
let resourceSelectedType = "all";
let resourceSelectedZone = null;

function resourceFacilityIcon(type) {
    const icons = {
        hospital: "✚",
        clinic: "＋",
        fire_station: "◇",
        police_station: "◈",
        shelter: "⌂",
    };
    return icons[type] || "•";
}

function resourceFacilityLabel(type) {
    return String(type || "facility")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resourceFacilityEscape(value) {
    return escapeHTML(value === null || value === undefined ? "" : String(value));
}

async function loadResourceFacilityData() {
    if (resourceFacilityCache && resourceWardCache) return;

    const [facilityPayload, wardGeoJSON] = await Promise.all([
        fetchJSON("/world/facilities"),
        fetchJSON("/world/wards"),
    ]);

    resourceFacilityCache = Array.isArray(facilityPayload?.facilities)
        ? facilityPayload.facilities
        : [];
    resourceWardCache = Array.isArray(wardGeoJSON?.features)
        ? wardGeoJSON.features
        : [];
}

function resourceWardId(feature) {
    const raw = feature?.properties?.ward_id ?? feature?.properties?.ward;
    if (raw === undefined || raw === null || raw === "") return null;
    return String(raw).startsWith("W") ? String(raw) : `W${raw}`;
}

function resourceSortedZones() {
    const ids = new Set();
    (resourceWardCache || []).forEach((feature) => {
        const id = resourceWardId(feature);
        if (id) ids.add(id);
    });
    (resourceFacilityCache || []).forEach((facility) => {
        if (facility.current_zone_id) ids.add(facility.current_zone_id);
    });
    return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function resourceFacilityTypes() {
    return [...new Set((resourceFacilityCache || []).map((facility) => facility.resource_type).filter(Boolean))]
        .sort((a, b) => resourceFacilityLabel(a).localeCompare(resourceFacilityLabel(b)));
}

function resourceZoneFromDashboard() {
    try {
        if (typeof selectedZoneId !== "undefined" && selectedZoneId) return selectedZoneId;
    } catch (_) {}

    const incident = document.querySelector(".incident-id");
    if (incident?.textContent?.trim()) return incident.textContent.trim();

    return null;
}

function renderResourceFacilityPage() {
    const zones = resourceSortedZones();
    const types = resourceFacilityTypes();
    const facilities = resourceFacilityCache || [];
    const wardsWithFacilities = new Set(
        facilities.map((facility) => facility.current_zone_id).filter(Boolean)
    ).size;

    if (!resourceSelectedZone || !zones.includes(resourceSelectedZone)) {
        resourceSelectedZone = resourceZoneFromDashboard() || zones[0] || null;
    }

    const typeButtons = [
        ["all", "All types"],
        ...types.map((type) => [type, resourceFacilityLabel(type)]),
    ].map(([value, label]) => `
        <button class="resource-facility-type-tab ${resourceSelectedType === value ? "active" : ""}"
                data-resource-type="${resourceFacilityEscape(value)}">
            ${resourceFacilityEscape(label)}
        </button>`).join("");

    const zoneOptions = zones.map((zone) => `
        <option value="${resourceFacilityEscape(zone)}" ${zone === resourceSelectedZone ? "selected" : ""}>
            ${resourceFacilityEscape(zone)}
        </option>`).join("");

    setPage(
        "Resources",
        "GEOGRAPHIC RESOURCE INTELLIGENCE",
        "Real Chennai facilities mapped to wards and evaluated against the current road network.",
        `<div class="resource-facility-view" id="resource-facility-view">
            <div class="resource-facility-summary">
                <article class="data-card resource-facility-summary-card">
                    <span class="data-label">MAPPED FACILITIES</span>
                    <strong>${facilities.length.toLocaleString()}</strong>
                    <span>OpenStreetMap facility records</span>
                </article>
                <article class="data-card resource-facility-summary-card">
                    <span class="data-label">WARDS WITH FACILITIES</span>
                    <strong>${wardsWithFacilities.toLocaleString()}</strong>
                    <span>of ${resourceWardCache.length.toLocaleString()} Chennai wards</span>
                </article>
                <article class="data-card resource-facility-summary-card">
                    <span class="data-label">FACILITY TYPES</span>
                    <strong>${types.length}</strong>
                    <span>Hospitals, clinics & response services</span>
                </article>
                <article class="data-card resource-facility-summary-card">
                    <span class="data-label">SELECTED WARD</span>
                    <strong>${resourceFacilityEscape(resourceSelectedZone || "—")}</strong>
                    <span>Routing origin</span>
                </article>
            </div>

            <div class="data-card">
                <div class="resource-facility-controls">
                    <div class="resource-facility-control">
                        <label for="resource-zone-select">ORIGIN / SELECTED WARD</label>
                        <select id="resource-zone-select" class="form-select">${zoneOptions}</select>
                    </div>
                    <div class="resource-facility-control">
                        <label>FACILITY TYPE</label>
                        <div class="resource-facility-type-tabs">${typeButtons}</div>
                    </div>
                </div>
                <div class="resource-facility-disclaimer">
                    Facility records describe geographic presence only. They do not imply beds,
                    staffing, equipment, capacity, readiness, or live operational availability.
                </div>
            </div>

            <div class="resource-facility-layout">
                <div class="resource-facility-list">
                    <div class="data-card resource-facility-list-card">
                        <div class="resource-facility-list-header">
                            <div>
                                <span class="data-label">LOCAL FACILITIES</span>
                                <h3 id="resource-local-title">Facilities in ${resourceFacilityEscape(resourceSelectedZone || "—")}</h3>
                            </div>
                            <span class="facility-zone-badge" id="resource-local-count">—</span>
                        </div>
                        <div class="resource-facility-list-body" id="resource-local-list">
                            <div class="resource-facility-empty">Loading facilities...</div>
                        </div>
                    </div>
                </div>

                <div class="resource-facility-detail">
                    <div class="data-card resource-facility-detail-card" id="resource-facility-detail">
                        <div class="resource-facility-detail-inner">
                            <span class="data-label">FACILITY DETAIL</span>
                            <h3>Select a facility</h3>
                            <p>Select a mapped facility to inspect its geographic metadata.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="data-card resource-facility-list-card">
                <div class="resource-facility-list-header">
                    <div>
                        <span class="data-label">ROUTING-AWARE ACCESS</span>
                        <h3>Nearest accessible facilities from ${resourceFacilityEscape(resourceSelectedZone || "—")}</h3>
                    </div>
                    <span class="facility-zone-badge">TOP 20</span>
                </div>
                <div class="resource-facility-list-body" id="resource-accessible-list">
                    <div class="resource-facility-empty">Calculating current routes...</div>
                </div>
            </div>
        </div>`
    );

    const zoneSelect = document.getElementById("resource-zone-select");
    if (zoneSelect) {
        zoneSelect.addEventListener("change", async (event) => {
            resourceSelectedZone = event.target.value;
            resourceSelectedFacility = null;
            await refreshResourceFacilityLists();
        });
    }

    document.querySelectorAll("[data-resource-type]").forEach((button) => {
        button.addEventListener("click", async () => {
            resourceSelectedType = button.dataset.resourceType || "all";
            document.querySelectorAll("[data-resource-type]").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            resourceSelectedFacility = null;
            renderResourceLocalFacilities();
            renderResourceFacilityDetail(null);
            await loadResourceAccessibleFacilities();
        });
    });

    refreshResourceFacilityLists().catch((error) => {
        const local = document.getElementById("resource-local-list");
        const accessible = document.getElementById("resource-accessible-list");
        const html = `<div class="resource-facility-empty">${resourceFacilityEscape(error.message)}</div>`;
        if (local) local.innerHTML = html;
        if (accessible) accessible.innerHTML = html;
    });
}

function filteredLocalFacilities() {
    return (resourceFacilityCache || []).filter((facility) =>
        facility.current_zone_id === resourceSelectedZone &&
        (resourceSelectedType === "all" || facility.resource_type === resourceSelectedType)
    );
}

function renderResourceLocalFacilities() {
    const list = document.getElementById("resource-local-list");
    const count = document.getElementById("resource-local-count");
    const title = document.getElementById("resource-local-title");
    if (!list) return;

    const facilities = filteredLocalFacilities();
    if (count) count.textContent = String(facilities.length);
    if (title) title.textContent = `Facilities in ${resourceSelectedZone || "—"}`;

    if (!facilities.length) {
        list.innerHTML = `<div class="resource-facility-empty">No mapped facilities match this ward and type.</div>`;
        return;
    }

    list.innerHTML = facilities.map((facility) => `
        <button class="resource-facility-row ${resourceSelectedFacility?.id === facility.id ? "selected" : ""}"
                data-facility-id="${resourceFacilityEscape(facility.id)}">
            <span class="resource-facility-icon">${resourceFacilityEscape(resourceFacilityIcon(facility.resource_type))}</span>
            <span class="resource-facility-name">
                <strong>${resourceFacilityEscape(facility.name || "Unnamed facility")}</strong>
                <span>${resourceFacilityEscape(resourceFacilityLabel(facility.resource_type))} · ${resourceFacilityEscape(facility.id)}</span>
            </span>
            <span class="resource-facility-access accessible">MAPPED</span>
        </button>`).join("");

    list.querySelectorAll("[data-facility-id]").forEach((row) => {
        row.addEventListener("click", () => {
            const facility = facilities.find((item) => item.id === row.dataset.facilityId);
            resourceSelectedFacility = facility || null;
            renderResourceLocalFacilities();
            renderResourceFacilityDetail(facility);
        });
    });
}

function renderResourceFacilityDetail(facility, route = null) {
    const box = document.getElementById("resource-facility-detail");
    if (!box) return;

    if (!facility) {
        box.innerHTML = `
            <div class="resource-facility-detail-inner">
                <span class="data-label">FACILITY DETAIL</span>
                <h3>Select a facility</h3>
                <p>Choose a mapped facility to inspect its geographic metadata and, when available, route context.</p>
            </div>`;
        return;
    }

    const accessible = route?.accessible;
    const distance = route?.total_distance_km;
    const travel = route?.total_travel_time_min;
    const zonePath = route?.zone_path || [];
    const roadPath = route?.road_path || [];

    box.innerHTML = `
        <div class="resource-facility-detail-inner">
            <span class="data-label">${resourceFacilityEscape(resourceFacilityLabel(facility.resource_type))}</span>
            <h3>${resourceFacilityEscape(facility.name || "Unnamed facility")}</h3>
            <p>Geographically mapped facility record. Operational capacity is intentionally not inferred.</p>

            <div class="resource-facility-meta-grid">
                <div><span>FACILITY ID</span><strong>${resourceFacilityEscape(facility.id)}</strong></div>
                <div><span>WARD</span><strong>${resourceFacilityEscape(facility.current_zone_id)}</strong></div>
                <div><span>LATITUDE</span><strong>${resourceFacilityEscape(Number(facility.latitude).toFixed(6))}</strong></div>
                <div><span>LONGITUDE</span><strong>${resourceFacilityEscape(Number(facility.longitude).toFixed(6))}</strong></div>
                <div><span>SOURCE</span><strong>${resourceFacilityEscape(facility.source || "—")}</strong></div>
                <div><span>ROUTE STATUS</span><strong>${accessible === undefined ? "—" : accessible ? "ACCESSIBLE" : "UNREACHABLE"}</strong></div>
            </div>

            ${route ? `
                <div class="resource-facility-meta-grid">
                    <div><span>DISTANCE</span><strong>${distance == null ? "—" : `${Number(distance).toFixed(3)} km`}</strong></div>
                    <div><span>TRAVEL TIME</span><strong>${travel == null ? "—" : `${Number(travel).toFixed(2)} min`}</strong></div>
                </div>
                <div class="resource-facility-path">
                    <span class="resource-facility-path-label">ZONE PATH</span>
                    <div class="resource-facility-path-value">${resourceFacilityEscape(zonePath.length ? zonePath.join(" → ") : "No route")}</div>
                    <span class="resource-facility-path-label" style="margin-top:10px">ROAD PATH</span>
                    <div class="resource-facility-path-value">${resourceFacilityEscape(roadPath.length ? roadPath.join(" → ") : "No route")}</div>
                </div>` : ""}
        </div>`;
}

async function refreshResourceFacilityLists() {
    renderResourceLocalFacilities();
    renderResourceFacilityDetail(null);
    await loadResourceAccessibleFacilities();
}

async function loadResourceAccessibleFacilities() {
    const list = document.getElementById("resource-accessible-list");
    if (!list || !resourceSelectedZone) return;

    list.innerHTML = `<div class="resource-facility-empty">Calculating current routes...</div>`;

    try {
        const typeQuery = resourceSelectedType === "all"
            ? ""
            : `&facility_type=${encodeURIComponent(resourceSelectedType)}`;
        const payload = await fetchJSON(
            `/world/facilities/accessible/${encodeURIComponent(resourceSelectedZone)}?limit=20${typeQuery}`
        );
        const facilities = Array.isArray(payload?.facilities) ? payload.facilities : [];

        if (!facilities.length) {
            list.innerHTML = `<div class="resource-facility-empty">No routing results are available for this selection.</div>`;
            return;
        }

        list.innerHTML = facilities.map((facility) => {
            const status = facility.accessible ? "ACCESSIBLE" : "UNREACHABLE";
            const statusClass = facility.accessible ? "accessible" : "unreachable";
            const distance = facility.total_distance_km == null ? "—" : `${Number(facility.total_distance_km).toFixed(3)} km`;
            const travel = facility.total_travel_time_min == null ? "" : ` · ${Number(facility.total_travel_time_min).toFixed(2)} min`;
            return `
                <button class="resource-facility-row" data-accessible-facility-id="${resourceFacilityEscape(facility.facility_id)}">
                    <span class="resource-facility-icon">${resourceFacilityEscape(resourceFacilityIcon(facility.facility_type))}</span>
                    <span class="resource-facility-name">
                        <strong>${resourceFacilityEscape(facility.facility_name || "Unnamed facility")}</strong>
                        <span>${resourceFacilityEscape(resourceFacilityLabel(facility.facility_type))} · ${resourceFacilityEscape(distance + travel)}</span>
                    </span>
                    <span class="resource-facility-access ${statusClass}">${status}</span>
                </button>`;
        }).join("");

        list.querySelectorAll("[data-accessible-facility-id]").forEach((row) => {
            row.addEventListener("click", () => {
                const result = facilities.find((item) => item.facility_id === row.dataset.accessibleFacilityId);
                if (!result) return;
                const facility = (resourceFacilityCache || []).find((item) => item.id === result.facility_id);
                if (!facility) return;
                resourceSelectedFacility = facility;
                renderResourceLocalFacilities();
                renderResourceFacilityDetail(facility, result);
            });
        });
    } catch (error) {
        list.innerHTML = `<div class="resource-facility-empty">${resourceFacilityEscape(error.message)}</div>`;
    }
}

async function showResources() {
    setActiveNavigation("resources");

    try {
        await loadResourceFacilityData();
        renderResourceFacilityPage();
    } catch (error) {
        setPage(
            "Resources",
            "GEOGRAPHIC RESOURCE INTELLIGENCE",
            "Real Chennai facility data could not be loaded.",
            `<div class="error-card"><strong>Facility data unavailable</strong><span>${resourceFacilityEscape(error.message)}</span></div>`
        );
    }
}
