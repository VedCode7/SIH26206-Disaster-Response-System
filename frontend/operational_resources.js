/*
 * Operational resource registry UI.
 *
 * This page talks directly to the verified operational resource API. It is
 * deliberately separate from the mapped-facility browser: facilities are
 * geographic context, while these records are individually tracked,
 * operator-supplied deployable units.
 */

(function () {
    "use strict";

    const RESOURCE_STATUSES = [
        "available",
        "reserved",
        "dispatched",
        "en_route",
        "on_scene",
        "unavailable",
        "maintenance",
    ];

    const RESOURCE_TYPES = ["ambulance", "rescue_team", "boat"];

    function operationalResourceLabel(value) {
        return String(value || "resource")
            .replaceAll("_", " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function operationalResourceEscape(value) {
        return escapeHTML(value === null || value === undefined ? "" : String(value));
    }

    function operationalResourceStyles() {
        if (document.getElementById("operational-resource-styles")) return;
        const style = document.createElement("style");
        style.id = "operational-resource-styles";
        style.textContent = `
            .operational-resource-view{display:grid;gap:16px}
            .operational-resource-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
            .operational-resource-summary .data-card{min-height:112px}
            .operational-resource-summary strong{display:block;font-size:28px;margin-top:8px}
            .operational-resource-summary span:last-child{display:block;margin-top:4px;color:var(--muted);font-size:10px}
            .operational-resource-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(330px,.75fr);gap:16px;align-items:start}
            .operational-resource-list{padding:0;overflow:hidden}
            .operational-resource-list-header{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid var(--border);gap:12px}
            .operational-resource-list-body{max-height:620px;overflow:auto}
            .operational-resource-row{display:grid;grid-template-columns:minmax(180px,1.4fr) .9fr .8fr .9fr;gap:12px;align-items:center;padding:15px 20px;border-bottom:1px solid rgba(130,155,190,.12)}
            .operational-resource-row:last-child{border-bottom:0}
            .operational-resource-row strong,.operational-resource-row span{display:block}
            .operational-resource-row span{color:var(--muted);font-size:10px;margin-top:3px}
            .operational-resource-row .resource-status{font-size:9px;font-weight:800;letter-spacing:.08em;color:var(--success);text-transform:uppercase}
            .operational-resource-row .resource-status:not(.available){color:var(--warning)}
            .operational-resource-form{padding:20px}
            .operational-resource-form h3{margin:4px 0 18px}
            .operational-resource-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
            .operational-resource-form-grid .full{grid-column:1/-1}
            .operational-resource-form .form-group{display:grid;gap:7px}
            .operational-resource-form label{color:var(--muted);font-size:9px;font-weight:700;letter-spacing:.1em}
            .operational-resource-form input,.operational-resource-form select,.operational-resource-form textarea{width:100%;background:#0d1218;color:var(--text);border:1px solid var(--border);border-radius:7px;padding:10px 11px;font:inherit;font-size:12px}
            .operational-resource-form textarea{min-height:72px;resize:vertical}
            .operational-resource-form input:focus,.operational-resource-form select:focus,.operational-resource-form textarea:focus{outline:none;border-color:rgba(255,176,32,.65)}
            .operational-resource-form-note{margin-top:13px;color:#718096;font-size:10px;line-height:1.55}
            .operational-resource-form-message{margin-top:13px;font-size:11px;line-height:1.5}
            .operational-resource-form-message.success{color:var(--success)}
            .operational-resource-form-message.error{color:var(--danger)}
            .operational-resource-demo{border:1px solid rgba(255,176,32,.25);background:rgba(255,176,32,.055);padding:14px 16px;border-radius:8px;color:#b8c2cf;font-size:10px;line-height:1.55}
            .operational-resource-demo strong{color:var(--accent);display:block;margin-bottom:4px;font-size:10px;letter-spacing:.08em}
            @media(max-width:1050px){.operational-resource-layout{grid-template-columns:1fr}.operational-resource-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
            @media(max-width:700px){.operational-resource-summary{grid-template-columns:1fr 1fr}.operational-resource-row{grid-template-columns:1fr 1fr}.operational-resource-form-grid{grid-template-columns:1fr}.operational-resource-form-grid .full{grid-column:auto}}
        `;
        document.head.appendChild(style);
    }

    function operationalResourceZoneOptions(assessments) {
        return (assessments || [])
            .slice()
            .sort((a, b) => String(a.zone_id).localeCompare(String(b.zone_id), undefined, { numeric: true }))
            .map((assessment) => `
                <option value="${operationalResourceEscape(assessment.zone_id)}">
                    ${operationalResourceEscape(assessment.zone_id)} · ${operationalResourceEscape(String(assessment.risk_level || "NORMAL").toUpperCase())}
                </option>`)
            .join("");
    }

    function operationalResourceRows(resources) {
        if (!resources.length) {
            return `<div class="response-empty">No verified operational resources are registered.</div>`;
        }

        return resources.map((resource) => `
            <div class="operational-resource-row">
                <div>
                    <strong>${operationalResourceEscape(resource.id)}</strong>
                    <span>${operationalResourceEscape(resource.name || operationalResourceLabel(resource.resource_type))}</span>
                </div>
                <div>
                    <span>TYPE</span>
                    <strong>${operationalResourceEscape(operationalResourceLabel(resource.resource_type))}</strong>
                </div>
                <div>
                    <span>WARD</span>
                    <strong>${operationalResourceEscape(resource.current_zone_id)}</strong>
                </div>
                <div>
                    <span>STATUS</span>
                    <strong class="resource-status ${operationalResourceEscape(resource.status || "unknown")}">${operationalResourceEscape(String(resource.status || "unknown").replaceAll("_", " "))}</strong>
                </div>
            </div>`).join("");
    }

    async function operationalResourceRefresh() {
        const [resourcesPayload, summary, overview] = await Promise.all([
            fetchJSON("/resources/operational"),
            fetchJSON("/resources/operational/summary"),
            fetchJSON("/risk/overview"),
        ]);

        const resources = Array.isArray(resourcesPayload?.resources) ? resourcesPayload.resources : [];
        const assessments = Array.isArray(overview?.assessments) ? overview.assessments : [];

        const list = document.getElementById("operational-resource-list-body");
        if (list) list.innerHTML = operationalResourceRows(resources);

        const total = document.getElementById("operational-resource-total");
        const available = document.getElementById("operational-resource-available");
        const dispatched = document.getElementById("operational-resource-dispatched");
        const maintenance = document.getElementById("operational-resource-maintenance");
        if (total) total.textContent = String(summary?.total ?? resources.length);
        if (available) available.textContent = String(summary?.available ?? 0);
        if (dispatched) dispatched.textContent = String(summary?.dispatched ?? 0);
        if (maintenance) maintenance.textContent = String(summary?.maintenance ?? 0);

        const zoneSelect = document.getElementById("operational-resource-zone");
        if (zoneSelect && !zoneSelect.dataset.loaded) {
            zoneSelect.innerHTML = operationalResourceZoneOptions(assessments);
            zoneSelect.dataset.loaded = "true";
        }

        return resources;
    }

    async function operationalResourceRegister(event) {
        event.preventDefault();

        const form = event.currentTarget;
        const message = document.getElementById("operational-resource-form-message");
        const submit = form.querySelector("button[type=submit]");
        const get = (id) => document.getElementById(id)?.value?.trim() || "";

        const payload = {
            id: get("operational-resource-id"),
            resource_type: get("operational-resource-type"),
            current_zone_id: get("operational-resource-zone"),
            name: get("operational-resource-name") || null,
            latitude: get("operational-resource-latitude") === "" ? null : Number(get("operational-resource-latitude")),
            longitude: get("operational-resource-longitude") === "" ? null : Number(get("operational-resource-longitude")),
            source: get("operational-resource-source"),
            status: get("operational-resource-status") || "available",
            last_verified_at: new Date().toISOString(),
            operator: get("operational-resource-operator"),
            capacity: get("operational-resource-capacity") === "" ? null : Number(get("operational-resource-capacity")),
            notes: get("operational-resource-notes") || null,
        };

        if (!payload.id || !payload.resource_type || !payload.current_zone_id || !payload.source || !payload.operator) {
            if (message) {
                message.className = "operational-resource-form-message error";
                message.textContent = "ID, type, ward, source and operator are required.";
            }
            return;
        }

        if (submit) {
            submit.disabled = true;
            submit.textContent = "Registering...";
        }
        if (message) {
            message.className = "operational-resource-form-message";
            message.textContent = "Submitting verified operational record...";
        }

        try {
            const result = await fetchJSON("/resources/operational", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            form.reset();
            const zone = document.getElementById("operational-resource-zone");
            if (zone?.options.length) zone.selectedIndex = 0;
            if (message) {
                message.className = "operational-resource-form-message success";
                message.textContent = `${result?.resource?.id || payload.id} registered as verified operational inventory.`;
            }
            await operationalResourceRefresh();
        } catch (error) {
            if (message) {
                message.className = "operational-resource-form-message error";
                message.textContent = error.message;
            }
        } finally {
            if (submit) {
                submit.disabled = false;
                submit.textContent = "Register Verified Resource";
            }
        }
    }

    async function showResources() {
        operationalResourceStyles();
        setActiveNavigation("resources");
        setPage(
            "Resources",
            "OPERATIONAL RESOURCE REGISTRY",
            "Manage individually tracked, verified resources available to the live response planner.",
            `<div class="operational-resource-view">
                <div class="operational-resource-summary">
                    <article class="data-card"><span class="data-label">VERIFIED UNITS</span><strong id="operational-resource-total">—</strong><span>Individually tracked resources</span></article>
                    <article class="data-card"><span class="data-label">AVAILABLE</span><strong id="operational-resource-available">—</strong><span>Currently deployable</span></article>
                    <article class="data-card"><span class="data-label">DISPATCHED</span><strong id="operational-resource-dispatched">—</strong><span>Committed to response</span></article>
                    <article class="data-card"><span class="data-label">MAINTENANCE</span><strong id="operational-resource-maintenance">—</strong><span>Not available for allocation</span></article>
                </div>

                <div class="operational-resource-demo">
                    <strong>SIH DEMONSTRATION DATA</strong>
                    The registry currently contains clearly labelled demonstration resources so the end-to-end
                    response workflow is visible. These are not historical 2015 inventory and are not inferred from
                    mapped facilities. Replace them with real operator-supplied records for a live deployment.
                </div>

                <div class="operational-resource-layout">
                    <section class="data-card operational-resource-list">
                        <div class="operational-resource-list-header">
                            <div><span class="data-label">LIVE INVENTORY</span><h3>Verified Operational Resources</h3></div>
                            <span class="facility-zone-badge">INDIVIDUAL UNITS</span>
                        </div>
                        <div id="operational-resource-list-body" class="operational-resource-list-body">
                            <div class="view-loading">Loading verified inventory...</div>
                        </div>
                    </section>

                    <section class="data-card operational-resource-form">
                        <span class="data-label">OPERATOR ACTION</span>
                        <h3>Register a Resource</h3>
                        <form id="operational-resource-form">
                            <div class="operational-resource-form-grid">
                                <div class="form-group">
                                    <label for="operational-resource-id">RESOURCE ID *</label>
                                    <input id="operational-resource-id" required placeholder="e.g. AMB-OPS-001">
                                </div>
                                <div class="form-group">
                                    <label for="operational-resource-type">TYPE *</label>
                                    <select id="operational-resource-type" required>
                                        ${RESOURCE_TYPES.map((type) => `<option value="${type}">${operationalResourceLabel(type)}</option>`).join("")}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="operational-resource-zone">CURRENT WARD *</label>
                                    <select id="operational-resource-zone" required><option>Loading wards...</option></select>
                                </div>
                                <div class="form-group">
                                    <label for="operational-resource-status">STATUS</label>
                                    <select id="operational-resource-status">
                                        ${RESOURCE_STATUSES.map((status) => `<option value="${status}" ${status === "available" ? "selected" : ""}>${operationalResourceLabel(status)}</option>`).join("")}
                                    </select>
                                </div>
                                <div class="form-group full">
                                    <label for="operational-resource-name">DISPLAY NAME</label>
                                    <input id="operational-resource-name" placeholder="e.g. Ambulance 001">
                                </div>
                                <div class="form-group">
                                    <label for="operational-resource-source">SOURCE *</label>
                                    <input id="operational-resource-source" required value="Operator dashboard">
                                </div>
                                <div class="form-group">
                                    <label for="operational-resource-operator">OPERATOR *</label>
                                    <input id="operational-resource-operator" required placeholder="e.g. EOC-OP-01">
                                </div>
                                <div class="form-group">
                                    <label for="operational-resource-capacity">CAPACITY</label>
                                    <input id="operational-resource-capacity" type="number" min="1" placeholder="Optional">
                                </div>
                                <div class="form-group">
                                    <label for="operational-resource-latitude">LATITUDE</label>
                                    <input id="operational-resource-latitude" type="number" min="-90" max="90" step="any" placeholder="Optional">
                                </div>
                                <div class="form-group">
                                    <label for="operational-resource-longitude">LONGITUDE</label>
                                    <input id="operational-resource-longitude" type="number" min="-180" max="180" step="any" placeholder="Optional">
                                </div>
                                <div class="form-group full">
                                    <label for="operational-resource-notes">NOTES</label>
                                    <textarea id="operational-resource-notes" placeholder="Verification or deployment notes"></textarea>
                                </div>
                            </div>
                            <button type="submit" class="primary-button" style="width:100%;margin-top:16px">Register Verified Resource</button>
                            <div id="operational-resource-form-message" class="operational-resource-form-message"></div>
                            <div class="operational-resource-form-note">
                                Registration always creates one individually tracked verified-operational unit. The browser cannot assign scenario provenance or aggregate quantities.
                            </div>
                        </form>
                    </section>
                </div>
            </div>`
        );

        document.getElementById("operational-resource-form")?.addEventListener("submit", operationalResourceRegister);

        try {
            await operationalResourceRefresh();
        } catch (error) {
            const list = document.getElementById("operational-resource-list-body");
            if (list) list.innerHTML = `<div class="error-card"><strong>Operational registry unavailable</strong><span>${operationalResourceEscape(error.message)}</span></div>`;
        }
    }

    window.showResources = showResources;
})();
