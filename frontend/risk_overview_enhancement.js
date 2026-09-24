(function () {
    const STYLE_ID = 'risk-overview-command-center-style';

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
/* ==========================================================
   RISK OVERVIEW — COMMAND CENTER PRESENTATION LAYER
   Isolated from the existing dashboard/routing renderer.
   ========================================================== */
#risk-view.risk-command-center {
    gap: 18px;
}

.risk-command-center .risk-summary-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
}

.risk-command-center .risk-summary-card {
    position: relative;
    overflow: hidden;
    min-height: 112px;
    padding: 18px 20px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: linear-gradient(145deg, rgba(21,27,36,.98), rgba(12,17,24,.98));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.025);
}

.risk-command-center .risk-summary-card::after {
    content: '';
    position: absolute;
    width: 90px;
    height: 90px;
    right: -38px;
    bottom: -46px;
    border-radius: 50%;
    background: rgba(255,176,32,.08);
    filter: blur(4px);
}

.risk-command-center .risk-summary-card.danger::after { background: rgba(255,77,90,.12); }
.risk-command-center .risk-summary-card.success::after { background: rgba(53,208,127,.10); }

.risk-command-center .risk-summary-label {
    color: var(--muted);
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1.35px;
}

.risk-command-center .risk-summary-value {
    display: block;
    margin-top: 9px;
    font-size: 28px;
    line-height: 1;
    font-weight: 850;
    letter-spacing: -.7px;
}

.risk-command-center .risk-summary-value.danger { color: var(--danger); }
.risk-command-center .risk-summary-value.warning { color: var(--warning); }
.risk-command-center .risk-summary-value.success { color: var(--success); }

.risk-command-center .risk-summary-meta {
    display: block;
    margin-top: 8px;
    color: var(--muted);
    font-size: 10px;
}

.risk-command-center .risk-hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(310px, .85fr);
    gap: 14px;
}

.risk-command-center .risk-panel {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 13px;
    background: var(--panel);
}

.risk-command-center .risk-panel::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle at 85% 10%, rgba(255,176,32,.065), transparent 34%);
}

.risk-command-center .risk-panel-header {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 17px 19px 13px;
    border-bottom: 1px solid var(--border);
}

.risk-command-center .risk-panel-header h3 {
    margin-top: 4px;
    font-size: 15px;
}

.risk-command-center .risk-live-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border: 1px solid rgba(53,208,127,.22);
    border-radius: 999px;
    color: var(--success);
    background: rgba(53,208,127,.07);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .8px;
}

.risk-command-center .risk-live-pill::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 9px currentColor;
}

.risk-command-center .risk-distribution {
    position: relative;
    padding: 19px;
}

.risk-command-center .risk-distribution-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 14px;
}

.risk-command-center .risk-distribution-total {
    font-size: 34px;
    line-height: 1;
    font-weight: 850;
    letter-spacing: -1px;
}

.risk-command-center .risk-distribution-total span {
    color: var(--muted);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0;
}

.risk-command-center .risk-distribution-caption {
    max-width: 280px;
    color: var(--muted);
    font-size: 10px;
    line-height: 1.5;
    text-align: right;
}

.risk-command-center .risk-distribution-track {
    display: flex;
    height: 11px;
    overflow: hidden;
    border-radius: 999px;
    background: #1a222d;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.025);
}

.risk-command-center .risk-segment { min-width: 2px; transition: width .35s ease; }
.risk-command-center .risk-segment.critical { background: var(--danger); }
.risk-command-center .risk-segment.high { background: #ff704d; }
.risk-command-center .risk-segment.watch { background: var(--warning); }
.risk-command-center .risk-segment.normal { background: var(--success); }

.risk-command-center .risk-legend {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 9px;
    margin-top: 15px;
}

.risk-command-center .risk-legend-item {
    min-width: 0;
    padding: 10px 11px;
    border: 1px solid rgba(255,255,255,.045);
    border-radius: 9px;
    background: rgba(255,255,255,.015);
}

.risk-command-center .risk-legend-label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--muted);
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .8px;
}

