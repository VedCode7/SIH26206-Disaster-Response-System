/*
 * Real Chennai geography integration.
 *
 * This file intentionally overrides only the Routing page for now.
 * The existing dashboard and World Controls UI remain untouched until
 * their real-ward integration is validated separately.
 */

async function loadRealWardOptions() {
    const overview = await fetchJSON("/risk/overview");
    const assessments = Array.isArray(overview.assessments) ? overview.assessments : [];
    const zones = assessments
        .map((assessment) => assessment.zone_id)
        .filter((zoneId) => typeof zoneId === "string" && zoneId.length > 0)
        .filter((zoneId, index, values) => values.indexOf(zoneId) === index)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!zones.length) throw new Error("No real Chennai wards were returned by /risk/overview.");
    return zones;
}

function buildWardOptions(zones, selectedZone) {
    return zones.map((zoneId) => `
        <option value="${escapeHTML(zoneId)}"${zoneId === selectedZone ? " selected" : ""}>
            ${escapeHTML(zoneId)}
        </option>`).join("");
}

async function showRouting() {
    setActiveNavigation("routing");
    setPage("Routing", "DISASTER-AWARE PATHFINDING", "Calculate the best available route between two Chennai wards.", `
        <div class="control-grid">
            <div class="data-card control-card">
                <div class="section-heading" style="padding-top:0;margin-bottom:18px"><div>
                    <p class="panel-kicker">FIND ROUTE</p><h3>Route Calculator</h3>
                </div></div>
                <div class="view-loading" id="routing-ward-loading" style="padding:16px">Loading 200 Chennai wards...</div>
                <div id="routing-form" hidden>
                    <div class="form-row">
                        <div class="form-group"><label class="data-label">ORIGIN WARD</label><select id="route-origin" class="form-select"></select></div>
                        <div class="form-group"><label class="data-label">DESTINATION WARD</label><select id="route-dest" class="form-select"></select></div>
                    </div>
                    <button id="find-route-btn" class="primary-button" style="width:100%;margin-top:16px">Find Best Route</button>
                </div>
                <div id="route-result" style="margin-top:20px"></div>
            </div>
            <div class="info-card"><strong>How it works</strong><span>Uses the current 6,625-link road network, including accessibility and blocked status, to compute the lowest-cost path between the selected Chennai wards.</span></div>
        </div>`);

    const loadingBox = document.getElementById("routing-ward-loading");
    const form = document.getElementById("routing-form");
    const resultBox = document.getElementById("route-result");
    try {
        const zones = await loadRealWardOptions();
        const origin = document.getElementById("route-origin");
        const dest = document.getElementById("route-dest");
        const defaultOrigin = zones.includes("W18901") ? "W18901" : zones[0];
        const defaultDestination = zones.includes("W18887") && "W18887" !== defaultOrigin ? "W18887" : zones.find((zoneId) => zoneId !== defaultOrigin) || zones[0];
        origin.innerHTML = buildWardOptions(zones, defaultOrigin);
        dest.innerHTML = buildWardOptions(zones, defaultDestination);
        loadingBox.remove();
        form.hidden = false;
        document.getElementById("find-route-btn").addEventListener("click", async () => {
            const originZone = origin.value;
            const destinationZone = dest.value;
            if (originZone === destinationZone) {
                resultBox.innerHTML = `<div class="error-card"><strong>Invalid selection</strong><span>Origin and destination must be different.</span></div>`;
                return;
            }
            resultBox.innerHTML = `<div class="view-loading" style="padding:24px">Calculating route...</div>`;
            try {
                const route = await fetchJSON(`/route/${originZone}/${destinationZone}`);
                const zonePath = (route.zone_path || []).join(" → ");
                const roadPath = (route.road_path || []).join(", ");
                resultBox.innerHTML = `<div class="data-card" style="margin-top:8px">
                    <div class="result-label" style="margin-bottom:12px">ROUTE FOUND</div>
                    <div class="deployment-result-route" style="margin-bottom:16px"><strong>${escapeHTML(originZone)}</strong><span>→</span><strong>${escapeHTML(destinationZone)}</strong></div>
                    <div class="deployment-result-meta"><span>DISTANCE<strong>${escapeHTML(String(route.total_distance_km ?? "—"))} km</strong></span><span>TIME<strong>${escapeHTML(String(route.total_travel_time_min ?? "—"))} min</strong></span></div>
                    <div style="margin-top:14px"><span class="data-label">WARD PATH</span><strong style="display:block;margin-top:4px;font-size:13px">${escapeHTML(zonePath || "—")}</strong></div>
                    <div style="margin-top:12px"><span class="data-label">ROAD PATH</span><strong style="display:block;margin-top:4px;font-size:13px">${escapeHTML(roadPath || "—")}</strong></div>
                </div>`;
            } catch (err) {
                resultBox.innerHTML = `<div class="error-card"><strong>No route available</strong><span>${escapeHTML(err.message)}</span></div>`;
            }
        });
    } catch (error) {
        loadingBox.remove();
        form.hidden = false;
        form.innerHTML = `<div class="error-card"><strong>Ward data unavailable</strong><span>${escapeHTML(error.message)}</span></div>`;
    }
}

