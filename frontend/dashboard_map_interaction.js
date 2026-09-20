/*
 * Dashboard map interaction layer.
 *
 * Keeps the existing real Chennai geography renderer intact, while making
 * the map easier to read and operate: auto-fit, zoom, pan, hover inspection,
 * a compact control rail, and clearer selection feedback.
 */

(function () {
    "use strict";

    const state = {
        svg: null,
        baseViewBox: null,
        viewBox: null,
        dragging: false,
        dragMoved: false,
        lastX: 0,
        lastY: 0,
        tooltip: null,
        enhancedMap: null,
    };

    function mapArea() {
        return document.querySelector(".map-area");
    }

    function assessmentFor(zoneId) {
        return typeof realDashboardAssessments !== "undefined"
            ? realDashboardAssessments.get(zoneId)
            : null;
    }

    function escape(value) {
        if (typeof escapeHTML === "function") return escapeHTML(String(value));
        return String(value).replace(/[&<>'"]/g, (char) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;",
        }[char]));
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function readViewBox(svg) {
        return svg.viewBox.baseVal;
    }

    function setViewBox(box) {
        state.viewBox = {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height,
        };
        state.svg.setAttribute(
            "viewBox",
            `${box.x} ${box.y} ${box.width} ${box.height}`
        );
    }

    function fitToChennai(animate = true) {
        if (!state.svg) return;

        const layers = [
            state.svg.querySelector(".real-ward-layer"),
            state.svg.querySelector(".real-road-layer"),
        ].filter(Boolean);

        if (!layers.length) return;

        let bounds = null;
        layers.forEach((layer) => {
            const box = layer.getBBox();
            if (!box.width || !box.height) return;
            if (!bounds) {
                bounds = { x: box.x, y: box.y, width: box.width, height: box.height };
                return;
            }
            const right = Math.max(bounds.x + bounds.width, box.x + box.width);
            const bottom = Math.max(bounds.y + bounds.height, box.y + box.height);
            bounds.x = Math.min(bounds.x, box.x);
            bounds.y = Math.min(bounds.y, box.y);
            bounds.width = right - bounds.x;
            bounds.height = bottom - bounds.y;
        });

        if (!bounds) return;

        const paddingX = Math.max(bounds.width * 0.07, 10);
        const paddingY = Math.max(bounds.height * 0.08, 10);
        const target = {
            x: bounds.x - paddingX,
            y: bounds.y - paddingY,
            width: bounds.width + paddingX * 2,
            height: bounds.height + paddingY * 2,
        };

        const current = readViewBox(state.svg);
        if (animate) {
            state.svg.style.transition = "viewBox 260ms ease";
        }
        setViewBox(target);
        state.baseViewBox = { ...target };
        window.setTimeout(() => {
            if (state.svg) state.svg.style.transition = "";
        }, 280);

        if (state.enhancedMap) {
            state.enhancedMap.classList.remove("map-zoomed");
        }
    }

    function zoom(factor, focusX = null, focusY = null) {
        if (!state.svg || !state.viewBox) return;

        const current = state.viewBox;
        const nextWidth = clamp(current.width * factor, 40, 900);
        const nextHeight = clamp(current.height * factor, 30, 330);
        const ratioX = focusX === null ? 0.5 : clamp((focusX - current.x) / current.width, 0, 1);
        const ratioY = focusY === null ? 0.5 : clamp((focusY - current.y) / current.height, 0, 1);

        setViewBox({
            x: focusX === null ? current.x + (current.width - nextWidth) / 2 : focusX - nextWidth * ratioX,
            y: focusY === null ? current.y + (current.height - nextHeight) / 2 : focusY - nextHeight * ratioY,
            width: nextWidth,
            height: nextHeight,
        });

        if (state.enhancedMap) state.enhancedMap.classList.add("map-zoomed");
    }

    function clientToSvg(clientX, clientY) {
        const rect = state.svg.getBoundingClientRect();
        const box = state.viewBox;
        return {
            x: box.x + ((clientX - rect.left) / rect.width) * box.width,
            y: box.y + ((clientY - rect.top) / rect.height) * box.height,
        };
    }

    function makeTooltip() {
        if (state.tooltip) return state.tooltip;
        const node = document.createElement("div");
        node.className = "map-hover-card";
        node.hidden = true;
        document.body.appendChild(node);
        state.tooltip = node;
        return node;
    }

    function showTooltip(event, zoneId) {
        const assessment = assessmentFor(zoneId);
        if (!assessment) return;
        const tooltip = makeTooltip();
        const level = String(assessment.risk_level || "normal").toLowerCase();
        const score = Number(assessment.risk_score ?? 0).toFixed(2);
        const factors = assessment.factors || {};
        const water = Number(factors.water_depth_m ?? factors.water ?? 0).toFixed(2);
        const rain = Number(factors.rainfall_mm_per_hr ?? factors.rainfall ?? 0).toFixed(0);
        const access = factors.accessibility_percent !== undefined
            ? Number(factors.accessibility_percent).toFixed(0)
            : String(Math.max(0, 100 - Number(factors.accessibility_risk ?? 0)).toFixed(0));

        tooltip.innerHTML = `
            <div class="map-hover-title">${escape(zoneId)} <span class="map-hover-level ${escape(level)}">${escape(level.toUpperCase())}</span></div>
            <div class="map-hover-score">${score}<small>/ 100</small></div>
            <div class="map-hover-grid">
                <span>Water <b>${water} m</b></span>
                <span>Rain <b>${rain} mm/hr</b></span>
                <span>Access <b>${access}%</b></span>
            </div>
            <div class="map-hover-hint">Click to inspect ward</div>`;

        tooltip.hidden = false;
        positionTooltip(event);
    }

    function positionTooltip(event) {
        if (!state.tooltip || state.tooltip.hidden) return;
        const gap = 14;
        const width = state.tooltip.offsetWidth || 220;
        const height = state.tooltip.offsetHeight || 120;
        let left = event.clientX + gap;
        let top = event.clientY + gap;
        if (left + width > window.innerWidth - 10) left = event.clientX - width - gap;
        if (top + height > window.innerHeight - 10) top = event.clientY - height - gap;
        state.tooltip.style.left = `${Math.max(10, left)}px`;
        state.tooltip.style.top = `${Math.max(10, top)}px`;
    }

    function hideTooltip() {
        if (state.tooltip) state.tooltip.hidden = true;
    }

    function addControls(area) {
        if (area.querySelector(".map-control-rail")) return;

        const rail = document.createElement("div");
        rail.className = "map-control-rail";
        rail.innerHTML = `
            <button type="button" data-map-action="zoom-in" aria-label="Zoom in">+</button>
            <button type="button" data-map-action="zoom-out" aria-label="Zoom out">−</button>
            <button type="button" data-map-action="fit" aria-label="Fit Chennai map">⌖</button>`;
        area.appendChild(rail);

        const hint = document.createElement("div");
        hint.className = "map-interaction-hint";
        hint.innerHTML = `<span class="hint-dot"></span> Click a ward to inspect · scroll to zoom · drag to pan`;
        area.appendChild(hint);

        rail.querySelector('[data-map-action="zoom-in"]').addEventListener("click", () => zoom(0.78));
        rail.querySelector('[data-map-action="zoom-out"]').addEventListener("click", () => zoom(1.28));
        rail.querySelector('[data-map-action="fit"]').addEventListener("click", () => fitToChennai());
    }

    function attachMapInteractions(svg, area) {
        state.svg = svg;
        state.enhancedMap = area;
        state.baseViewBox = { ...readViewBox(svg) };
        state.viewBox = { ...state.baseViewBox };

        addControls(area);

        requestAnimationFrame(() => fitToChennai(false));

        svg.addEventListener("wheel", (event) => {
            event.preventDefault();
            const point = clientToSvg(event.clientX, event.clientY);
            zoom(event.deltaY > 0 ? 1.12 : 0.89, point.x, point.y);
        }, { passive: false });

        svg.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            state.dragging = true;
            state.dragMoved = false;
            state.lastX = event.clientX;
            state.lastY = event.clientY;
            svg.setPointerCapture?.(event.pointerId);
            svg.classList.add("is-panning");
        });

        svg.addEventListener("pointermove", (event) => {
            if (state.dragging) {
                const dx = event.clientX - state.lastX;
                const dy = event.clientY - state.lastY;
                if (Math.abs(dx) + Math.abs(dy) > 2) state.dragMoved = true;
                const rect = svg.getBoundingClientRect();
                setViewBox({
                    x: state.viewBox.x - (dx / rect.width) * state.viewBox.width,
                    y: state.viewBox.y - (dy / rect.height) * state.viewBox.height,
                    width: state.viewBox.width,
                    height: state.viewBox.height,
                });
                state.lastX = event.clientX;
                state.lastY = event.clientY;
            }
            positionTooltip(event);
        });

        svg.addEventListener("pointerup", (event) => {
            state.dragging = false;
            svg.classList.remove("is-panning");
            svg.releasePointerCapture?.(event.pointerId);
        });

        svg.addEventListener("pointercancel", () => {
            state.dragging = false;
            svg.classList.remove("is-panning");
        });

        svg.querySelectorAll(".real-ward").forEach((ward) => {
            ward.addEventListener("mouseenter", (event) => {
                if (!state.dragging) showTooltip(event, ward.dataset.zoneId);
                ward.classList.add("hovered");
            });
            ward.addEventListener("mousemove", positionTooltip);
            ward.addEventListener("mouseleave", () => {
                ward.classList.remove("hovered");
                hideTooltip();
            });
        });
    }

    function enhance() {
        const area = mapArea();
        const svg = area?.querySelector("svg.real-chennai-map");
        if (!area || !svg || svg === state.svg) return;
        hideTooltip();
        attachMapInteractions(svg, area);
    }

    function observe() {
        const root = document.querySelector(".map-area");
        if (!root) return;
        const observer = new MutationObserver(() => window.setTimeout(enhance, 0));
        observer.observe(root, { childList: true });
        enhance();
    }

    function init() {
        observe();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