.risk-command-center .risk-legend-dot {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 50%;
}
.risk-command-center .risk-legend-dot.critical { background: var(--danger); }
.risk-command-center .risk-legend-dot.high { background: #ff704d; }
.risk-command-center .risk-legend-dot.watch { background: var(--warning); }
.risk-command-center .risk-legend-dot.normal { background: var(--success); }

.risk-command-center .risk-legend-value {
    display: block;
    margin-top: 7px;
    font-size: 19px;
    font-weight: 800;
}

.risk-command-center .risk-focus { padding-bottom: 14px; }

.risk-command-center .risk-focus-body { padding: 16px 19px 18px; }

.risk-command-center .risk-focus-zone {
    display: flex;
    align-items: center;
    gap: 13px;
}

.risk-command-center .risk-focus-orb {
    width: 52px;
    height: 52px;
    flex: 0 0 52px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255,176,32,.35);
    border-radius: 14px;
    color: var(--accent);
    background: rgba(255,176,32,.08);
    box-shadow: 0 0 24px rgba(255,176,32,.08);
    font-size: 11px;
    font-weight: 900;
}

.risk-command-center .risk-focus-zone strong { display: block; font-size: 17px; }
.risk-command-center .risk-focus-zone span { display: block; margin-top: 4px; color: var(--muted); font-size: 10px; }

.risk-command-center .risk-focus-score {
    margin-top: 18px;
    font-size: 36px;
    line-height: 1;
    font-weight: 850;
    letter-spacing: -1px;
}

.risk-command-center .risk-focus-score span { color: var(--muted); font-size: 12px; font-weight: 500; letter-spacing: 0; }

.risk-command-center .risk-focus-bar {
    height: 7px;
    margin-top: 12px;
    overflow: hidden;
    border-radius: 999px;
    background: #1b232e;
}

.risk-command-center .risk-focus-bar i { display: block; height: 100%; border-radius: inherit; }

.risk-command-center .risk-focus-factors {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 14px;
}

.risk-command-center .risk-focus-factor {
    padding: 9px 10px;
    border: 1px solid rgba(255,255,255,.045);
    border-radius: 8px;
    background: rgba(255,255,255,.012);
}

.risk-command-center .risk-focus-factor span,
.risk-command-center .risk-focus-factor strong { display: block; }
.risk-command-center .risk-focus-factor span { color: var(--muted); font-size: 7px; font-weight: 800; letter-spacing: .8px; }
.risk-command-center .risk-focus-factor strong { margin-top: 4px; font-size: 11px; }

.risk-command-center .priority-section,
.risk-command-center .monitor-section {
    border: 1px solid var(--border);
    border-radius: 13px;
    background: var(--panel);
    overflow: hidden;
}

.risk-command-center .priority-header,
.risk-command-center .monitor-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding: 17px 19px 13px;
    border-bottom: 1px solid var(--border);
}

.risk-command-center .priority-header h3,
.risk-command-center .monitor-header h3 { margin-top: 4px; font-size: 15px; }
.risk-command-center .priority-subtitle { color: var(--muted); font-size: 9px; text-align: right; }

.risk-command-center .priority-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    padding: 13px;
}

.risk-command-center .priority-card {
    position: relative;
    overflow: hidden;
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #0d131b;
    transition: transform .18s ease, border-color .18s ease, background .18s ease;
}

.risk-command-center .priority-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255,176,32,.24);
    background: #111923;
}

