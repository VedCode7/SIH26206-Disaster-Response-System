/*
 * Risk Overview presentation layer.
 *
 * Loaded after app.js so the existing navigation contract remains intact.
 * It replaces only showRiskOverview(); backend data and routing are untouched.
 */
(function () {
    const STYLE_ID = "risk-command-center-style";

    function esc(value) {
        return escapeHTML(value ?? "");
    }

    function levelOf(assessment) {
        const level = String(assessment?.risk_level || "normal").toLowerCase();
        return ["normal", "watch", "high", "critical"].includes(level) ? level : "normal";
    }

    function scoreOf(assessment) {
        const score = Number(assessment?.risk_score ?? 0);
        return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
    }

    function factorOf(assessment, key) {
        const value = Number(assessment?.factors?.[key] ?? 0);
        return Number.isFinite(value) ? value : 0;
    }

    function levelColor(level) {
        return {
            normal: "var(--success)",
            watch: "var(--warning)",
            high: "#ff704d",
            critical: "var(--danger)"
        }[level] || "var(--success)";
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .risk-command-center { display:flex; flex-direction:column; gap:14px; }
            .risk-command-center * { box-sizing:border-box; }
            .risk-kpi-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
            .risk-kpi { position:relative; overflow:hidden; min-height:104px; padding:16px 17px; border:1px solid var(--border); border-radius:12px; background:linear-gradient(145deg,#151b23,#0d131a); }
            .risk-kpi::after { content:""; position:absolute; width:90px; height:90px; right:-40px; bottom:-45px; border-radius:50%; background:rgba(255,176,32,.07); }
            .risk-kpi.danger::after { background:rgba(255,77,90,.10); }
            .risk-kpi.success::after { background:rgba(53,208,127,.08); }
            .risk-kpi-label { color:var(--muted); font-size:8px; font-weight:900; letter-spacing:1.2px; }
            .risk-kpi-value { display:block; margin-top:10px; font-size:27px; line-height:1; font-weight:850; letter-spacing:-.7px; }
            .risk-kpi-value.danger { color:var(--danger); }
            .risk-kpi-value.success { color:var(--success); }
            .risk-kpi-meta { display:block; margin-top:8px; color:var(--muted); font-size:9px; }
            .risk-hero { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(300px,.75fr); gap:12px; }
            .risk-panel { overflow:hidden; border:1px solid var(--border); border-radius:12px; background:var(--panel); }
            .risk-panel-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:15px 17px 12px; border-bottom:1px solid var(--border); }
            .risk-panel-head h3 { margin-top:3px; font-size:14px; }
            .risk-live { display:inline-flex; align-items:center; gap:6px; padding:5px 7px; border:1px solid rgba(53,208,127,.2); border-radius:999px; color:var(--success); background:rgba(53,208,127,.06); font-size:7px; font-weight:900; letter-spacing:.8px; }
            .risk-live::before { content:""; width:5px; height:5px; border-radius:50%; background:currentColor; box-shadow:0 0 8px currentColor; }
            .risk-distribution { padding:18px; }
            .risk-dist-top { display:flex; justify-content:space-between; align-items:end; gap:15px; }
            .risk-dist-total { font-size:31px; line-height:1; font-weight:850; letter-spacing:-1px; }
            .risk-dist-total span { color:var(--muted); font-size:10px; font-weight:500; letter-spacing:0; }
            .risk-dist-copy { max-width:310px; color:var(--muted); font-size:9px; line-height:1.45; text-align:right; }
            .risk-track { display:flex; height:12px; overflow:hidden; margin-top:16px; border-radius:999px; background:#1a222d; }
            .risk-track i { min-width:2px; transition:width .3s ease; }
            .risk-track .critical { background:var(--danger); }
            .risk-track .high { background:#ff704d; }
            .risk-track .watch { background:var(--warning); }
            .risk-track .normal { background:var(--success); }
            .risk-legend { display:grid; grid-template-columns:repeat(4,1fr); gap:7px; margin-top:12px; }
            .risk-legend-card { padding:9px; border:1px solid rgba(255,255,255,.045); border-radius:8px; background:rgba(255,255,255,.012); }
            .risk-legend-label { display:flex; align-items:center; gap:5px; color:var(--muted); font-size:7px; font-weight:900; letter-spacing:.7px; }
            .risk-legend-dot { width:5px; height:5px; border-radius:50%; }
            .risk-legend-dot.critical { background:var(--danger); } .risk-legend-dot.high { background:#ff704d; } .risk-legend-dot.watch { background:var(--warning); } .risk-legend-dot.normal { background:var(--success); }
            .risk-legend-value { display:block; margin-top:6px; font-size:17px; font-weight:850; }
            .risk-focus-body { padding:17px; }
            .risk-focus-zone { display:flex; align-items:center; gap:11px; }
            .risk-focus-orb { width:47px; height:47px; display:grid; place-items:center; flex:0 0 47px; border:1px solid rgba(255,176,32,.3); border-radius:12px; color:var(--accent); background:rgba(255,176,32,.07); font-size:8px; font-weight:900; letter-spacing:.7px; }
            .risk-focus-zone strong { display:block; font-size:16px; } .risk-focus-zone span { display:block; margin-top:3px; color:var(--muted); font-size:8px; }
            .risk-focus-score { margin-top:16px; font-size:32px; line-height:1; font-weight:850; letter-spacing:-1px; }
            .risk-focus-score span { color:var(--muted); font-size:10px; font-weight:500; letter-spacing:0; }
            .risk-focus-bar { height:6px; margin-top:10px; overflow:hidden; border-radius:999px; background:#1a222d; } .risk-focus-bar i { display:block; height:100%; border-radius:inherit; }
            .risk-factor-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:7px; margin-top:12px; }
            .risk-factor { padding:8px 9px; border:1px solid rgba(255,255,255,.04); border-radius:7px; background:rgba(255,255,255,.012); }
            .risk-factor span,.risk-factor strong { display:block; } .risk-factor span { color:var(--muted); font-size:6px; font-weight:900; letter-spacing:.7px; } .risk-factor strong { margin-top:3px; font-size:10px; }
            .risk-priority { overflow:hidden; border:1px solid var(--border); border-radius:12px; background:var(--panel); }
            .risk-section-head { display:flex; align-items:end; justify-content:space-between; gap:12px; padding:15px 17px 11px; border-bottom:1px solid var(--border); }
            .risk-section-head h3 { margin-top:3px; font-size:14px; } .risk-section-copy { color:var(--muted); font-size:8px; }
            .risk-priority-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; padding:11px; }
            .risk-priority-card { position:relative; overflow:hidden; padding:12px 13px; border:1px solid var(--border); border-radius:9px; background:#0d131a; }
            .risk-priority-card::before { content:""; position:absolute; left:0; top:0; bottom:0; width:2px; background:var(--success); }
            .risk-priority-card.watch::before { background:var(--warning); } .risk-priority-card.high::before { background:#ff704d; } .risk-priority-card.critical::before { background:var(--danger); }
            .risk-priority-top,.risk-priority-main { display:flex; justify-content:space-between; align-items:center; gap:8px; }
            .risk-rank { color:#647080; font-size:7px; font-weight:900; letter-spacing:.8px; } .risk-badge-mini { padding:3px 6px; border-radius:999px; font-size:6px; font-weight:900; letter-spacing:.6px; }
            .risk-badge-mini.normal { color:var(--success); background:rgba(53,208,127,.07); } .risk-badge-mini.watch { color:var(--warning); background:rgba(255,176,32,.08); } .risk-badge-mini.high { color:#ff704d; background:rgba(255,112,77,.08); } .risk-badge-mini.critical { color:var(--danger); background:rgba(255,77,90,.08); }
            .risk-priority-main { margin-top:10px; } .risk-priority-main strong { font-size:14px; } .risk-priority-score { font-size:17px; font-weight:850; } .risk-priority-score span { color:var(--muted); font-size:7px; font-weight:500; }
            .risk-priority-progress { height:4px; margin-top:9px; overflow:hidden; border-radius:999px; background:#1b232d; } .risk-priority-progress i { display:block; height:100%; border-radius:inherit; }
            .risk-priority-factors { display:flex; gap:5px; margin-top:9px; overflow:hidden; } .risk-chip { padding:4px 5px; border:1px solid rgba(255,255,255,.04); border-radius:5px; color:var(--muted); font-size:6px; white-space:nowrap; }
            .risk-monitor { overflow:hidden; border:1px solid var(--border); border-radius:12px; background:var(--panel); }
            .risk-monitor-tools { display:flex; gap:6px; } .risk-search,.risk-filter { height:29px; border:1px solid var(--border); border-radius:7px; outline:none; color:var(--text); background:#0c1219; font:inherit; font-size:8px; } .risk-search { width:150px; padding:0 9px; } .risk-filter { padding:0 7px; }
            .risk-search:focus,.risk-filter:focus { border-color:rgba(255,176,32,.4); box-shadow:0 0 0 2px rgba(255,176,32,.05); }
            .risk-monitor-body { max-height:300px; overflow:auto; } .risk-monitor-head,.risk-monitor-row { display:grid; grid-template-columns:1.05fr .65fr 1.35fr .55fr .7fr; align-items:center; gap:10px; }
            .risk-monitor-head { position:sticky; top:0; z-index:2; padding:8px 15px; border-bottom:1px solid var(--border); color:#697586; background:#0d131a; font-size:6px; font-weight:900; letter-spacing:.9px; }
            .risk-monitor-row { min-height:45px; padding:8px 15px; border-bottom:1px solid rgba(255,255,255,.035); } .risk-monitor-row:hover { background:rgba(255,176,32,.025); }
            .risk-monitor-zone strong,.risk-monitor-zone span { display:block; } .risk-monitor-zone strong { font-size:10px; } .risk-monitor-zone span { margin-top:2px; color:#667182; font-size:6px; }
            .risk-state { width:max-content; padding:4px 5px; border-radius:5px; font-size:6px; font-weight:900; letter-spacing:.5px; } .risk-state.normal { color:var(--success); background:rgba(53,208,127,.07); } .risk-state.watch { color:var(--warning); background:rgba(255,176,32,.08); } .risk-state.high { color:#ff704d; background:rgba(255,112,77,.08); } .risk-state.critical { color:var(--danger); background:rgba(255,77,90,.08); }
            .risk-meter { height:4px; overflow:hidden; border-radius:999px; background:#1b232d; } .risk-meter i { display:block; height:100%; border-radius:inherit; }
            .risk-monitor-score { font-size:11px; font-weight:850; } .risk-monitor-rain { color:var(--muted); font-size:7px; }
            .risk-empty { padding:30px; color:var(--muted); text-align:center; font-size:9px; }
            .risk-monitor-body::-webkit-scrollbar { width:6px; } .risk-monitor-body::-webkit-scrollbar-track { background:#0b1016; } .risk-monitor-body::-webkit-scrollbar-thumb { border-radius:8px; background:#293341; }
            @media(max-width:1050px){ .risk-kpi-grid{grid-template-columns:repeat(2,1fr)} .risk-hero{grid-template-columns:1fr} }
            @media(max-width:700px){ .risk-kpi-grid,.risk-priority-grid{grid-template-columns:1fr} .risk-legend{grid-template-columns:repeat(2,1fr)} .risk-section-head{align-items:stretch;flex-direction:column} .risk-monitor-tools{width:100%}.risk-search{flex:1;width:auto}.risk-monitor-head{display:none}.risk-monitor-row{grid-template-columns:1fr auto}.risk-monitor-row>:nth-child(3),.risk-monitor-row>:nth-child(4),.risk-monitor-row>:nth-child(5){display:none} }
        `;
        document.head.appendChild(style);
    }

    function priorityCard(assessment, index) {
        const level = levelOf(assessment);
        const score = scoreOf(assessment);
        return `
            <article class="risk-priority-card ${level}">
                <div class="risk-priority-top"><span class="risk-rank">PRIORITY ${String(index + 1).padStart(2,"0")}</span><span class="risk-badge-mini ${level}">${esc(String(assessment.risk_level || level).toUpperCase())}</span></div>
                <div class="risk-priority-main"><strong>${esc(assessment.zone_id)}</strong><div class="risk-priority-score">${score.toFixed(1)}<span>/100</span></div></div>
                <div class="risk-priority-progress"><i style="width:${score}%;background:${levelColor(level)}"></i></div>
                <div class="risk-priority-factors">
                    <span class="risk-chip">RAIN ${factorOf(assessment,"rainfall").toFixed(1)}</span>
                    <span class="risk-chip">VULN ${factorOf(assessment,"vulnerability").toFixed(1)}</span>
                    <span class="risk-chip">ACCESS ${factorOf(assessment,"accessibility_risk").toFixed(1)}</span>
                </div>
            </article>`;
    }

    function monitorRow(assessment) {
        const level = levelOf(assessment);
        const score = scoreOf(assessment);
        return `
            <div class="risk-monitor-row" data-zone="${esc(String(assessment.zone_id || "").toLowerCase())}" data-level="${level}">
                <div class="risk-monitor-zone"><strong>${esc(assessment.zone_id)}</strong><span>MONITORED ZONE</span></div>
                <span class="risk-state ${level}">${esc(String(assessment.risk_level || level).toUpperCase())}</span>
                <div class="risk-meter"><i style="width:${score}%;background:${levelColor(level)}"></i></div>
                <strong class="risk-monitor-score">${score.toFixed(1)}</strong>
                <span class="risk-monitor-rain">RAIN ${factorOf(assessment,"rainfall").toFixed(1)}</span>
            </div>`;
    }

    function bindFilters(root) {
        const search = root.querySelector(".risk-search");
        const filter = root.querySelector(".risk-filter");
        const apply = () => {
            const query = String(search?.value || "").trim().toLowerCase();
            const wanted = String(filter?.value || "all");
            root.querySelectorAll(".risk-monitor-row").forEach((row) => {
                row.hidden = Boolean((query && !row.dataset.zone.includes(query)) || (wanted !== "all" && row.dataset.level !== wanted));
            });
        };
        search?.addEventListener("input", apply);
        filter?.addEventListener("change", apply);
    }

    async function renderRiskOverview() {
        injectStyles();
        setActiveNavigation("risk");
        setPage("Risk Overview", "SITUATIONAL AWARENESS", "Live risk assessment across all monitored zones.", `<div class="view-loading" id="risk-view">Loading risk assessment...</div>`);
        const root = document.getElementById("risk-view");
        if (!root) return;

        try {
            const overview = await fetchJSON("/risk/overview");
            const assessments = Array.isArray(overview?.assessments) ? overview.assessments.slice() : [];
            const ranked = assessments.slice().sort((a,b) => scoreOf(b) - scoreOf(a));
            const counts = { normal:0, watch:0, high:0, critical:0 };
            assessments.forEach((a) => counts[levelOf(a)]++);
            const total = assessments.length || Number(overview?.total_zones || 0);
            const highest = ranked[0] || null;
            const highestLevel = highest ? levelOf(highest) : "normal";
            const highestScore = highest ? scoreOf(highest) : 0;
            const pct = (value) => total ? `${((value / total) * 100).toFixed(2)}%` : "0%";
            const elevated = counts.watch + counts.high + counts.critical;

            root.className = "page-content risk-command-center";
            root.innerHTML = `
                <section class="risk-kpi-grid">
                    <article class="risk-kpi"><span class="risk-kpi-label">MONITORED ZONES</span><strong class="risk-kpi-value">${total.toLocaleString()}</strong><span class="risk-kpi-meta">Live assessment coverage</span></article>
                    <article class="risk-kpi danger"><span class="risk-kpi-label">CRITICAL + HIGH</span><strong class="risk-kpi-value danger">${(counts.critical + counts.high).toLocaleString()}</strong><span class="risk-kpi-meta">Elevated operational attention</span></article>
                    <article class="risk-kpi success"><span class="risk-kpi-label">STABLE ZONES</span><strong class="risk-kpi-value success">${counts.normal.toLocaleString()}</strong><span class="risk-kpi-meta">Currently at normal risk</span></article>
                    <article class="risk-kpi"><span class="risk-kpi-label">HIGHEST RISK</span><strong class="risk-kpi-value">${highest ? esc(highest.zone_id) : "—"}</strong><span class="risk-kpi-meta">${highest ? `${highestScore.toFixed(1)} / 100 current score` : "No assessment available"}</span></article>
                </section>

                <section class="risk-hero">
                    <article class="risk-panel">
                        <div class="risk-panel-head"><div><p class="panel-kicker">RISK POSTURE</p><h3>Network-wide risk distribution</h3></div><span class="risk-live">LIVE DATASET</span></div>
                        <div class="risk-distribution">
                            <div class="risk-dist-top"><div class="risk-dist-total">${total}<span> zones monitored</span></div><div class="risk-dist-copy">A compact operational view of the current risk state across the monitored network.</div></div>
                            <div class="risk-track"><i class="critical" style="width:${pct(counts.critical)}"></i><i class="high" style="width:${pct(counts.high)}"></i><i class="watch" style="width:${pct(counts.watch)}"></i><i class="normal" style="width:${pct(counts.normal)}"></i></div>
                            <div class="risk-legend">
                                <div class="risk-legend-card"><span class="risk-legend-label"><i class="risk-legend-dot critical"></i>CRITICAL</span><strong class="risk-legend-value">${counts.critical}</strong></div>
                                <div class="risk-legend-card"><span class="risk-legend-label"><i class="risk-legend-dot high"></i>HIGH</span><strong class="risk-legend-value">${counts.high}</strong></div>
                                <div class="risk-legend-card"><span class="risk-legend-label"><i class="risk-legend-dot watch"></i>WATCH</span><strong class="risk-legend-value">${counts.watch}</strong></div>
                                <div class="risk-legend-card"><span class="risk-legend-label"><i class="risk-legend-dot normal"></i>NORMAL</span><strong class="risk-legend-value">${counts.normal}</strong></div>
                            </div>
                        </div>
                    </article>

                    <article class="risk-panel">
                        <div class="risk-panel-head"><div><p class="panel-kicker">HIGHEST RISK</p><h3>Current priority zone</h3></div><span class="risk-badge ${highestLevel}">${highest ? esc(String(highest.risk_level).toUpperCase()) : "NONE"}</span></div>
                        <div class="risk-focus-body">
                            <div class="risk-focus-zone"><div class="risk-focus-orb">RISK</div><div><strong>${highest ? esc(highest.zone_id) : "—"}</strong><span>${elevated} zone${elevated === 1 ? "" : "s"} above normal</span></div></div>
                            <div class="risk-focus-score">${highestScore.toFixed(1)}<span>/ 100</span></div>
                            <div class="risk-focus-bar"><i style="width:${highestScore}%;background:${levelColor(highestLevel)}"></i></div>
                            <div class="risk-factor-grid">
                                <div class="risk-factor"><span>RAINFALL</span><strong>${highest ? factorOf(highest,"rainfall").toFixed(1) : "0.0"}</strong></div>
                                <div class="risk-factor"><span>VULNERABILITY</span><strong>${highest ? factorOf(highest,"vulnerability").toFixed(1) : "0.0"}</strong></div>
                                <div class="risk-factor"><span>POPULATION</span><strong>${highest ? factorOf(highest,"population").toFixed(1) : "0.0"}</strong></div>
                                <div class="risk-factor"><span>ACCESS RISK</span><strong>${highest ? factorOf(highest,"accessibility_risk").toFixed(1) : "0.0"}</strong></div>
                            </div>
                        </div>
                    </article>
                </section>

                <section class="risk-priority">
                    <div class="risk-section-head"><div><p class="panel-kicker">OPERATIONAL WATCHLIST</p><h3>Highest-risk zones</h3></div><span class="risk-section-copy">Top ${Math.min(6, ranked.length)} by current score</span></div>
                    <div class="risk-priority-grid">${ranked.slice(0,6).map(priorityCard).join("") || `<div class="risk-empty">No assessments available.</div>`}</div>
                </section>

                <section class="risk-monitor">
                    <div class="risk-section-head"><div><p class="panel-kicker">MONITORED NETWORK</p><h3>Zone assessment matrix</h3></div><div class="risk-monitor-tools"><input class="risk-search" type="search" placeholder="Search zone…" aria-label="Search zone"><select class="risk-filter" aria-label="Filter risk level"><option value="all">All levels</option><option value="critical">Critical</option><option value="high">High</option><option value="watch">Watch</option><option value="normal">Normal</option></select></div></div>
                    <div class="risk-monitor-body"><div class="risk-monitor-head"><span>ZONE</span><span>STATE</span><span>RISK PROFILE</span><span>SCORE</span><span>RAINFALL</span></div>${assessments.map(monitorRow).join("") || `<div class="risk-empty">No assessments available.</div>`}</div>
                </section>`;
            bindFilters(root);
        } catch (error) {
            root.className = "page-content";
            root.innerHTML = `<div class="error-card"><strong>Risk data unavailable</strong><span>${esc(error.message)}</span></div>`;
        }
    }

    window.showRiskOverview = renderRiskOverview;
})();
