/*
 * Risk Overview interaction layer.
 *
 * Kept separate from the presentation renderer so search/filter behaviour
 * survives Risk Overview re-renders and does not touch routing or backend data.
 */
(function () {
    const ROW_SELECTOR = ".risk-monitor-row";
    const SEARCH_SELECTOR = ".risk-search";
    const FILTER_SELECTOR = ".risk-filter";
    const EMPTY_ID = "risk-monitor-empty";

    let scheduled = false;

    function getRows() {
        return Array.from(document.querySelectorAll(ROW_SELECTOR));
    }

    function getSearchValue() {
        const input = document.querySelector(SEARCH_SELECTOR);
        return String(input?.value || "").trim().toLowerCase();
    }

    function getFilterValue() {
        const select = document.querySelector(FILTER_SELECTOR);
        return String(select?.value || "all").toLowerCase();
    }

    function removeEmptyState() {
        document.getElementById(EMPTY_ID)?.remove();
    }

    function applyFilters() {
        const rows = getRows();
        if (!rows.length) {
            removeEmptyState();
            return;
        }

        const query = getSearchValue();
        const level = getFilterValue();
        let visible = 0;

        rows.forEach((row) => {
            const zone = String(row.dataset.zone || "").toLowerCase();
            const rowText = String(row.textContent || "").toLowerCase();
            const matchesSearch = !query || zone.includes(query) || rowText.includes(query);
            const matchesLevel = level === "all" || String(row.dataset.level || "normal").toLowerCase() === level;
            const show = matchesSearch && matchesLevel;

            // Do not rely on the HTML `hidden` attribute here: the Risk Overview
            // presentation CSS explicitly makes rows `display:grid`, which can
            // override the browser's default hidden styling. Inline display is
            // deterministic and preserves the existing responsive grid when shown.
            row.style.display = show ? "" : "none";
            row.setAttribute("aria-hidden", show ? "false" : "true");
            if (show) visible += 1;
        });

        removeEmptyState();

        if (visible === 0) {
            const body = document.querySelector(".risk-monitor-body");
            if (body && !document.getElementById(EMPTY_ID)) {
                const empty = document.createElement("div");
                empty.id = EMPTY_ID;
                empty.className = "risk-empty";
                empty.textContent = query
                    ? `No monitored zones match “${query}”.`
                    : "No monitored zones match the selected risk level.";
                body.appendChild(empty);
            }
        }
    }

    function scheduleApplyFilters() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            applyFilters();
        });
    }

    function handleInput(event) {
        if (event.target?.matches?.(SEARCH_SELECTOR)) {
            scheduleApplyFilters();
        }
    }

    function handleChange(event) {
        if (event.target?.matches?.(FILTER_SELECTOR)) {
            scheduleApplyFilters();
        }
    }

    function handleKeydown(event) {
        if (event.key === "Enter" && event.target?.matches?.(SEARCH_SELECTOR)) {
            event.preventDefault();
            scheduleApplyFilters();
        }
    }

    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);
    document.addEventListener("keydown", handleKeydown);

    // app.js replaces the main content when switching views. Observe only
    // direct view replacements; never observe the whole document subtree.
    // This avoids a mutation -> filter -> mutation feedback loop and keeps
    // unrelated map/routing DOM updates from invoking the filter repeatedly.
    const observer = new MutationObserver((mutations) => {
        if (!mutations.some((mutation) => mutation.type === "childList")) return;
        if (document.querySelector(".risk-monitor")) {
            scheduleApplyFilters();
        }
    });

    function startObserver() {
        const mainContent = document.querySelector(".main-content");
        if (mainContent) {
            observer.observe(mainContent, { childList: true });
        }
        scheduleApplyFilters();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    } else {
        startObserver();
    }
})();