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
        if (!rows.length) return;

        const query = getSearchValue();
        const level = getFilterValue();
        let visible = 0;

        rows.forEach((row) => {
            const zone = String(row.dataset.zone || "").toLowerCase();
            const rowText = String(row.textContent || "").toLowerCase();
            const matchesSearch = !query || zone.includes(query) || rowText.includes(query);
            const matchesLevel = level === "all" || String(row.dataset.level || "normal").toLowerCase() === level;
            const show = matchesSearch && matchesLevel;

            row.hidden = !show;
            if (show) visible += 1;
        });

        removeEmptyState();

        if (visible === 0) {
            const body = document.querySelector(".risk-monitor-body");
            if (body) {
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

    function handleInput(event) {
        if (event.target?.matches?.(SEARCH_SELECTOR)) {
            applyFilters();
        }
    }

    function handleChange(event) {
        if (event.target?.matches?.(FILTER_SELECTOR)) {
            applyFilters();
        }
    }

    document.addEventListener("input", handleInput);
    document.addEventListener("change", handleChange);

    // Risk Overview is rendered dynamically by app.js. Observe only the
    // monitor container so the current filter is reapplied after a rerender.
    const observer = new MutationObserver((mutations) => {
        if (!document.querySelector(".risk-monitor")) return;
        if (mutations.some((mutation) => mutation.type === "childList")) {
            applyFilters();
        }
    });

    function startObserver() {
        observer.observe(document.body, { childList: true, subtree: true });
        applyFilters();
    }

    if (document.body) {
        startObserver();
    } else {
        document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    }
})();
