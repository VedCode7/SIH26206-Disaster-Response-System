/* ============================================================
   Road Network — operational visualisation
   Uses the persisted /world/roads geometry; no synthetic road
   coordinates are introduced.
   ============================================================ */
(function () {
    "use strict";

    const ROAD_API = "http://127.0.0.1:8000/world/roads";
    let activeFilter = "all";
    let currentRoads = [];
    let canvas = null;
    let ctx = null;
    let viewport = null;
    let resizeObserver = null;
    let animationFrame = null;
    let scanPhase = 0;
    let selectedRoad = null;
    let hoveredRoad = null;
    let view = { scale: 1, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
    let bounds = null;

    const CSS = `
        .road-command-page{width:100%;min-width:0;color:#edf5fb}
        .road-command-head{display:flex;align-items:flex-start;justify-content:space-between;gap:22px;margin-bottom:18px}
        .road-command-head .eyebrow{margin-bottom:6px}
        .road-command-live{display:flex;align-items:center;gap:9px;padding:10px 13px;border:1px solid #193a43;background:linear-gradient(145deg,#0b1a22,#091119);border-radius:10px;white-space:nowrap}
        .road-live-dot{width:8px;height:8px;border-radius:50%;background:#16e99d;box-shadow:0 0 12px #16e99d;animation:roadLivePulse 1.8s infinite}
        .road-command-live strong{font-size:10px;letter-spacing:1.1px;color:#bfe9dc}.road-command-live span{font-size:9px;color:#5f8290}
        .road-command-shell{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(330px,.72fr);gap:13px;align-items:stretch}
        .road-visual-card,.road-telemetry-card,.road-detail-card{background:#091119;border:1px solid #1a2c38;border-radius:12px;box-shadow:0 18px 42px rgba(0,0,0,.22)}
        .road-visual-card{min-height:620px;overflow:hidden;position:relative}
        .road-visual-toolbar{position:absolute;z-index:5;top:13px;left:14px;right:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;pointer-events:none}
        .road-visual-title{padding:7px 10px;border:1px solid #1a3442;background:rgba(5,12,18,.86);backdrop-filter:blur(9px);border-radius:6px;font-size:9px;font-weight:900;letter-spacing:1.4px;color:#9ab5c7}
        .road-visual-title b{color:#18b6ef}.road-visual-tools{display:flex;gap:5px;pointer-events:auto}
        .road-map-btn{width:34px;height:34px;border:1px solid #284252;background:rgba(7,16,24,.92);color:#bcd0df;border-radius:7px;cursor:pointer;font-size:17px}.road-map-btn:hover{border-color:#159edb;color:#fff}
        .road-canvas-wrap{position:absolute;inset:0;background:#050b11;overflow:hidden;cursor:grab}.road-canvas-wrap.dragging{cursor:grabbing}
        .road-canvas{width:100%;height:100%;display:block}
        .road-map-hud{position:absolute;left:15px;bottom:15px;z-index:4;padding:10px 12px;border:1px solid #1b3442;background:rgba(4,11,17,.9);backdrop-filter:blur(9px);border-radius:7px;pointer-events:none}
        .road-map-hud strong{display:block;color:#d8e8f3;font-size:9px;letter-spacing:1px}.road-map-hud span{display:block;margin-top:4px;color:#607b8d;font-size:8px}
        .road-map-legend{position:absolute;right:15px;bottom:15px;z-index:4;display:flex;gap:12px;padding:9px 11px;border:1px solid #1b3442;background:rgba(4,11,17,.9);backdrop-filter:blur(9px);border-radius:7px;font-size:8px;color:#7991a1;pointer-events:none}
        .road-map-legend i{display:inline-block;width:17px;height:3px;border-radius:4px;margin-right:5px;vertical-align:middle}.road-key-open{background:#13e69b;box-shadow:0 0 7px rgba(19,230,155,.65)}.road-key-limited{background:#ffc038}.road-key-degraded{background:#ff8145}.road-key-blocked{background:#ff4055}
        .road-map-scan{position:absolute;z-index:3;top:0;bottom:0;width:1px;background:linear-gradient(180deg,transparent,rgba(23,196,255,.7),transparent);box-shadow:0 0 20px rgba(23,196,255,.55);pointer-events:none;opacity:.35}
        .road-telemetry-card{padding:14px;display:flex;flex-direction:column;min-height:620px}
        .road-card-kicker{font-size:9px;font-weight:900;letter-spacing:1.4px;color:#718da0}.road-card-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}.road-card-heading h3{margin:4px 0 0;font-size:15px}.road-card-heading .road-filter-count{font-size:9px;color:#2bb6ef}
        .road-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.road-summary-tile{padding:12px;border:1px solid #182d3a;background:#0d1821;border-radius:8px}.road-summary-tile small{display:block;color:#6d8596;font-size:8px;letter-spacing:.8px}.road-summary-tile strong{display:block;margin-top:5px;font-size:20px;letter-spacing:-.5px}.road-summary-tile em{display:block;margin-top:3px;font-style:normal;font-size:8px;color:#577083}.road-summary-tile.open strong{color:#19e6a0}.road-summary-tile.warn strong{color:#ffc03a}.road-summary-tile.danger strong{color:#ff5263}.road-summary-tile.info strong{color:#42bdf2}
        .road-health{margin-top:12px;padding:12px;border:1px solid #19303c;background:#0b161f;border-radius:8px}.road-health-head{display:flex;justify-content:space-between;align-items:center}.road-health-head span{font-size:8px;color:#708899;letter-spacing:.8px}.road-health-head strong{font-size:11px;color:#19e6a0}.road-health-track{height:5px;margin-top:9px;background:#162631;border-radius:5px;overflow:hidden}.road-health-fill{height:100%;width:0;background:linear-gradient(90deg,#ff4055,#ffad28,#15e39a);border-radius:5px;transition:width .45s ease}
        .road-filter-bar{display:flex;gap:5px;margin-top:12px}.road-filter{flex:1;height:30px;border:1px solid #1c3442;background:#0b151e;color:#7891a2;border-radius:6px;font-size:8px;font-weight:900;letter-spacing:.5px;cursor:pointer}.road-filter:hover{color:#dcebf4;border-color:#315367}.road-filter.active{background:#103041;color:#39c2f2;border-color:#1d8bb8}
        .road-detail-card{margin-top:13px;padding:13px}.road-detail-empty{padding:18px 8px;text-align:center;color:#587184;font-size:9px;line-height:1.6}.road-detail-main{display:grid;gap:9px}.road-detail-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.road-detail-id{font-size:13px;font-weight:900;color:#e8f2f8}.road-detail-route{margin-top:3px;color:#668195;font-size:8px}.road-detail-status{padding:4px 7px;border-radius:9px;font-size:7px;font-weight:900}.road-status-open{background:#063b2d;color:#18e8a0}.road-status-limited{background:#473719;color:#ffc23d}.road-status-degraded{background:#492a1e;color:#ff8a4c}.road-status-blocked{background:#481c26;color:#ff586b}.road-detail-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.road-detail-metric{padding:8px;background:#0d1922;border:1px solid #172b38;border-radius:6px}.road-detail-metric small{display:block;color:#5e7889;font-size:7px}.road-detail-metric strong{display:block;margin-top:3px;font-size:11px;color:#dceaf3}.road-roadtype{font-size:8px;color:#5d788a}
        .road-network-strip{display:grid;grid-template-columns:1.15fr 1fr 1fr 1fr;gap:10px;margin-top:13px}.road-strip-card{padding:12px 13px;background:#091119;border:1px solid #192c38;border-radius:9px}.road-strip-card small{display:block;color:#647e90;font-size:8px;letter-spacing:.9px}.road-strip-card strong{display:block;margin-top:5px;font-size:16px}.road-strip-card span{display:block;margin-top:3px;color:#50697a;font-size:8px}.road-strip-card.accent strong{color:#21baf0}
        .road-network-note{margin-top:10px;color:#4f6879;font-size:8px}.road-network-note b{color:#7591a2}
        @keyframes roadLivePulse{0%,100%{opacity:1;box-shadow:0 0 10px #16e99d}50%{opacity:.45;box-shadow:0 0 2px #16e99d}}
        @media(max-width:1050px){.road-command-shell{grid-template-columns:1fr}.road-telemetry-card{min-height:0}.road-visual-card{min-height:540px}.road-network-strip{grid-template-columns:1fr 1fr}}
        @media(max-width:680px){.road-command-head{flex-direction:column}.road-command-live{align-self:flex-start}.road-network-strip{grid-template-columns:1fr}.road-summary-grid{grid-template-columns:1fr 1fr}.road-map-legend{gap:7px}.road-map-legend span:nth-child(n+3){display:none}}
    `;

    function injectStyles() {
        if (document.getElementById("road-network-command-styles")) return;
        const style = document.createElement("style");
        style.id = "road-network-command-styles";
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function classifyRoad(road) {
        const acc = Number(road.accessibility_percent ?? 0);
        if (road.blocked) return "blocked";
        if (acc <= 25) return "degraded";
        if (acc < 75) return "limited";
        return "open";
    }

    function roadColor(road) {
        switch (classifyRoad(road)) {
            case "blocked": return "#ff4055";
            case "degraded": return "#ff8145";
            case "limited": return "#ffc038";
            default: return "#13e69b";
        }
    }

    function roadStatusLabel(status) {
        return { open: "OPEN", limited: "LIMITED", degraded: "DEGRADED", blocked: "BLOCKED" }[status] || "OPEN";
    }

    function roadMatchesFilter(road) {
        return activeFilter === "all" || classifyRoad(road) === activeFilter;
    }

    function project(lon, lat, width, height) {
        if (!bounds) return [width / 2, height / 2];
        const pad = 34;
        const dx = Math.max(bounds.maxLon - bounds.minLon, 0.00001);
        const dy = Math.max(bounds.maxLat - bounds.minLat, 0.00001);
        const sx = (width - pad * 2) / dx;
        const sy = (height - pad * 2) / dy;
        const s = Math.min(sx, sy);
        const mapW = dx * s;
        const mapH = dy * s;
        const ox = (width - mapW) / 2;
        const oy = (height - mapH) / 2;
        return [ox + (lon - bounds.minLon) * s, height - (oy + (lat - bounds.minLat) * s)];
    }

    function computeBounds(roads) {
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        roads.forEach((road) => {
            (road.path || []).forEach((point) => {
                const lon = Number(point?.[0]);
                const lat = Number(point?.[1]);
                if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
                minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
                minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
            });
        });
        if (!Number.isFinite(minLon)) return null;
        return { minLon, maxLon, minLat, maxLat };
    }

    function drawGrid(width, height) {
        ctx.save();
        ctx.fillStyle = "#050b11";
        ctx.fillRect(0, 0, width, height);
        const step = 34;
        ctx.strokeStyle = "rgba(39,75,91,.18)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += step) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += step) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }
        ctx.strokeStyle = "rgba(24,163,211,.08)";
        ctx.lineWidth = 2;
        for (let x = ((scanPhase * 0.45) % 120) - 120; x < width; x += 120) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 170, height); ctx.stroke();
        }
        ctx.restore();
    }

    function drawRoad(road, width, height, glow) {
        const path = Array.isArray(road.path) ? road.path : [];
        if (path.length < 2 || !roadMatchesFilter(road)) return;
        const points = path.map((p) => project(Number(p[0]), Number(p[1]), width, height));
        const color = roadColor(road);
        const isSelected = selectedRoad && selectedRoad.id === road.id;
        const isHovered = hoveredRoad && hoveredRoad.id === road.id;
        ctx.beginPath();
        points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (glow || isSelected || isHovered) {
            ctx.save();
            ctx.strokeStyle = color;
            ctx.globalAlpha = isSelected ? .65 : .22;
            ctx.shadowColor = color;
            ctx.shadowBlur = isSelected ? 13 : 7;
            ctx.lineWidth = isSelected ? 7 : 4;
            ctx.stroke();
            ctx.restore();
        }
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = isSelected ? 1 : isHovered ? .95 : classifyRoad(road) === "open" ? .42 : .78;
        ctx.lineWidth = isSelected ? 2.1 : isHovered ? 1.8 : .75;
        if (classifyRoad(road) === "blocked") ctx.setLineDash([3, 4]);
        ctx.stroke();
        ctx.restore();
    }

    function drawScan(width, height) {
        if (!canvas) return;
        const x = (scanPhase % (width + 180)) - 90;
        ctx.save();
        const grad = ctx.createLinearGradient(x - 45, 0, x + 45, 0);
        grad.addColorStop(0, "rgba(17,190,244,0)");
        grad.addColorStop(.5, "rgba(17,190,244,.08)");
        grad.addColorStop(1, "rgba(17,190,244,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - 45, 0, 90, height);
        ctx.restore();
    }

    function drawMap() {
        if (!canvas || !ctx) return;
        const rect = canvas.getBoundingClientRect();
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
        const width = Math.max(1, rect.width);
        const height = Math.max(1, rect.height);
        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
            canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawGrid(width, height);

        ctx.save();
        ctx.translate(view.x, view.y);
        ctx.translate(width / 2, height / 2);
        ctx.scale(view.scale, view.scale);
        ctx.translate(-width / 2, -height / 2);

        currentRoads.forEach((road) => drawRoad(road, width, height, false));
        if (selectedRoad) drawRoad(selectedRoad, width, height, true);
        if (hoveredRoad && (!selectedRoad || hoveredRoad.id !== selectedRoad.id)) drawRoad(hoveredRoad, width, height, true);
        ctx.restore();
        drawScan(width, height);
    }

    function animate() {
        scanPhase += 0.75;
        drawMap();
        animationFrame = requestAnimationFrame(animate);
    }

    function resizeCanvas() {
        drawMap();
    }

    function distancePointToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
        const x = ax + t * dx, y = ay + t * dy;
        return Math.hypot(px - x, py - y);
    }

    function pickRoad(clientX, clientY) {
        if (!canvas || !currentRoads.length) return null;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width, height = rect.height;
        const px = (clientX - rect.left - view.x - width / 2) / view.scale + width / 2;
        const py = (clientY - rect.top - view.y - height / 2) / view.scale + height / 2;
        let best = null, bestDistance = 10 / view.scale;
        currentRoads.forEach((road) => {
            if (!roadMatchesFilter(road)) return;
            const points = (road.path || []).map((p) => project(Number(p[0]), Number(p[1]), width, height));
            for (let i = 1; i < points.length; i++) {
                const d = distancePointToSegment(px, py, points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
                if (d < bestDistance) { bestDistance = d; best = road; }
            }
        });
        return best;
    }

    function fitMap() {
        view.scale = 1; view.x = 0; view.y = 0; drawMap();
    }

    function zoom(delta) {
        view.scale = Math.max(.55, Math.min(4.5, view.scale + delta));
        drawMap();
    }

    function statusCounts(roads) {
        return roads.reduce((acc, road) => { acc[classifyRoad(road)] += 1; return acc; }, { open: 0, limited: 0, degraded: 0, blocked: 0 });
    }

    function averageAccessibility(roads) {
        if (!roads.length) return 0;
        return roads.reduce((sum, road) => sum + Number(road.accessibility_percent ?? 0), 0) / roads.length;
    }

    function selectedRoadHtml(road) {
        if (!road) return `<div class="road-detail-empty">Select a road segment on the network to inspect its operational state.</div>`;
        const status = classifyRoad(road);
        return `
            <div class="road-detail-main">
                <div class="road-detail-top">
                    <div><div class="road-detail-id">${escapeHTML(road.id)}</div><div class="road-detail-route">${escapeHTML(road.from_zone_id)} → ${escapeHTML(road.to_zone_id)}</div></div>
                    <span class="road-detail-status road-status-${status}">${roadStatusLabel(status)}</span>
                </div>
                <div class="road-detail-grid">
                    <div class="road-detail-metric"><small>DISTANCE</small><strong>${Number(road.distance_km ?? 0).toFixed(1)} km</strong></div>
                    <div class="road-detail-metric"><small>TRAVEL</small><strong>${Number(road.travel_time_min ?? 0).toFixed(1)} min</strong></div>
                    <div class="road-detail-metric"><small>ACCESS</small><strong>${Number(road.accessibility_percent ?? 0).toFixed(0)}%</strong></div>
                </div>
                <div class="road-roadtype">${escapeHTML(road.road_type || "Persisted road link")} ${road.capacity != null ? `· capacity ${escapeHTML(String(road.capacity))}` : ""}</div>
            </div>`;
    }

    function buildView(roads) {
        currentRoads = roads;
        bounds = computeBounds(roads);
        const counts = statusCounts(roads);
        const avg = averageAccessibility(roads);
        const operational = counts.open + counts.limited + counts.degraded;
        const restricted = counts.limited + counts.degraded;
        const filtered = roads.filter(roadMatchesFilter).length;

        const map = `
            <div class="road-command-page">
                <div class="road-command-head">
                    <div>
                        <p class="eyebrow">DISASTER-AWARE ROUTING</p>
                        <h2>Road Network</h2>
                        <p class="subtitle">Live road geometry, accessibility and network condition across the persisted Chennai road graph.</p>
                    </div>
                    <div class="road-command-live"><i class="road-live-dot"></i><div><strong>NETWORK TELEMETRY</strong><span>LIVE · ${roads.length.toLocaleString()} LINKS</span></div></div>
                </div>

                <div class="road-command-shell">
                    <section class="road-visual-card">
                        <div class="road-visual-toolbar">
                            <div class="road-visual-title"><b>LIVE GEOSPATIAL FEED</b> · CHENNAI ROAD GRAPH</div>
                            <div class="road-visual-tools">
                                <button class="road-map-btn" data-road-action="zoom-in" title="Zoom in">+</button>
                                <button class="road-map-btn" data-road-action="zoom-out" title="Zoom out">−</button>
                                <button class="road-map-btn" data-road-action="reset" title="Reset view">⌖</button>
                            </div>
                        </div>
                        <div class="road-canvas-wrap" id="road-canvas-wrap">
                            <canvas class="road-canvas" id="road-network-canvas" aria-label="Live Chennai road network visualisation"></canvas>
                            <div class="road-map-scan" id="road-map-scan"></div>
                        </div>
                        <div class="road-map-hud"><strong>GEOSPATIAL TELEMETRY</strong><span>Drag to pan · wheel to zoom · click a segment to inspect</span></div>
                        <div class="road-map-legend"><span><i class="road-key-open"></i>Open</span><span><i class="road-key-limited"></i>Limited</span><span><i class="road-key-degraded"></i>Degraded</span><span><i class="road-key-blocked"></i>Blocked</span></div>
                    </section>

                    <aside class="road-telemetry-card">
                        <div class="road-card-heading"><div><span class="road-card-kicker">NETWORK CONDITION</span><h3>Operational Telemetry</h3></div><span class="road-filter-count" id="road-filter-count">${filtered.toLocaleString()} visible</span></div>
                        <div class="road-summary-grid">
                            <div class="road-summary-tile open"><small>OPEN LINKS</small><strong>${counts.open.toLocaleString()}</strong><em>≥ 75% access</em></div>
                            <div class="road-summary-tile warn"><small>LIMITED</small><strong>${counts.limited.toLocaleString()}</strong><em>50–74% access</em></div>
                            <div class="road-summary-tile danger"><small>DEGRADED / BLOCKED</small><strong>${(counts.degraded + counts.blocked).toLocaleString()}</strong><em>requires attention</em></div>
                            <div class="road-summary-tile info"><small>MEAN ACCESS</small><strong>${avg.toFixed(1)}%</strong><em>network-wide</em></div>
                        </div>
                        <div class="road-health"><div class="road-health-head"><span>NETWORK ACCESS HEALTH</span><strong>${avg.toFixed(0)}%</strong></div><div class="road-health-track"><div class="road-health-fill" style="width:${Math.max(0, Math.min(100, avg))}%"></div></div></div>
                        <div class="road-filter-bar">
                            ${["all","open","limited","degraded","blocked"].map((filter) => `<button class="road-filter ${activeFilter === filter ? "active" : ""}" data-road-filter="${filter}">${filter === "all" ? "ALL" : filter.toUpperCase()}</button>`).join("")}
                        </div>
                        <div class="road-detail-card" id="road-detail-card">${selectedRoadHtml(selectedRoad)}</div>
                    </aside>
                </div>

                <div class="road-network-strip">
                    <div class="road-strip-card accent"><small>ACTIVE ROAD LINKS</small><strong>${roads.length.toLocaleString()}</strong><span>Persisted geospatial records</span></div>
                    <div class="road-strip-card"><small>TRAVERSABLE</small><strong>${operational.toLocaleString()}</strong><span>Not blocked</span></div>
                    <div class="road-strip-card"><small>RESTRICTED</small><strong>${restricted.toLocaleString()}</strong><span>Accessibility below 75%</span></div>
                    <div class="road-strip-card"><small>BLOCKED</small><strong>${counts.blocked.toLocaleString()}</strong><span>Excluded from routing</span></div>
                </div>
                <div class="road-network-note"><b>Routing semantics:</b> the visual layer reflects the persisted road graph and current accessibility/blocked state; it does not invent road geometry or alter the routing engine.</div>
            </div>`;

        const main = document.querySelector(".main-content");
        if (main) {
            main.innerHTML = `
                <section class="page-content road-page-content">${map}</section>
                <footer>SIH26206 • Disaster Response Decision Support System</footer>`;
        }

        setActiveNavigationSafe("roads");
        bindView();
        fitMap();
        startMap();
    }

    function setActiveNavigationSafe(viewName) {
        if (typeof window.setActiveNavigation === "function") window.setActiveNavigation(viewName);
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
    }

    function bindView() {
        canvas = document.getElementById("road-network-canvas");
        viewport = document.getElementById("road-canvas-wrap");
        ctx = canvas ? canvas.getContext("2d") : null;
        if (!canvas || !viewport || !ctx) return;

        document.querySelectorAll("[data-road-action]").forEach((button) => {
            button.addEventListener("click", () => {
                const action = button.dataset.roadAction;
                if (action === "zoom-in") zoom(.25);
                else if (action === "zoom-out") zoom(-.25);
                else fitMap();
            });
        });

        document.querySelectorAll("[data-road-filter]").forEach((button) => {
            button.addEventListener("click", () => {
                activeFilter = button.dataset.roadFilter;
                selectedRoad = null;
                document.querySelectorAll("[data-road-filter]").forEach((b) => b.classList.toggle("active", b === button));
                const count = currentRoads.filter(roadMatchesFilter).length;
                const countEl = document.getElementById("road-filter-count");
                if (countEl) countEl.textContent = `${count.toLocaleString()} visible`;
                const detail = document.getElementById("road-detail-card");
                if (detail) detail.innerHTML = selectedRoadHtml(null);
                drawMap();
            });
        });

        canvas.addEventListener("wheel", (event) => {
            event.preventDefault();
            zoom(event.deltaY < 0 ? .16 : -.16);
        }, { passive: false });

        canvas.addEventListener("pointerdown", (event) => {
            view.dragging = true; view.lastX = event.clientX; view.lastY = event.clientY;
            viewport.classList.add("dragging"); canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener("pointermove", (event) => {
            if (view.dragging) {
                view.x += event.clientX - view.lastX; view.y += event.clientY - view.lastY;
                view.lastX = event.clientX; view.lastY = event.clientY; drawMap(); return;
            }
            const hit = pickRoad(event.clientX, event.clientY);
            if ((hit?.id || null) !== (hoveredRoad?.id || null)) { hoveredRoad = hit; drawMap(); }
        });
        canvas.addEventListener("pointerup", (event) => {
            if (view.dragging) { view.dragging = false; viewport.classList.remove("dragging"); canvas.releasePointerCapture(event.pointerId); }
        });
        canvas.addEventListener("pointerleave", () => { if (!view.dragging) { hoveredRoad = null; drawMap(); } });
        canvas.addEventListener("click", (event) => {
            if (view.dragging) return;
            const hit = pickRoad(event.clientX, event.clientY);
            selectedRoad = hit;
            const detail = document.getElementById("road-detail-card");
            if (detail) detail.innerHTML = selectedRoadHtml(selectedRoad);
            drawMap();
        });

        resizeObserver = new ResizeObserver(resizeCanvas);
        resizeObserver.observe(viewport);
    }

    function startMap() {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        scanPhase = 0;
        animationFrame = requestAnimationFrame(animate);
    }

    async function showRoadNetworkVisual() {
        injectStyles();
        if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
        try {
            const response = await fetch(ROAD_API, { headers: { "Content-Type": "application/json" } });
            if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
            const data = await response.json();
            const roads = Array.isArray(data.roads) ? data.roads : [];
            if (!roads.length) throw new Error("No road records were returned by /world/roads.");
            buildView(roads);
        } catch (error) {
            const main = document.querySelector(".main-content");
            if (main) {
                main.innerHTML = `<section class="page-content"><div class="error-card"><strong>Road network unavailable</strong><span>${escapeHTML(error.message)}</span></div></section><footer>SIH26206 • Disaster Response Decision Support System</footer>`;
            }
        }
    }

    window.showRoadNetwork = showRoadNetworkVisual;
})();