.risk-command-center .priority-card::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: var(--success); }
.risk-command-center .priority-card.watch::before { background: var(--warning); }
.risk-command-center .priority-card.high::before { background: #ff704d; }
.risk-command-center .priority-card.critical::before { background: var(--danger); }

.risk-command-center .priority-top,
.risk-command-center .priority-zone { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.risk-command-center .priority-rank { color: #5f6a79; font-size: 8px; font-weight: 900; letter-spacing: .9px; }

.risk-command-center .priority-badge {
    padding: 4px 7px;
    border-radius: 999px;
    font-size: 7px;
    font-weight: 900;
    letter-spacing: .75px;
}

.risk-command-center .priority-badge.normal { color: var(--success); background: rgba(53,208,127,.08); }
.risk-command-center .priority-badge.watch { color: var(--warning); background: rgba(255,176,32,.09); }
.risk-command-center .priority-badge.high { color: #ff704d; background: rgba(255,112,77,.09); }
.risk-command-center .priority-badge.critical { color: var(--danger); background: rgba(255,77,90,.09); }

.risk-command-center .priority-zone { margin-top: 12px; }
.risk-command-center .priority-zone strong { font-size: 15px; }
.risk-command-center .priority-score { font-size: 19px; font-weight: 850; }
.risk-command-center .priority-score span { color: var(--muted); font-size: 8px; font-weight: 500; }

.risk-command-center .priority-progress { height: 4px; margin-top: 11px; overflow: hidden; border-radius: 999px; background: #1c2430; }
.risk-command-center .priority-progress i { display: block; height: 100%; border-radius: inherit; }

.risk-command-center .priority-factors { display: flex; gap: 6px; margin-top: 11px; overflow: hidden; }
.risk-command-center .priority-factor {
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid rgba(255,255,255,.045);
    border-radius: 5px;
    color: var(--muted);
    background: rgba(255,255,255,.012);
    font-size: 7px;
    white-space: nowrap;
}

.risk-command-center .monitor-tools { display: flex; gap: 7px; align-items: center; }

.risk-command-center .monitor-search,
.risk-command-center .monitor-filter {
    height: 31px;
    border: 1px solid var(--border);
    border-radius: 7px;
    outline: none;
    color: var(--text);
    background: #0c1219;
    font: inherit;
    font-size: 9px;
}

.risk-command-center .monitor-search { width: 160px; padding: 0 10px; }
.risk-command-center .monitor-filter { padding: 0 8px; }
.risk-command-center .monitor-search:focus,
.risk-command-center .monitor-filter:focus { border-color: rgba(255,176,32,.45); box-shadow: 0 0 0 2px rgba(255,176,32,.06); }

.risk-command-center .monitor-body { max-height: 390px; overflow: auto; }

.risk-command-center .monitor-table-head,
.risk-command-center .monitor-row {
    display: grid;
    grid-template-columns: 1.05fr .7fr 1.45fr .8fr .8fr;
    align-items: center;
    gap: 12px;
}

.risk-command-center .monitor-table-head {
    position: sticky;
    top: 0;
    z-index: 2;
    padding: 9px 17px;
    border-bottom: 1px solid var(--border);
    color: #697586;
    background: #0d131a;
    font-size: 7px;
    font-weight: 900;
    letter-spacing: 1px;
}

.risk-command-center .monitor-row {
    min-height: 49px;
    padding: 9px 17px;
    border-bottom: 1px solid rgba(255,255,255,.035);
    background: rgba(255,255,255,.003);
    transition: background .15s ease;
}

.risk-command-center .monitor-row:hover { background: rgba(255,176,32,.035); }
.risk-command-center .monitor-row:last-child { border-bottom: 0; }
.risk-command-center .monitor-zone strong { display: block; font-size: 11px; }
.risk-command-center .monitor-zone span { display: block; margin-top: 2px; color: #667182; font-size: 7px; }

.risk-command-center .monitor-status {
    display: inline-flex;
    width: fit-content;
    padding: 4px 6px;
    border-radius: 5px;
    font-size: 7px;
    font-weight: 900;
    letter-spacing: .7px;
}

.risk-command-center .monitor-status.normal { color: var(--success); background: rgba(53,208,127,.07); }
.risk-command-center .monitor-status.watch { color: var(--warning); background: rgba(255,176,32,.08); }
.risk-command-center .monitor-status.high { color: #ff704d; background: rgba(255,112,77,.08); }
.risk-command-center .monitor-status.critical { color: var(--danger); background: rgba(255,77,90,.08); }

.risk-command-center .monitor-score { font-size: 13px; font-weight: 850; }
.risk-command-center .monitor-meter { height: 5px; overflow: hidden; border-radius: 999px; background: #1b232d; }
.risk-command-center .monitor-meter i { display: block; height: 100%; border-radius: inherit; }
.risk-command-center .monitor-factor { color: var(--muted); font-size: 8px; }
.risk-command-center .monitor-empty { padding: 32px; text-align: center; color: var(--muted); font-size: 10px; }

.risk-command-center .monitor-body::-webkit-scrollbar { width: 7px; }
.risk-command-center .monitor-body::-webkit-scrollbar-track { background: #0b1016; }
.risk-command-center .monitor-body::-webkit-scrollbar-thumb { border-radius: 10px; background: #2a3441; }

@media (max-width: 1100px) {
    .risk-command-center .risk-summary-strip { grid-template-columns: repeat(2, 1fr); }
    .risk-command-center .risk-hero-grid { grid-template-columns: 1fr; }
    .risk-command-center .priority-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 700px) {
    .risk-command-center .risk-summary-strip,
    .risk-command-center .priority-grid { grid-template-columns: 1fr; }
    .risk-command-center .risk-legend { grid-template-columns: repeat(2, 1fr); }
    .risk-command-center .monitor-header { align-items: stretch; flex-direction: column; }
    .risk-command-center .monitor-tools { width: 100%; }
    .risk-command-center .monitor-search { flex: 1; width: auto; }
    .risk-command-center .monitor-table-head { display: none; }
    .risk-command-center .monitor-row { grid-template-columns: 1fr auto; gap: 7px; }
    .risk-command-center .monitor-row > :nth-child(3),
    .risk-command-center .monitor-row > :nth-child(4) { display: none; }
}
`;
        document.head.appendChild(style);
    }

    function esc(value) {
        if (typeof escapeHTML === 'function') return escapeHTML(value);
        return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
    }

    function normalizeLevel(value) {
        const level = String(value || 'normal').toLowerCase();
        return ['normal', 'watch', 'high', 'critical'].includes(level) ? level : 'normal';
    }

    function scoreOf(a) {
        const score = Number(a?.risk_score);
        return Number.isFinite(score) ? score : 0;
    }

    function factor(a, key) {
        const value = Number(a?.factors?.[key] ?? 0);
        return Number.isFinite(value) ? value : 0;
    }

    function colorFor(level) {
        return {
            normal: 'var(--success)',
            watch: 'var(--warning)',
            high: '#ff704d',
            critical: 'var(--danger)'
        }[level] || 'var(--success)';
    }

    function renderPriorityCard(a, index) {
        const level = normalizeLevel(a.risk_level);
        const score = Math.min(Math.max(scoreOf(a), 0), 100);
        return `
            <article class="priority-card ${level}">
                <div class="priority-top">
                    <span class="priority-rank">PRIORITY ${String(index + 1).padStart(2, '0')}</span>
                    <span class="priority-badge ${level}">${esc(String(a.risk_level || level).toUpperCase())}</span>
                </div>
                <div class="priority-zone">
                    <strong>${esc(a.zone_id || '—')}</strong>
                    <div class="priority-score">${score.toFixed(1)}<span>/100</span></div>
                </div>
                <div class="priority-progress"><i style="width:${score}%;background:${colorFor(level)}"></i></div>
                <div class="priority-factors">
                    <span class="priority-factor">RAIN ${factor(a, 'rainfall').toFixed(1)}</span>
                    <span class="priority-factor">VULN ${factor(a, 'vulnerability').toFixed(1)}</span>
                    <span class="priority-factor">ACCESS ${factor(a, 'accessibility_risk').toFixed(1)}</span>
                </div>
            </article>`;
    }

    function renderMonitorRow(a) {
        const level = normalizeLevel(a.risk_level);
        const score = Math.min(Math.max(scoreOf(a), 0), 100);
        return `
            <div class="monitor-row" data-zone="${esc(String(a.zone_id || '').toLowerCase())}" data-level="${level}">
                <div class="monitor-zone">
                    <strong>${esc(a.zone_id || '—')}</strong>
                    <span>MONITORED ZONE</span>
                </div>
                <span class="monitor-status ${level}">${esc(String(a.risk_level || level).toUpperCase())}</span>
                <div class="monitor-meter"><i style="width:${score}%;background:${colorFor(level)}"></i></div>
                <strong class="monitor-score">${score.toFixed(1)}</strong>
                <span class="monitor-factor">RAIN ${factor(a, 'rainfall').toFixed(1)}</span>
            </div>`;
    }

    function bindMonitorControls() {
        const search = document.querySelector('.risk-command-center .monitor-search');
        const filter = document.querySelector('.risk-command-center .monitor-filter');
        const rows = () => [...document.querySelectorAll('.risk-command-center .monitor-row')];
        const apply = () => {
            const q = String(search?.value || '').trim().toLowerCase();
            const wanted = String(filter?.value || 'all');
            rows().forEach(row => {
                const matchZone = !q || row.dataset.zone.includes(q);
                const matchLevel = wanted === 'all' || row.dataset.level === wanted;
                row.style.display = matchZone && matchLevel ? '' : 'none';
            });
        };
        search?.addEventListener('input', apply);
        filter?.addEventListener('change', apply);
    }

    async function showRiskOverviewCommandCenter() {
        injectStyles();
        setActiveNavigation('risk');
        setPage(
            'Risk Overview',
            'SITUATIONAL AWARENESS',
            'Live risk assessment across all monitored zones.',
            '<div class="view-loading" id="risk-view">Loading risk assessment...</div>'
        );

        const root = document.querySelector('#risk-view');
        if (!root) return;

        try {
            const overview = await fetchJSON('/risk/overview');
            const assessments = Array.isArray(overview.assessments) ? overview.assessments.slice() : [];
            const ranked = assessments.slice().sort((a, b) => scoreOf(b) - scoreOf(a));
            const highest = ranked[0] || null;
            const counts = { normal: 0, watch: 0, high: 0, critical: 0 };
            assessments.forEach(a => counts[normalizeLevel(a.risk_level)]++);
            const total = assessments.length || Number(overview.total_zones) || 0;
            const stable = counts.normal;
            const elevated = counts.watch + counts.high + counts.critical;
            const highestScore = highest ? Math.min(Math.max(scoreOf(highest), 0), 100) : 0;
            const pct = key => total ? ((counts[key] / total) * 100).toFixed(2) : '0';
            const priority = ranked.slice(0, 6);

            root.className = 'page-content risk-command-center';
            root.innerHTML = `
                <section class="risk-summary-strip">
                    <article class="risk-summary-card">
                        <span class="risk-summary-label">MONITORED ZONES</span>
                        <strong class="risk-summary-value">${total}</strong>
                        <span class="risk-summary-meta">Live assessment coverage</span>
                    </article>
                    <article class="risk-summary-card danger">
                        <span class="risk-summary-label">CRITICAL + HIGH</span>
                        <strong class="risk-summary-value danger">${counts.critical + counts.high}</strong>
                        <span class="risk-summary-meta">Immediate / elevated attention</span>
                    </article>
                    <article class="risk-summary-card success">
                        <span class="risk-summary-label">STABLE ZONES</span>
                        <strong class="risk-summary-value success">${stable}</strong>
                        <span class="risk-summary-meta">Normal current risk state</span>
                    </article>
                    <article class="risk-summary-card">
                        <span class="risk-summary-label">HIGHEST RISK</span>
                        <strong class="risk-summary-value">${highest ? esc(highest.zone_id) : '—'}</strong>
                        <span class="risk-summary-meta">${highest ? highestScore.toFixed(1) + ' / 100 current score' : 'No assessment available'}</span>
                    </article>
                </section>

                <section class="risk-hero-grid">
                    <article class="risk-panel">
                        <div class="risk-panel-header">
                            <div>
                                <p class="panel-kicker">RISK POSTURE</p>
                                <h3>Network-wide risk distribution</h3>
                            </div>
                            <span class="risk-live-pill">LIVE DATASET</span>
                        </div>
                        <div class="risk-distribution">
                            <div class="risk-distribution-top">
                                <div class="risk-distribution-total">${total}<span> zones monitored</span></div>
                                <div class="risk-distribution-caption">A compact operational view of how the monitored network is currently distributed across risk states.</div>
                            </div>
                            <div class="risk-distribution-track" aria-label="Risk distribution">
                                <i class="risk-segment critical" style="width:${pct('critical')}%"></i>
                                <i class="risk-segment high" style="width:${pct('high')}%"></i>
                                <i class="risk-segment watch" style="width:${pct('watch')}%"></i>
                                <i class="risk-segment normal" style="width:${pct('normal')}%"></i>
                            </div>
                            <div class="risk-legend">
                                <div class="risk-legend-item"><span class="risk-legend-label"><i class="risk-legend-dot critical"></i>CRITICAL</span><strong class="risk-legend-value">${counts.critical}</strong></div>
                                <div class="risk-legend-item"><span class="risk-legend-label"><i class="risk-legend-dot high"></i>HIGH</span><strong class="risk-legend-value">${counts.high}</strong></div>
                                <div class="risk-legend-item"><span class="risk-legend-label"><i class="risk-legend-dot watch"></i>WATCH</span><strong class="risk-legend-value">${counts.watch}</strong></div>
                                <div class="risk-legend-item"><span class="risk-legend-label"><i class="risk-legend-dot normal"></i>NORMAL</span><strong class="risk-legend-value">${counts.normal}</strong></div>
                            </div>
                        </div>
                    </article>

                    <article class="risk-panel risk-focus">
                        <div class="risk-panel-header">
                            <div>
                                <p class="panel-kicker">HIGHEST RISK</p>
                                <h3>Current priority zone</h3>
                            </div>
                            <span class="risk-badge ${highest ? normalizeLevel(highest.risk_level) : 'normal'}">${highest ? esc(String(highest.risk_level).toUpperCase()) : 'NONE'}</span>
                        </div>
                        <div class="risk-focus-body">
                            <div class="risk-focus-zone">
                                <div class="risk-focus-orb">RISK</div>
                                <div>
                                    <strong>${highest ? esc(highest.zone_id) : '—'}</strong>
                                    <span>${elevated ? elevated + ' zone(s) above normal' : 'All monitored zones currently normal'}</span>
                                </div>
                            </div>
                            <div class="risk-focus-score">${highestScore.toFixed(1)}<span>/ 100</span></div>
                            <div class="risk-focus-bar"><i style="width:${highestScore}%;background:${colorFor(highest ? normalizeLevel(highest.risk_level) : 'normal')}"></i></div>
                            <div class="risk-focus-factors">
                                <div class="risk-focus-factor"><span>RAINFALL</span><strong>${highest ? factor(highest,'rainfall').toFixed(1) : '0.0'}</strong></div>
                                <div class="risk-focus-factor"><span>VULNERABILITY</span><strong>${highest ? factor(highest,'vulnerability').toFixed(1) : '0.0'}</strong></div>
                                <div class="risk-focus-factor"><span>POPULATION</span><strong>${highest ? factor(highest,'population').toFixed(1) : '0.0'}</strong></div>
                                <div class="risk-focus-factor"><span>ACCESS RISK</span><strong>${highest ? factor(highest,'accessibility_risk').toFixed(1) : '0.0'}</strong></div>
                            </div>
                        </div>
                    </article>
                </section>

                <section class="priority-section">
                    <div class="priority-header">
                        <div>
                            <p class="panel-kicker">OPERATIONAL WATCHLIST</p>
                            <h3>Highest-risk zones</h3>
                        </div>
                        <span class="priority-subtitle">Top ${Math.min(6, ranked.length)} by current risk score</span>
                    </div>
                    <div class="priority-grid">
                        ${priority.length ? priority.map(renderPriorityCard).join('') : '<div class="monitor-empty">No risk assessments available.</div>'}
                    </div>
                </section>

                <section class="monitor-section">
                    <div class="monitor-header">
                        <div>
                            <p class="panel-kicker">MONITORED NETWORK</p>
                            <h3>Zone assessment matrix</h3>
                        </div>
                        <div class="monitor-tools">
                            <input class="monitor-search" type="search" placeholder="Search zone…" aria-label="Search zones">
                            <select class="monitor-filter" aria-label="Filter risk level">
                                <option value="all">All levels</option>
                                <option value="critical">Critical</option>
                                <option value="high">High</option>
                                <option value="watch">Watch</option>
                                <option value="normal">Normal</option>
                            </select>
                        </div>
                    </div>
                    <div class="monitor-body">
                        <div class="monitor-table-head"><span>ZONE</span><span>STATE</span><span>RISK PROFILE</span><span>SCORE</span><span>RAINFALL</span></div>
                        ${assessments.length ? assessments.map(renderMonitorRow).join('') : '<div class="monitor-empty">No assessments available.</div>'}
                    </div>
                </section>
            `;

            bindMonitorControls();
        } catch (error) {
            root.className = 'page-content';
            root.innerHTML = `<div class="error-card"><strong>Risk data unavailable</strong><span>${esc(error.message)}</span></div>`;
        }
    }

    // app.js is loaded before this file. Replacing the global handler keeps
    // the existing navigation contract intact while isolating this redesign.
    window.showRiskOverview = showRiskOverviewCommandCenter;
})();