// Real Chennai World Controls. This overrides the demo Z001-Z004 page in app.js.
async function showWorldControls() {
    setActiveNavigation("world");
    setPage("World Controls", "LIVE STATE MANAGEMENT", "Update real Chennai ward conditions and road accessibility in real time.", `
        <div class="control-grid two-col">
            <div class="data-card control-card">
                <div class="section-heading" style="padding-top:0;margin-bottom:18px"><div><p class="panel-kicker">WARD UPDATE</p><h3>Update Ward Conditions</h3></div></div>
                <div class="view-loading" id="world-ward-loading" style="padding:16px">Loading 200 Chennai wards...</div>
                <div id="world-ward-form" hidden>
                    <div class="form-group"><label class="data-label">WARD</label><select id="world-zone-id" class="form-select"></select></div>
                    <div class="form-row" style="margin-top:14px">
                        <div class="form-group"><label class="data-label">WATER DEPTH (m)</label><input id="world-zone-water" type="number" min="0" step="0.1" class="form-input" placeholder="e.g. 1.5"></div>
                        <div class="form-group"><label class="data-label">RAINFALL (mm/hr)</label><input id="world-zone-rain" type="number" min="0" step="1" class="form-input" placeholder="e.g. 80"></div>
                    </div>
                    <div class="form-group" style="margin-top:14px"><label class="data-label">ACCESSIBILITY (%)</label><input id="world-zone-access" type="number" min="0" max="100" step="1" class="form-input" placeholder="0 – 100"></div>
                    <button id="world-update-zone-btn" class="primary-button" style="width:100%;margin-top:18px">Update Ward</button>
                </div>
                <div id="world-zone-result" style="margin-top:14px"></div>
            </div>
            <div class="data-card control-card">
                <div class="section-heading" style="padding-top:0;margin-bottom:18px"><div><p class="panel-kicker">ROAD UPDATE</p><h3>Update Real Road Status</h3></div></div>
                <div class="view-loading" id="world-road-loading" style="padding:16px">Loading road network...</div>
                <div id="world-road-form" hidden>
                    <div class="form-group"><label class="data-label">ROAD</label><select id="world-road-id" class="form-select"></select></div>
                    <div class="form-group" style="margin-top:14px"><label class="data-label">ACCESSIBILITY (%)</label><input id="world-road-access" type="number" min="0" max="100" step="1" class="form-input" placeholder="0 – 100"></div>
                    <div class="form-group" style="margin-top:14px"><label class="data-label">BLOCKED</label><select id="world-road-blocked" class="form-select"><option value="">— leave unchanged —</option><option value="true">Yes (Blocked)</option><option value="false">No (Open)</option></select></div>
                    <button id="world-update-road-btn" class="primary-button" style="width:100%;margin-top:18px">Update Road</button>
                </div>
                <div id="world-road-result" style="margin-top:14px"></div>
            </div>
        </div>
        <div class="info-card" style="margin-top:8px"><strong>Real Chennai geography</strong><span>Ward conditions are written to the live world state and road changes affect subsequent routing. Use the Dashboard or Risk Overview afterwards to inspect the resulting risk state.</span></div>`);

    const wardLoading = document.getElementById("world-ward-loading");
    const wardForm = document.getElementById("world-ward-form");
    const roadLoading = document.getElementById("world-road-loading");
    const roadForm = document.getElementById("world-road-form");

    try {
        const overview = await fetchJSON("/risk/overview");
        const zones = (overview.assessments || []).map((assessment) => assessment.zone_id)
            .filter((zoneId) => typeof zoneId === "string" && zoneId.startsWith("W"))
            .filter((zoneId, index, values) => values.indexOf(zoneId) === index)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        if (!zones.length) throw new Error("No real Chennai wards were returned by /risk/overview.");
        document.getElementById("world-zone-id").innerHTML = buildWardOptions(zones, zones.includes("W18887") ? "W18887" : zones[0]);
        wardLoading.remove();
        wardForm.hidden = false;
    } catch (error) {
        wardLoading.remove();
        wardForm.hidden = false;
        wardForm.innerHTML = `<div class="error-card"><strong>Ward data unavailable</strong><span>${escapeHTML(error.message)}</span></div>`;
    }

    try {
        const data = await fetchJSON("/world/roads");
        const roads = Array.isArray(data.roads) ? data.roads : [];
        if (!roads.length) throw new Error("No real Chennai roads were returned by /world/roads.");
        document.getElementById("world-road-id").innerHTML = roads.map((road) => {
            const label = `${road.id} (${road.from_zone_id} → ${road.to_zone_id})`;
            return `<option value="${escapeHTML(road.id)}">${escapeHTML(label)}</option>`;
        }).join("");
        roadLoading.remove();
        roadForm.hidden = false;
    } catch (error) {
        roadLoading.remove();
        roadForm.hidden = false;
        roadForm.innerHTML = `<div class="error-card"><strong>Road data unavailable</strong><span>${escapeHTML(error.message)}</span></div>`;
    }

    document.getElementById("world-update-zone-btn")?.addEventListener("click", async () => {
        const zoneId = document.getElementById("world-zone-id").value;
        const water = document.getElementById("world-zone-water").value;
        const rain = document.getElementById("world-zone-rain").value;
        const access = document.getElementById("world-zone-access").value;
        const box = document.getElementById("world-zone-result");
        const body = {};
        if (water !== "") body.water_depth_m = Number(water);
        if (rain !== "") body.rainfall_mm_per_hr = Number(rain);
        if (access !== "") body.accessibility_percent = Number(access);
        if (!Object.keys(body).length) {
            box.innerHTML = `<div class="error-card"><strong>Nothing to update</strong><span>Fill at least one field.</span></div>`;
            return;
        }
        box.innerHTML = `<div class="view-loading" style="padding:16px">Updating ward...</div>`;
        try {
            await fetchJSON(`/world/zones/${zoneId}/update`, { method: "POST", body: JSON.stringify(body) });
            box.innerHTML = `<div class="data-card" style="border-color:rgba(53,208,127,0.3)"><div class="result-label" style="color:var(--success)">WARD UPDATED</div><strong>${escapeHTML(zoneId)}</strong> successfully updated.</div>`;
        } catch (error) {
            box.innerHTML = `<div class="error-card"><strong>Update failed</strong><span>${escapeHTML(error.message)}</span></div>`;
        }
    });

    document.getElementById("world-update-road-btn")?.addEventListener("click", async () => {
        const roadId = document.getElementById("world-road-id").value;
        const access = document.getElementById("world-road-access").value;
        const blocked = document.getElementById("world-road-blocked").value;
        const box = document.getElementById("world-road-result");
        const body = {};
        if (access !== "") body.accessibility_percent = Number(access);
        if (blocked !== "") body.blocked = blocked === "true";
        if (!Object.keys(body).length) {
            box.innerHTML = `<div class="error-card"><strong>Nothing to update</strong><span>Fill at least one field.</span></div>`;
            return;
        }
        box.innerHTML = `<div class="view-loading" style="padding:16px">Updating road...</div>`;
        try {
            await fetchJSON(`/world/roads/${roadId}/update`, { method: "POST", body: JSON.stringify(body) });
            box.innerHTML = `<div class="data-card" style="border-color:rgba(53,208,127,0.3)"><div class="result-label" style="color:var(--success)">ROAD UPDATED</div><strong>${escapeHTML(roadId)}</strong> successfully updated.</div>`;
        } catch (error) {
            box.innerHTML = `<div class="error-card"><strong>Update failed</strong><span>${escapeHTML(error.message)}</span></div>`;
        }
    });
}
