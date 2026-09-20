/* Interactive map workspace v2: detachable, pannable, zoomable, layer-aware maps. */
(function () {
    "use strict";

    const TYPES = {
        "Risk Heatmap": { key: "risk", kicker: "SITUATIONAL RISK" },
        "Flood Exposure": { key: "flood", kicker: "HYDROLOGICAL VIEW" },
        "Accessibility": { key: "access", kicker: "MOBILITY VIEW" },
        "Road Network": { key: "network", kicker: "NETWORK VIEW" },
        "Response Focus": { key: "response", kicker: "OPERATIONS VIEW" },
    };

    const state = { z: 1000, popouts: new Set() };

    const esc = (value) => typeof escapeHTML === "function"
        ? escapeHTML(String(value))
        : String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

    function mapType(win) {
        const title = win?.querySelector(".map-studio-window-head strong")?.textContent?.trim();
        return TYPES[title]?.key || "risk";
    }

    function bringToFront(win) {
        if (win) win.style.zIndex = ++state.z;
    }

    function getSvg(win) {
        return win?.querySelector(".map-studio-svg") || null;
    }

    function getBox(svg) {
        const b = svg.viewBox.baseVal;
        return { x: b.x, y: b.y, width: b.width, height: b.height };
    }

    function setBox(svg, box) {
        svg.setAttribute("viewBox", `${box.x} ${box.y} ${box.width} ${box.height}`);
    }

    function bounds(svg) {
        const layers = [
            svg.querySelector(".studio-ward-layer"),
            svg.querySelector(".studio-zone-links"),
            svg.querySelector(".studio-road-layer"),
        ].filter(Boolean);
        let result = null;
        for (const layer of layers) {
            try {
                const b = layer.getBBox();
                if (!b.width || !b.height) continue;
                if (!result) result = { x: b.x, y: b.y, width: b.width, height: b.height };
                else {
                    const right = Math.max(result.x + result.width, b.x + b.width);
                    const bottom = Math.max(result.y + result.height, b.y + b.height);
                    result.x = Math.min(result.x, b.x);
                    result.y = Math.min(result.y, b.y);
                    result.width = right - result.x;
                    result.height = bottom - result.y;
                }
            } catch (_) {}
        }
        return result;
    }

    function fit(svg, interaction) {
        const b = bounds(svg);
        if (!b) return;
        const px = Math.max(12, b.width * 0.07);
        const py = Math.max(12, b.height * 0.08);
        interaction.box = {
            x: b.x - px,
            y: b.y - py,
            width: b.width + px * 2,
            height: b.height + py * 2,
        };
        setBox(svg, interaction.box);
    }

    function zoom(svg, interaction, factor, cx = null, cy = null) {
        const b = interaction.box;
        const width = Math.max(35, Math.min(1000, b.width * factor));
        const height = Math.max(28, Math.min(700, b.height * factor));
        const rx = cx == null ? 0.5 : Math.max(0, Math.min(1, (cx - b.x) / b.width));
        const ry = cy == null ? 0.5 : Math.max(0, Math.min(1, (cy - b.y) / b.height));
        interaction.box = {
            x: cx == null ? b.x + (b.width - width) / 2 : cx - width * rx,
            y: cy == null ? b.y + (b.height - height) / 2 : cy - height * ry,
            width,
            height,
        };
        setBox(svg, interaction.box);
    }

    function svgPoint(svg, box, x, y) {
        const r = svg.getBoundingClientRect();
        return {
            x: box.x + ((x - r.left) / r.width) * box.width,
            y: box.y + ((y - r.top) / r.height) * box.height,
        };
    }

    function assessments() {
        return typeof realDashboardAssessments !== "undefined" ? realDashboardAssessments : new Map();
    }

    function updateSelection(win) {
        const selected = typeof selectedZoneId !== "undefined" ? selectedZoneId : null;
        win.querySelectorAll(".studio-ward.selected,.studio-marker.selected").forEach((n) => n.classList.remove("selected"));
        if (!selected) return;
        win.querySelectorAll(`[data-zone-id="${CSS.escape(selected)}"]`).forEach((n) => n.classList.add("selected"));
    }

    function addTooltip(win) {
        if (win.querySelector(".map-v2-tooltip")) return win.querySelector(".map-v2-tooltip");
        const tip = document.createElement("div");
        tip.className = "map-v2-tooltip";
        tip.hidden = true;
        win.appendChild(tip);
        return tip;
    }

    function showTooltip(win, event, zoneId) {
        const a = assessments().get(zoneId);
        if (!a) return;
        const f = a.factors || {};
        const water = Number(f.water_depth_m ?? f.water ?? 0);
        const rain = Number(f.rainfall_mm_per_hr ?? f.rainfall ?? 0);
        const access = f.accessibility_percent !== undefined ? Number(f.accessibility_percent) : Math.max(0, 100 - Number(f.accessibility_risk ?? 0));
        const level = String(a.risk_level || "normal").toLowerCase();
        const tip = addTooltip(win);
        tip.innerHTML = `<div class="map-v2-tooltip-top"><strong>${esc(zoneId)}</strong><span class="${esc(level)}">${esc(level.toUpperCase())}</span></div><div class="map-v2-score">${Number(a.risk_score ?? 0).toFixed(2)}<small>/100</small></div><div class="map-v2-grid"><span>Water<strong>${water.toFixed(2)} m</strong></span><span>Rain<strong>${rain.toFixed(0)} mm/hr</strong></span><span>Access<strong>${access.toFixed(0)}%</strong></span></div><div class="map-v2-hint">Click to inspect ward</div>`;
        tip.hidden = false;
        moveTooltip(win, event);
    }

    function moveTooltip(win, event) {
        const tip = win.querySelector(".map-v2-tooltip");
        if (!tip || tip.hidden) return;
        const parent = win.getBoundingClientRect();
        let left = event.clientX - parent.left + 14;
        let top = event.clientY - parent.top + 14;
        left = Math.min(Math.max(8, left), Math.max(8, parent.width - tip.offsetWidth - 8));
        top = Math.min(Math.max(8, top), Math.max(8, parent.height - tip.offsetHeight - 8));
        tip.style.left = `${left}px`;
        tip.style.top = `${top}px`;
    }

    function hideTooltip(win) {
        const tip = win.querySelector(".map-v2-tooltip");
        if (tip) tip.hidden = true;
    }

    function installInteraction(win) {
        const svg = getSvg(win);
        if (!svg || svg.dataset.mapV2 === "1") return;
        svg.dataset.mapV2 = "1";
        const interaction = { box: getBox(svg), dragging: false, moved: false, lastX: 0, lastY: 0 };
        win.__mapV2 = interaction;

        const controls = document.createElement("div");
        controls.className = "map-v2-controls";
        controls.innerHTML = `<div class="map-v2-zoom"><button data-v2="in">+</button><button data-v2="out">−</button><button data-v2="fit">⌖</button><button data-v2="reset">↺</button></div><div class="map-v2-layers"><button class="active" data-layer="wards">Wards</button><button class="active" data-layer="roads">Roads</button><button class="active" data-layer="links">Links</button><button class="active" data-layer="markers">Signals</button></div>`;
        const body = win.querySelector(".map-studio-body");
        if (body) body.prepend(controls);

        controls.querySelector('[data-v2="in"]').onclick = () => zoom(svg, interaction, 0.78);
        controls.querySelector('[data-v2="out"]').onclick = () => zoom(svg, interaction, 1.28);
        controls.querySelector('[data-v2="fit"]').onclick = () => fit(svg, interaction);
        controls.querySelector('[data-v2="reset"]').onclick = () => { interaction.box = getBox(svg); setBox(svg, interaction.box); };
        controls.querySelectorAll("[data-layer]").forEach((button) => {
            button.onclick = () => {
                const selector = { wards: ".studio-ward-layer", roads: ".studio-road-layer", links: ".studio-zone-links", markers: ".studio-marker-layer" }[button.dataset.layer];
                const layer = svg.querySelector(selector);
                if (!layer) return;
                const active = button.classList.toggle("active");
                layer.style.display = active ? "" : "none";
            };
        });

        svg.addEventListener("wheel", (event) => {
            event.preventDefault();
            const p = svgPoint(svg, interaction.box, event.clientX, event.clientY);
            zoom(svg, interaction, event.deltaY > 0 ? 1.1 : 0.9, p.x, p.y);
        }, { passive: false });

        svg.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            interaction.dragging = true;
            interaction.moved = false;
            interaction.lastX = event.clientX;
            interaction.lastY = event.clientY;
            svg.setPointerCapture?.(event.pointerId);
            svg.classList.add("is-panning");
        });
        svg.addEventListener("pointermove", (event) => {
            if (!interaction.dragging) {
                const ward = event.target.closest?.(".studio-ward");
                if (ward) {
                    showTooltip(win, event, ward.dataset.zoneId);
                    ward.classList.add("hovered");
                }
                return;
            }
            const dx = event.clientX - interaction.lastX;
            const dy = event.clientY - interaction.lastY;
            if (Math.abs(dx) + Math.abs(dy) > 3) interaction.moved = true;
            const r = svg.getBoundingClientRect();
            interaction.box.x -= dx / r.width * interaction.box.width;
            interaction.box.y -= dy / r.height * interaction.box.height;
            interaction.lastX = event.clientX;
            interaction.lastY = event.clientY;
            setBox(svg, interaction.box);
            moveTooltip(win, event);
        });
        svg.addEventListener("pointerup", (event) => { interaction.dragging = false; svg.classList.remove("is-panning"); svg.releasePointerCapture?.(event.pointerId); });
        svg.addEventListener("pointercancel", () => { interaction.dragging = false; svg.classList.remove("is-panning"); });
        svg.addEventListener("pointerleave", () => { win.querySelectorAll(".studio-ward.hovered").forEach((n) => n.classList.remove("hovered")); hideTooltip(win); });
        svg.addEventListener("click", (event) => {
            if (interaction.moved) { interaction.moved = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
            const ward = event.target.closest?.(".studio-ward");
            if (!ward) return;
            if (typeof selectDashboardZone === "function") selectDashboardZone(ward.dataset.zoneId);
            refreshWindows();
        }, true);

        fit(svg, interaction);
    }

    function addHeader(win) {
        if (win.querySelector(".map-v2-header-actions")) return;
        const head = win.querySelector(".map-studio-window-head");
        if (!head) return;
        const actions = document.createElement("div");
        actions.className = "map-v2-header-actions";
        actions.innerHTML = `<button data-v2-action="popout" title="Open interactive map window">↗</button><button data-v2-action="maximize" title="Maximize">□</button>`;
        head.appendChild(actions);
        actions.querySelector('[data-v2-action="popout"]').onclick = (event) => { event.stopPropagation(); openPopout(win); };
        actions.querySelector('[data-v2-action="maximize"]').onclick = (event) => {
            event.stopPropagation();
            win.classList.toggle("map-v2-maximized");
            bringToFront(win);
            if (win.classList.contains("map-v2-maximized")) { win.style.left = "24px"; win.style.top = "88px"; }
        };
    }

    function refreshWindows() {
        document.querySelectorAll(".map-studio-window").forEach(updateSelection);
        state.popouts.forEach((popup) => { if (!popup.closed) popup.postMessage({ kind: "chennai-map-selection", zoneId: typeof selectedZoneId !== "undefined" ? selectedZoneId : null }, "*"); });
    }

    function popupScript() {
        return `(function(){const svg=document.querySelector('.map-v2-popup-svg');if(!svg)return;const base={...svg.viewBox.baseVal},s={box:{...base},drag:false,moved:false,x:0,y:0};const set=()=>svg.setAttribute('viewBox',s.box.x+' '+s.box.y+' '+s.box.width+' '+s.box.height);const fit=()=>{let b=null;[...svg.querySelectorAll('.studio-ward-layer,.studio-zone-links,.studio-road-layer')].forEach(l=>{try{const x=l.getBBox();if(!x.width||!x.height)return;if(!b)b={x:x.x,y:x.y,width:x.width,height:x.height};else{const r=Math.max(b.x+b.width,x.x+x.width),d=Math.max(b.y+b.height,x.y+x.height);b.x=Math.min(b.x,x.x);b.y=Math.min(b.y,x.y);b.width=r-b.x;b.height=d-b.y}}catch{}});if(!b)return;const px=Math.max(12,b.width*.07),py=Math.max(12,b.height*.08);s.box={x:b.x-px,y:b.y-py,width:b.width+px*2,height:b.height+py*2};set()};const zoom=(f,cx=null,cy=null)=>{const b=s.box,w=Math.max(35,Math.min(1000,b.width*f)),h=Math.max(28,Math.min(700,b.height*f)),rx=cx==null?.5:Math.max(0,Math.min(1,(cx-b.x)/b.width)),ry=cy==null?.5:Math.max(0,Math.min(1,(cy-b.y)/b.height));s.box={x:cx==null?b.x+(b.width-w)/2:cx-w*rx,y:cy==null?b.y+(b.height-h)/2:cy-h*ry,width:w,height:h};set()};const point=(x,y)=>{const r=svg.getBoundingClientRect(),b=s.box;return{x:b.x+(x-r.left)/r.width*b.width,y:b.y+(y-r.top)/r.height*b.height}};const select=id=>{try{window.opener?.postMessage({kind:'chennai-map-selection',zoneId:id},'*')}catch{};document.querySelectorAll('.studio-ward.selected').forEach(n=>n.classList.remove('selected'));document.querySelectorAll('[data-zone-id="'+CSS.escape(id)+'"]').forEach(n=>n.classList.add('selected'));const i=document.querySelector('.popup-info');if(i)i.textContent=id+' selected'};document.querySelector('[data-p="in"]').onclick=()=>zoom(.78);document.querySelector('[data-p="out"]').onclick=()=>zoom(1.28);document.querySelector('[data-p="fit"]').onclick=fit;document.querySelector('[data-p="reset"]').onclick=()=>{s.box={...base};set()};document.querySelectorAll('[data-layer]').forEach(b=>b.onclick=()=>{const q={wards:'.studio-ward-layer',roads:'.studio-road-layer',links:'.studio-zone-links',markers:'.studio-marker-layer'}[b.dataset.layer],n=svg.querySelector(q);if(!n)return;b.classList.toggle('active');n.style.display=b.classList.contains('active')?'':'none'});svg.addEventListener('wheel',e=>{e.preventDefault();const p=point(e.clientX,e.clientY);zoom(e.deltaY>0?1.1:.9,p.x,p.y)},{passive:false});svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;s.drag=true;s.moved=false;s.x=e.clientX;s.y=e.clientY;svg.setPointerCapture?.(e.pointerId)});svg.addEventListener('pointermove',e=>{if(!s.drag)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(Math.abs(dx)+Math.abs(dy)>3)s.moved=true;const r=svg.getBoundingClientRect();s.box.x-=dx/r.width*s.box.width;s.box.y-=dy/r.height*s.box.height;s.x=e.clientX;s.y=e.clientY;set()});svg.addEventListener('pointerup',e=>{s.drag=false;svg.releasePointerCapture?.(e.pointerId)});svg.addEventListener('click',e=>{if(s.moved){s.moved=false;e.preventDefault();return}const w=e.target.closest?.('.studio-ward');if(w)select(w.dataset.zoneId)});window.addEventListener('message',e=>{if(e.data?.kind!=='chennai-map-selection')return;document.querySelectorAll('.studio-ward.selected').forEach(n=>n.classList.remove('selected'));if(e.data.zoneId)document.querySelectorAll('[data-zone-id="'+CSS.escape(e.data.zoneId)+'"]').forEach(n=>n.classList.add('selected'))});fit()})();`;
    }

    function openPopout(win) {
        const svg = getSvg(win);
        if (!svg) return;
        const type = mapType(win);
        const titleEntry = Object.keys(TYPES).find((title) => TYPES[title].key === type) || "Map";
        const spec = TYPES[titleEntry] || { kicker: "LIVE MAP" };
        const popup = window.open("", `chennai-map-${type}`, "width=1400,height=900,resizable=yes,scrollbars=yes");
        if (!popup) { alert("The browser blocked the map window. Allow pop-ups for this dashboard and try again."); return; }
        state.popouts.add(popup);
        const markup = svg.outerHTML.replace('class="map-studio-svg', 'class="map-v2-popup-svg');
        popup.document.open();
        popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titleEntry)} · Chennai</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#070b11;color:#edf5ff;font:14px Segoe UI,Arial,sans-serif}body{padding:18px}.shell{height:100%;display:flex;flex-direction:column;gap:12px}.head{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;border:1px solid #27384d;border-radius:14px;background:#0c121c;box-shadow:0 14px 40px #0007}.head b{display:block;color:#ffb21d;font-size:9px;letter-spacing:.18em}.head h1{margin:4px 0;font-size:24px}.head p{margin:0;color:#8197b5;font-size:12px}.actions{display:flex;gap:6px;align-items:center}.actions button,.layer{border:1px solid #304257;border-radius:8px;background:#101a26;color:#dce8f7;padding:8px 11px;cursor:pointer;font-weight:700}.actions button:hover,.layer:hover{border-color:#4ba6ff;background:#142438}.popup-info{color:#7890ad;font-size:11px;margin-right:6px}.map{position:relative;flex:1;min-height:0;border:1px solid #1e2b3b;border-radius:14px;background:#0b1119;overflow:hidden}.map>svg{width:100%;height:100%;touch-action:none;cursor:grab}.map>svg.is-panning{cursor:grabbing}.map .studio-ward{cursor:pointer;transition:fill .14s,stroke .14s}.map .studio-ward:hover{fill:rgba(75,166,255,.25)!important;stroke:#69b6ff!important;stroke-width:2.2}.map .studio-ward.selected{fill:rgba(75,166,255,.24);stroke:#69b6ff;stroke-width:2}.map .studio-road{fill:none;stroke:rgba(143,173,211,.55);stroke-width:1.05;vector-effect:non-scaling-stroke;pointer-events:none}.map .studio-zone-link{fill:none;stroke:rgba(75,166,255,.32);stroke-width:1.1;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;pointer-events:none}.map .studio-marker{stroke:#08101a;stroke-width:.8;vector-effect:non-scaling-stroke}.map .normal,.map .low,.map .good{fill:#35d07f}.map .watch{fill:#ffb738}.map .high{fill:#ff7d48}.map .critical{fill:#ff4c60}.tools{position:absolute;left:14px;top:14px;display:flex;gap:5px;padding:6px;border:1px solid #ffffff14;border-radius:10px;background:#080d15dd;backdrop-filter:blur(10px)}.tools button{width:32px;height:30px;border:1px solid #304257;border-radius:7px;background:#101a26;color:#dce8f7;cursor:pointer}.layers{position:absolute;right:14px;top:14px;display:flex;gap:5px;padding:6px;border:1px solid #ffffff14;border-radius:10px;background:#080d15dd;backdrop-filter:blur(10px)}.layer.active{border-color:#4ba6ff66;background:#142438}.hint{position:absolute;left:14px;right:14px;bottom:14px;display:flex;justify-content:space-between;pointer-events:none}.hint span{padding:6px 9px;border:1px solid #ffffff10;border-radius:999px;background:#080d15cc;color:#7890ad;font-size:10px}</style></head><body><main class="shell"><header class="head"><div><b>${esc(spec.kicker)}</b><h1>${esc(titleEntry)}</h1><p>Detached interactive map · Chennai geospatial workspace</p></div><div class="actions"><span class="popup-info">Interactive · click wards, drag, scroll</span><button onclick="window.close()">Close</button></div></header><section class="map"><div class="tools"><button data-p="in">+</button><button data-p="out">−</button><button data-p="fit">⌖</button><button data-p="reset">↺</button></div><div class="layers"><button class="layer active" data-layer="wards">Wards</button><button class="layer active" data-layer="roads">Roads</button><button class="layer active" data-layer="links">Links</button><button class="layer active" data-layer="markers">Signals</button></div>${markup}<div class="hint"><span>Scroll · Zoom</span><span>Drag · Pan</span><span>Click · Inspect</span></div></section></main><script>${popupScript().replace(/<\/script/gi, '<\\/script')}</script></body></html>`);
        popup.document.close();
        popup.focus();
    }

    function workspaceButtons(host) {
        if (host.querySelector(".map-v2-workspace-actions")) return;
        const topbar = host.querySelector(".map-studio-topbar");
        if (!topbar) return;
        const actions = document.createElement("div");
        actions.className = "map-v2-workspace-actions";
        actions.innerHTML = `<button data-v2-workspace="all">Open all</button><button data-v2-workspace="tile">Tile</button><button data-v2-workspace="stack">Stack</button>`;
        const close = topbar.querySelector(".map-studio-close-all");
        topbar.appendChild(actions);
        if (close) actions.appendChild(close);
        actions.querySelector('[data-v2-workspace="all"]').onclick = () => {
            ["risk", "flood", "access", "network", "response"].forEach((type) => { if (typeof openMapStudio === "function") openMapStudio(type); });
            setTimeout(() => tile(host), 80);
        };
        actions.querySelector('[data-v2-workspace="tile"]').onclick = () => tile(host);
        actions.querySelector('[data-v2-workspace="stack"]').onclick = () => stack(host);
    }

    function tile(host) {
        const windows = [...host.querySelectorAll(".map-studio-window")];
        if (!windows.length) return;
        const r = host.getBoundingClientRect(), gap = 14, top = 88;
        const cols = windows.length <= 2 ? windows.length : 2;
        const rows = Math.ceil(windows.length / cols);
        const width = Math.max(420, (r.width - gap * (cols + 1)) / cols);
        const height = Math.max(350, (r.height - top - gap * (rows + 1)) / rows);
        windows.forEach((win, i) => {
            win.classList.remove("map-v2-maximized");
            win.style.left = `${gap + (i % cols) * (width + gap)}px`;
            win.style.top = `${top + gap + Math.floor(i / cols) * (height + gap)}px`;
            win.style.width = `${Math.min(880, width)}px`;
            win.style.height = `${Math.min(690, height)}px`;
            bringToFront(win);
        });
    }

    function stack(host) {
        const windows = [...host.querySelectorAll(".map-studio-window")];
        windows.forEach((win, i) => {
            win.classList.remove("map-v2-maximized");
            win.style.left = `${64 + i * 34}px`;
            win.style.top = `${96 + i * 30}px`;
            win.style.width = "min(800px, calc(100vw - 80px))";
            win.style.height = "min(620px, calc(100vh - 145px))";
            win.style.zIndex = 1001 + i;
        });
        if (windows.length) bringToFront(windows[windows.length - 1]);
    }

    function launcher() {
        const button = document.querySelector(".map-insight-launcher-enhanced");
        if (!button) return;
        button.onclick = () => { if (typeof openMapStudio === "function") openMapStudio("risk"); };
    }

    function style() {
        if (document.getElementById("map-v2-css")) return;
        const s = document.createElement("style");
        s.id = "map-v2-css";
        s.textContent = `.map-insight-toolbar{display:none!important}.map-studio-window-head>.map-studio-close{display:none!important}.map-studio-enhanced-actions,.map-studio-workspace-actions,.enhanced-tile{display:none!important}.map-v2-header-actions{display:flex;gap:5px;margin-left:auto}.map-v2-header-actions button{width:30px;height:28px;border:1px solid rgba(127,150,184,.23);background:rgba(255,255,255,.035);color:#b9c9dd;border-radius:8px;cursor:pointer;font-weight:800}.map-v2-header-actions button:hover{border-color:#4ba6ff88;background:#4ba6ff12;color:#fff}.map-studio-window{width:min(800px,calc(100vw - 80px))!important;height:min(620px,calc(100vh - 145px))!important;min-height:350px!important;resize:both}.map-studio-window.map-v2-maximized{width:calc(100vw - 48px)!important;height:calc(100vh - 112px)!important;left:24px!important;top:88px!important;resize:none}.map-studio-body{position:relative;height:calc(100% - 66px);display:flex;flex-direction:column;gap:7px}.map-v2-controls{display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:31px}.map-v2-zoom,.map-v2-layers{display:flex;gap:5px}.map-v2-controls button{height:27px;padding:0 9px;border:1px solid rgba(127,150,184,.18);border-radius:7px;background:rgba(255,255,255,.035);color:#b9c9dd;font-size:9px;font-weight:800;cursor:pointer}.map-v2-controls button:hover,.map-v2-controls button.active{border-color:#4ba6ff77;background:#4ba6ff12;color:#fff}.map-studio-svg{flex:1!important;height:auto!important;min-height:0;touch-action:none;cursor:grab}.map-studio-svg.is-panning{cursor:grabbing}.map-v2-tooltip{position:absolute;z-index:50;min-width:185px;padding:10px;border:1px solid #4ba6ff55;border-radius:10px;background:#080d15f7;box-shadow:0 16px 42px #0009;pointer-events:none;backdrop-filter:blur(12px)}.map-v2-tooltip-top{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:10px}.map-v2-tooltip-top span{padding:3px 5px;border-radius:4px;font-size:7px;letter-spacing:.5px}.map-v2-tooltip-top .normal{color:#35d07f;background:#35d07f1a}.map-v2-tooltip-top .watch{color:#ffb738;background:#ffb7381a}.map-v2-tooltip-top .high{color:#ff7d48;background:#ff7d481a}.map-v2-tooltip-top .critical{color:#ff4c60;background:#ff4c601a}.map-v2-score{margin-top:6px;font-size:22px;font-weight:800}.map-v2-score small{margin-left:3px;color:#718096;font-size:8px}.map-v2-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid #ffffff12}.map-v2-grid span{color:#718096;font-size:8px}.map-v2-grid strong{display:block;margin-top:2px;color:#e6edf5;font-size:9px}.map-v2-hint{margin-top:8px;color:#4ba6ff;font-size:7px;letter-spacing:.5px;text-transform:uppercase}.map-v2-workspace-actions{display:flex;gap:5px;align-items:center}.map-v2-workspace-actions button{border:1px solid rgba(127,150,184,.22);background:rgba(255,255,255,.035);color:#b9c9dd;border-radius:8px;padding:8px 10px;font-size:9px;font-weight:800;cursor:pointer}.map-v2-workspace-actions button:hover{border-color:#4ba6ff77;background:#4ba6ff12;color:#fff}@media(max-width:900px){.map-studio-window{width:calc(100vw - 24px)!important;height:calc(100vh - 130px)!important;left:12px!important;top:88px!important}.map-v2-layers{overflow:auto}.map-v2-workspace-actions button:not([data-v2-workspace="all"]){display:none}}`;
        document.head.appendChild(s);
    }

    function enhance() {
        style();
        launcher();
        const host = document.querySelector(".map-studio-host");
        if (!host) return;
        workspaceButtons(host);
        host.querySelectorAll(".map-studio-window").forEach((win) => {
            addHeader(win);
            installInteraction(win);
            updateSelection(win);
            if (!win.dataset.mapV2Pointer) {
                win.dataset.mapV2Pointer = "1";
                win.addEventListener("pointerdown", () => bringToFront(win), { passive: true });
            }
        });
    }

    function init() {
        style();
        const observer = new MutationObserver(() => requestAnimationFrame(enhance));
        observer.observe(document.body, { childList: true, subtree: true });
        enhance();
        window.addEventListener("message", (event) => {
            if (event.data?.kind !== "chennai-map-selection") return;
            if (event.data.zoneId && typeof selectDashboardZone === "function") selectDashboardZone(event.data.zoneId);
            refreshWindows();
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
})();
