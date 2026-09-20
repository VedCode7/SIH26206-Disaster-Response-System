/*
 * Real Chennai geography integration.
 *
 * This file intentionally overrides only the Routing page for now.
 * The existing dashboard and World Controls UI remain untouched until
 * their real-ward integration is validated separately.
 */

async function loadRealWardOptions() {
    const overview = await fetchJSON("/risk/overview");
    const assessments = Array.isArray(overview.assessments)
        ? overview.assessments
        : [];

    const zones = assessments
        .map((assessment) => assessment.zone_id)
        .filter((zoneId) => typeof zoneId === "string" && zoneId.length > 0)
        .filter((zoneId, index, values) => values.indexOf(zoneId) === index)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (!zones.length) {
        throw new Error("No real Chennai wards were returned by /risk/overview.");
    }

    return zones;
}

function buildWardOptions(zones, selectedZone) {
    return zones
        .map((zoneId) => `
            <option value="${escapeHTML(zoneId)}"${zoneId === selectedZone ? " selected" : ""}>
                ${escapeHTML(zoneId)}
            </option>`)
        .join("");
}

async function showRouting() {
    setActiveNavigation("routing");
    setPage(
        "Routing",
        "DISASTER-AWARE PATHFINDING",
        "Calculate the best available route between two Chennai wards.",
        `
        <div class="control-grid">
            <div class="data-card control-card">
                <div class="section-heading" style="padding-top:0;margin-bottom:18px">
                    <div>
                        <p class="panel-kicker">FIND ROUTE</p>
                        <h3>Route Calculator</h3>
                    </div>
                </div>

                <div class="view-loading" id="routing-ward-loading" style="padding:16px">
                    Loading 200 Chennai wards...
                </div>

                <div id="routing-form" hidden>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="data-label">ORIGIN WARD</label>
                            <select id="route-origin" class="form-select"></select>
                        </div>
                        <div class="form-group">
                            <label class="data-label">DESTINATION WARD</label>
                            <select id="route-dest" class="form-select"></select>
                        </div>
                    </div>

                    <button id="find-route-btn" class="primary-button" style="width:100%;margin-top:16px">
                        Find Best Route
                    </button>
                </div>

                <div id="route-result" style="margin-top:20px"></div>
            </div>

            <div class="info-card">
                <strong>How it works</strong>
                <span>
                    Uses the current 6,625-link road network, including accessibility and blocked status,
                    to compute the lowest-cost path between the selected Chennai wards.
                </span>
            </div>
        </div>`
    );

    const loadingBox = document.getElementById("routing-ward-loading");
    const form = document.getElementById("routing-form");
    const resultBox = document.getElementById("route-result");

    try {
        const zones = await loadRealWardOptions();
        const origin = document.getElementById("route-origin");
        const dest = document.getElementById("route-dest");

        // Keep a known-good real-ward pair as the initial route example.
        const defaultOrigin = zones.includes("W18901") ? "W18901" : zones[0];
        const defaultDestination = zones.includes("W18887") && "W18887" !== defaultOrigin
            ? "W18887"
            : zones.find((zoneId) => zoneId !== defaultOrigin) || zones[0];

        origin.innerHTML = buildWardOptions(zones, defaultOrigin);
        dest.innerHTML = buildWardOptions(zones, defaultDestination);

        loadingBox.remove();
        form.hidden = false;

        document.getElementById("find-route-btn").addEventListener("click", async () => {
            const originZone = origin.value;
            const destinationZone = dest.value;

            if (originZone === destinationZone) {
                resultBox.innerHTML = `
                    <div class="error-card">
                        <strong>Invalid selection</strong>
                        <span>Origin and destination must be different.</span>
                    </div>`;
                return;
            }

            resultBox.innerHTML = `
                <div class="view-loading" style="padding:24px">
                    Calculating route...
                </div>`;

            try {
                const route = await fetchJSON(`/route/${originZone}/${destinationZone}`);
                const zonePath = (route.zone_path || []).join(" → ");
                const roadPath = (route.road_path || []).join(", ");

                resultBox.innerHTML = `
                    <div class="data-card" style="margin-top:8px">
                        <div class="result-label" style="margin-bottom:12px">ROUTE FOUND</div>
                        <div class="deployment-result-route" style="margin-bottom:16px">
                            <strong>${escapeHTML(originZone)}</strong>
                            <span>→</span>
                            <strong>${escapeHTML(destinationZone)}</strong>
                        </div>
                        <div class="deployment-result-meta">
                            <span>DISTANCE<strong>${escapeHTML(String(route.total_distance_km ?? "—"))} km</strong></span>
                            <span>TIME<strong>${escapeHTML(String(route.total_travel_time_min ?? "—"))} min</strong></span>
                        </div>
                        <div style="margin-top:14px">
                            <span class="data-label">WARD PATH</span>
                            <strong style="display:block;margin-top:4px;font-size:13px">${escapeHTML(zonePath || "—")}</strong>
                        </div>
                        <div style="margin-top:12px">
                            <span class="data-label">ROAD PATH</span>
                            <strong style="display:block;margin-top:4px;font-size:13px">${escapeHTML(roadPath || "—")}</strong>
                        </div>
                    </div>`;
            } catch (err) {
                resultBox.innerHTML = `
                    <div class="error-card">
                        <strong>No route available</strong>
                        <span>${escapeHTML(err.message)}</span>
                    </div>`;
            }
        });
    } catch (error) {
        loadingBox.remove();
        form.hidden = false;
        form.innerHTML = `
            <div class="error-card">
                <strong>Ward data unavailable</strong>
                <span>${escapeHTML(error.message)}</span>
            </div>`;
    }
}
