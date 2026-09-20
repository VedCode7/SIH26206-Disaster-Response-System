(function () {
    "use strict";

    // ============================================================
    // MAP TYPES
    // ============================================================

    const TYPES = {
        risk: {
            title: "Risk Heatmap",
            kicker: "SITUATIONAL RISK",
            description: "Ward-level risk concentration and severity.",
            legend: [
                ["normal", "Normal"],
                ["watch", "Watch"],
                ["high", "High"],
                ["critical", "Critical"]
            ]
        },

        flood: {
            title: "Flood Exposure",
            kicker: "HYDROLOGICAL VIEW",
            description: "Water depth and rainfall exposure across wards.",
            legend: [
                ["low", "Low"],
                ["watch", "Elevated"],
                ["high", "Severe"],
                ["critical", "Extreme"]
            ]
        },

        access: {
            title: "Accessibility",
            kicker: "MOBILITY VIEW",
            description: "Ward accessibility with restricted and blocked roads.",
            legend: [
                ["good", "Open"],
                ["watch", "Restricted"],
                ["critical", "Blocked"]
            ]
        },

        network: {
            title: "Road Network",
            kicker: "NETWORK VIEW",
            description: "Actual OSM road geometry and inter-ward connectivity.",
            legend: [
                ["good", "Open"],
                ["watch", "Restricted"],
                ["critical", "Blocked"]
            ]
        },

        response: {
            title: "Response Focus",
            kicker: "OPERATIONS VIEW",
            description: "Highest-risk wards and their surrounding road access.",
            legend: [
                ["critical", "Priority"],
                ["watch", "Watch"],
                ["good", "Available"]
            ]
        }
    };


    // ============================================================
    // GLOBAL STATE
    // ============================================================

    const state = {
        windows: new Map(),
        nextOffset: 0,
        z: 10000
    };


    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    const esc = (value) => {
        if (typeof escapeHTML === "function") {
            return escapeHTML(String(value));
        }

        return String(value).replace(
            /[&<>"']/g,
            (character) => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[character])
        );
    };


    const runtime = () => {
        return typeof DASHBOARD_RUNTIME !== "undefined"
            ? DASHBOARD_RUNTIME
            : null;
    };


    function data() {
        const r = runtime();

        if (r?.wards?.length && r?.roads?.length) {
            return {
                wards: r.wards,
                roads: r.roads
            };
        }

        return window.realDashboardGeoCache?.wards?.length &&
            window.realDashboardGeoCache?.roads?.length
            ? window.realDashboardGeoCache
            : null;
    }


    function assessments() {
        const r = runtime();

        if (r?.assessments instanceof Map) {
            return r.assessments;
        }

        return window.realDashboardAssessments instanceof Map
            ? window.realDashboardAssessments
            : new Map();
    }


    function wardId(ward) {
        const value =
            ward?.properties?.ward_id ??
            ward?.properties?.ward;

        return value == null ? null : `W${value}`;
    }


    function collect(value, output) {
        if (!Array.isArray(value)) {
            return;
        }

        if (
            value.length >= 2 &&
            Number.isFinite(Number(value[0])) &&
            Number.isFinite(Number(value[1]))
        ) {
            output.push([
                +value[0],
                +value[1]
            ]);

            return;
        }

        value.forEach((item) => {
            collect(item, output);
        });
    }


    // ============================================================
    // GEOGRAPHICAL PROJECTION
    // ============================================================

    function projectFor(dataSet, width, height) {
        const points = [];

        dataSet.roads.forEach((road) => {
            collect(road.path, points);
        });

        dataSet.wards.forEach((ward) => {
            collect(
                ward.geometry?.coordinates,
                points
            );
        });

        if (!points.length) {
            return null;
        }

        const xs = points.map((point) => point[0]);
        const ys = points.map((point) => point[1]);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const padding = 20;

        const sx = Math.max(
            maxX - minX,
            1e-6
        );

        const sy = Math.max(
            maxY - minY,
            1e-6
        );

        const scale = Math.min(
            (width - padding * 2) / sx,
            (height - padding * 2) / sy
        );

        const drawnWidth = sx * scale;
        const drawnHeight = sy * scale;

        const offsetX =
            (width - drawnWidth) / 2;

        const offsetY =
            (height - drawnHeight) / 2;

        return (longitude, latitude) => [
            offsetX +
                (+longitude - minX) * scale,

            height -
                (
                    offsetY +
                    (+latitude - minY) * scale
                )
        ];
    }


    // ============================================================
    // SVG GEOMETRY
    // ============================================================

    function geom(geometry, project) {
        if (!geometry) {
            return "";
        }

        const line = (coordinates) => {
            if (
                !Array.isArray(coordinates) ||
                coordinates.length <= 1
            ) {
                return "";
            }

            return coordinates
                .map((point, index) => {
                    const projected =
                        project(point[0], point[1]);

                    return `${
                        index ? "L" : "M"
                    }${projected[0].toFixed(2)} ${
                        projected[1].toFixed(2)
                    }`;
                })
                .join(" ");
        };


        const polygon = (rings) => {
            if (!Array.isArray(rings)) {
                return "";
            }

            return rings
                .map((ring) => {
                    const path = line(ring);

                    return path
                        ? path + " Z"
                        : "";
                })
                .filter(Boolean)
                .join(" ");
        };


        if (geometry.type === "Polygon") {
            return polygon(geometry.coordinates);
        }


        if (geometry.type === "MultiPolygon") {
            return geometry.coordinates
                .map(polygon)
                .filter(Boolean)
                .join(" ");
        }


        return "";
    }


    function centroid(geometry, project) {
        const points = [];

        collect(
            geometry?.coordinates,
            points
        );

        if (!points.length) {
            return null;
        }

        const longitude =
            points.reduce(
                (sum, point) => sum + point[0],
                0
            ) / points.length;

        const latitude =
            points.reduce(
                (sum, point) => sum + point[1],
                0
            ) / points.length;

        return project(
            longitude,
            latitude
        );
    }


    // ============================================================
    // RISK / FACTOR HELPERS
    // ============================================================

    function level(assessment) {
        return String(
            assessment?.risk_level || "normal"
        ).toLowerCase();
    }


    function factor(assessment, ...keys) {
        for (const key of keys) {
            const number =
                Number(
                    assessment?.factors?.[key]
                );

            if (Number.isFinite(number)) {
                return number;
            }
        }

        return 0;
    }


    function cls(type, assessment, road) {

        // Risk and response views
        if (
            type === "risk" ||
            type === "response"
        ) {
            return level(assessment);
        }


        // Flood view
        if (type === "flood") {
            const water =
                factor(
                    assessment,
                    "water_depth_m",
                    "water"
                );

            const rainfall =
                factor(
                    assessment,
                    "rainfall_mm_per_hr",
                    "rainfall"
                );

            if (
                water >= 2 ||
                rainfall >= 100
            ) {
                return "critical";
            }

            if (
                water >= 1 ||
                rainfall >= 50
            ) {
                return "high";
            }

            if (
                water > 0 ||
                rainfall > 0
            ) {
                return "watch";
            }

            return "low";
        }


        // Accessibility view
        if (type === "access") {
            const risk =
                factor(
                    assessment,
                    "accessibility_risk"
                );

            return risk < 25
              ? "good"
              : risk < 50
              ? "watch"
              : risk < 75
              ? "high"
              : "critical";
        }


        // Road / network view
        if (road) {
            return road.blocked
                ? "critical"
                : Number(
                    road.accessibility_percent ?? 100
                ) < 70
                    ? "watch"
                    : "good";
        }


        return "good";
    }


    // ============================================================
    // SVG MAP CREATION
    // ============================================================

    function makeSvg(type, dataSet) {
        const WIDTH = 720;
        const HEIGHT = 410;

        const project =
            projectFor(
                dataSet,
                WIDTH,
                HEIGHT
            );

        const assessmentMap =
            assessments();

        if (!project) {
            return null;
        }


        const svg =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
            );

        svg.classList.add(
            "map-studio-svg"
        );

        svg.setAttribute(
            "viewBox",
            `0 0 ${WIDTH} ${HEIGHT}`
        );

        svg.setAttribute(
            "preserveAspectRatio",
            "xMidYMid meet"
        );


        const namespace =
            svg.namespaceURI;


        const wards =
            document.createElementNS(
                namespace,
                "g"
            );

        const links =
            document.createElementNS(
                namespace,
                "g"
            );

        const roads =
            document.createElementNS(
                namespace,
                "g"
            );

        const markers =
            document.createElementNS(
                namespace,
                "g"
            );


        wards.classList.add(
            "studio-ward-layer"
        );

        links.classList.add(
            "studio-zone-links"
        );

        roads.classList.add(
            "studio-road-layer"
        );

        markers.classList.add(
            "studio-marker-layer"
        );


        // --------------------------------------------------------
        // Ward geometry
        // --------------------------------------------------------

        const centers = new Map();

        dataSet.wards.forEach((ward) => {
            const id = wardId(ward);

            const point =
                centroid(
                    ward.geometry,
                    project
                );

            if (id && point) {
                centers.set(
                    id,
                    point
                );
            }

            const path =
                geom(
                    ward.geometry,
                    project
                );

            if (!id || !path) {
                return;
            }

            const node =
                document.createElementNS(
                    namespace,
                    "path"
                );

            node.classList.add(
                "studio-ward",
                cls(
                    type,
                    assessmentMap.get(id)
                )
            );

            node.dataset.zoneId = id;

            node.setAttribute(
                "d",
                path
            );

            wards.appendChild(node);
        });


        // --------------------------------------------------------
        // Road geometry
        // --------------------------------------------------------

        dataSet.roads.forEach((road) => {
            if (
                !Array.isArray(road.path) ||
                road.path.length < 2
            ) {
                return;
            }

            const node =
                document.createElementNS(
                    namespace,
                    "path"
                );

            node.classList.add(
                "studio-road",
                cls(
                    type,
                    null,
                    road
                )
            );

            node.setAttribute(
                "d",
                road.path
                    .map((point, index) => {
                        const projected =
                            project(
                                point[0],
                                point[1]
                            );

                        return `${
                            index ? "L" : "M"
                        }${projected[0].toFixed(2)} ${
                            projected[1].toFixed(2)
                        }`;
                    })
                    .join(" ")
            );

            roads.appendChild(node);
        });


        // --------------------------------------------------------
        // Inter-zone connectivity
        // --------------------------------------------------------

        const seen = new Set();

        dataSet.roads.forEach((road) => {
            if (
                !centers.has(road.from_zone_id) ||
                !centers.has(road.to_zone_id)
            ) {
                return;
            }

            const key = [
                road.from_zone_id,
                road.to_zone_id
            ]
                .sort()
                .join("|");

            if (seen.has(key)) {
                return;
            }

            seen.add(key);

            const start =
                centers.get(
                    road.from_zone_id
                );

            const end =
                centers.get(
                    road.to_zone_id
                );


            const node =
                document.createElementNS(
                    namespace,
                    "line"
                );

            node.classList.add(
                "studio-zone-link",
                cls(
                    type,
                    assessmentMap.get(
                        road.from_zone_id
                    ),
                    road
                )
            );

            node.setAttribute(
                "x1",
                start[0]
            );

            node.setAttribute(
                "y1",
                start[1]
            );

            node.setAttribute(
                "x2",
                end[0]
            );

            node.setAttribute(
                "y2",
                end[1]
            );

            links.appendChild(node);
        });


        // --------------------------------------------------------
        // Ward markers
        // --------------------------------------------------------

        centers.forEach((point, id) => {
            const node =
                document.createElementNS(
                    namespace,
                    "circle"
                );

            node.classList.add(
                "studio-marker",
                cls(
                    type,
                    assessmentMap.get(id)
                )
            );

            node.dataset.zoneId = id;

            node.setAttribute(
                "cx",
                point[0]
            );

            node.setAttribute(
                "cy",
                point[1]
            );

            node.setAttribute(
                "r",
                "3"
            );

            markers.appendChild(node);
        });


        svg.append(
            wards,
            links,
            roads,
            markers
        );

        return svg;
    }


    // ============================================================
    // MAP STUDIO STYLES
    // ============================================================

    function ensureStyle() {
        if (
            document.getElementById(
                "final-map-studio-style"
            )
        ) {
            return;
        }


        const style =
            document.createElement("style");

        style.id =
            "final-map-studio-style";


        style.textContent = `
            .map-studio-topbar .final-actions {
                display: flex !important;
                flex-direction: row !important;
                gap: 6px !important;
                align-items: center;
            }

            .final-actions button {
                border: 1px solid rgba(127, 150, 184, 0.22);
                background: rgba(255, 255, 255, 0.035);
                color: #aebfd6;
                border-radius: 8px;
                padding: 8px 11px;
                font: 700 10px/1 inherit;
                cursor: pointer;
            }

            .final-actions button:hover {
                border-color: rgba(255, 178, 29, 0.65);
                color: #fff;
            }

            .map-studio-window {
                min-height: 360px;
            }

            .map-studio-body {
                position: relative;
            }

            .map-studio-svg {
                touch-action: none;
            }

            .map-v-final-tooltip {
                position: absolute;
                z-index: 20;
                min-width: 190px;
                max-width: 240px;
                padding: 10px 11px;
                border: 1px solid rgba(83, 113, 153, 0.45);
                border-radius: 10px;
                background: rgba(7, 12, 20, 0.97);
                box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
                pointer-events: none;
                color: #dce8f7;
            }

            .map-v-final-tooltip b {
                display: block;
                color: #fff;
                font-size: 12px;
            }

            .map-v-final-tooltip span {
                display: block;
                color: #8fa5c0;
                font-size: 10px;
                margin-top: 3px;
            }

            .map-v-final-tooltip strong {
                display: block;
                color: #35d07f;
                font-size: 11px;
                margin-top: 8px;
            }

            .studio-marker {
                cursor: pointer;
            }

            .studio-marker.selected {
                stroke: #fff;
                stroke-width: 1.8;
            }

            .studio-marker.hovered {
                stroke: #fff;
                stroke-width: 1.6;
            }

            .studio-ward.hovered {
                filter: brightness(1.7);
            }

            .map-studio-loading {
                height: 260px;
                display: grid;
                place-items: center;
                color: #8ba0bb;
                font-size: 12px;
            }

            .map-studio-error {
                height: 260px;
                display: grid;
                place-items: center;
                text-align: center;
                color: #8ba0bb;
                padding: 20px;
            }

            .map-studio-error strong {
                color: #fff;
            }

            .map-studio-window .studio-road {
                pointer-events: none;
            }
        `;

        document.head.appendChild(style);
    }


    // ============================================================
    // MAP STUDIO HOST
    // ============================================================

    function host() {
        let hostElement =
            document.querySelector(
                ".map-studio-host"
            );

        if (hostElement) {
            return hostElement;
        }


        hostElement =
            document.createElement("div");

        hostElement.className =
            "map-studio-host";


        hostElement.innerHTML = `
            <div class="map-studio-backdrop"></div>

            <div class="map-studio-topbar">
                <div>
                    <span>LIVE GEOSPATIAL WORKSPACE</span>
                    <strong>Chennai Map Studio</strong>
                </div>

                <div class="final-actions">
                    <button data-final="open">
                        Open all
                    </button>

                    <button data-final="tile">
                        Tile
                    </button>

                    <button data-final="stack">
                        Stack
                    </button>

                    <button data-final="close">
                        Close workspace
                    </button>
                </div>
            </div>
        `;


        document.body.appendChild(
            hostElement
        );


        hostElement
            .querySelector(
                "[data-final=close]"
            )
            .onclick = close;


        hostElement
            .querySelector(
                ".map-studio-backdrop"
            )
            .onclick = close;


        hostElement
            .querySelector(
                "[data-final=open]"
            )
            .onclick = () => {
                Object.keys(TYPES).forEach(
                    open
                );
            };


        hostElement
            .querySelector(
                "[data-final=tile]"
            )
            .onclick = tile;


        hostElement
            .querySelector(
                "[data-final=stack]"
            )
            .onclick = stack;


        return hostElement;
    }


    // ============================================================
    // MAP TOOLTIP
    // ============================================================

    function tooltip(win, event, id) {
        const assessment =
            assessments().get(id);

        if (!assessment) {
            return;
        }


        let tooltipElement =
            win.querySelector(
                ".map-v-final-tooltip"
            );


        if (!tooltipElement) {
            tooltipElement =
                document.createElement("div");

            tooltipElement.className =
                "map-v-final-tooltip";

            win
                .querySelector(
                    ".map-studio-body"
                )
                .appendChild(
                    tooltipElement
                );
        }


        const water =
            factor(
                assessment,
                "water_depth_m",
                "water"
            );

        const rainfall =
            factor(
                assessment,
                "rainfall_mm_per_hr",
                "rainfall"
            );


        const accessibility =
            assessment.factors?.accessibility_percent != null
                ? Number(
                    assessment.factors.accessibility_percent
                )
                : Math.max(
                    0,
                    100 -
                    factor(
                        assessment,
                        "accessibility_risk"
                    )
                );


        tooltipElement.innerHTML = `
            <b>
                ${esc(id)} ·
                ${esc(level(assessment).toUpperCase())}
            </b>

            <span>
                Risk score
                ${Number(
                    assessment.risk_score ?? 0
                ).toFixed(2)}
                / 100
            </span>

            <strong>
                Water ${water.toFixed(2)} m ·
                Rain ${rainfall.toFixed(0)} mm/hr ·
                Access ${accessibility.toFixed(0)}%
            </strong>
        `;


        const rect =
            win.getBoundingClientRect();

        const tooltipWidth =
            tooltipElement.offsetWidth || 210;

        const tooltipHeight =
            tooltipElement.offsetHeight || 80;


        let x =
            event.clientX -
            rect.left +
            12;

        let y =
            event.clientY -
            rect.top +
            12;


        x = Math.min(
            Math.max(8, x),
            Math.max(
                8,
                rect.width -
                tooltipWidth -
                8
            )
        );


        y = Math.min(
            Math.max(8, y),
            Math.max(
                8,
                rect.height -
                tooltipHeight -
                8
            )
        );


        tooltipElement.style.left =
            x + "px";

        tooltipElement.style.top =
            y + "px";

        tooltipElement.hidden = false;
    }


    // ============================================================
    // MAP INTERACTION / ZOOM / PAN
    // ============================================================

    function bind(win) {
        const svg =
            win.querySelector("svg");

        if (
            !svg ||
            svg.dataset.finalBound
        ) {
            return;
        }

        svg.dataset.finalBound = "1";


        const body =
            win.querySelector(
                ".map-studio-body"
            );


        let box = {
            ...svg.viewBox.baseVal
        };

        let drag = false;
        let moved = false;

        let last = [
            0,
            0
        ];


        // --------------------------------------------------------
        // Fit map to available bounds
        // --------------------------------------------------------

        const fit = () => {
            try {
                const bounds =
                    svg.getBBox();

                if (
                    bounds.width &&
                    bounds.height
                ) {
                    box = {
                        x: bounds.x - 15,
                        y: bounds.y - 15,
                        width:
                            bounds.width + 30,
                        height:
                            bounds.height + 30
                    };

                    svg.setAttribute(
                        "viewBox",
                        `${box.x} ${box.y} ${box.width} ${box.height}`
                    );
                }
            } catch {
                // Ignore SVG bounding-box failures.
            }
        };


        // --------------------------------------------------------
        // Zoom
        // --------------------------------------------------------

        const zoom = (
            factorValue,
            x = null,
            y = null
        ) => {
            const width =
                Math.max(
                    35,
                    Math.min(
                        1000,
                        box.width *
                        factorValue
                    )
                );

            const height =
                Math.max(
                    28,
                    Math.min(
                        700,
                        box.height *
                        factorValue
                    )
                );


            const relativeX =
                x == null
                    ? 0.5
                    : (x - box.x) /
                      box.width;


            const relativeY =
                y == null
                    ? 0.5
                    : (y - box.y) /
                      box.height;


            box = {
                x:
                    x == null
                        ? box.x +
                          (
                              box.width -
                              width
                          ) / 2
                        : x -
                          width *
                          relativeX,

                y:
                    y == null
                        ? box.y +
                          (
                              box.height -
                              height
                          ) / 2
                        : y -
                          height *
                          relativeY,

                width,
                height
            };


            svg.setAttribute(
                "viewBox",
                `${box.x} ${box.y} ${box.width} ${box.height}`
            );
        };


        // --------------------------------------------------------
        // Map controls
        // --------------------------------------------------------

        const controls =
            document.createElement("div");

        controls.className =
            "final-map-controls";

        controls.innerHTML = `
            <button>+</button>
            <button>−</button>
            <button>⌖</button>
        `;


        controls.style.cssText =
            "position:absolute;" +
            "right:14px;" +
            "top:14px;" +
            "z-index:12;" +
            "display:flex;" +
            "gap:4px";


        controls
            .querySelectorAll("button")
            .forEach((button) => {
                button.style.cssText =
                    "width:30px;" +
                    "height:30px;" +
                    "border:1px solid rgba(127,150,184,.25);" +
                    "background:rgba(8,13,21,.9);" +
                    "color:#dce8f7;" +
                    "border-radius:7px;" +
                    "cursor:pointer";
            });


        controls.children[0].onclick =
            () => zoom(0.8);

        controls.children[1].onclick =
            () => zoom(1.25);

        controls.children[2].onclick =
            fit;


        body.appendChild(
            controls
        );


        // --------------------------------------------------------
        // Mouse wheel zoom
        // --------------------------------------------------------

        svg.addEventListener(
            "wheel",
            (event) => {
                event.preventDefault();

                const rect =
                    svg.getBoundingClientRect();

                const point = {
                    x:
                        box.x +
                        (
                            event.clientX -
                            rect.left
                        ) /
                        rect.width *
                        box.width,

                    y:
                        box.y +
                        (
                            event.clientY -
                            rect.top
                        ) /
                        rect.height *
                        box.height
                };


                zoom(
                    event.deltaY > 0
                        ? 1.1
                        : 0.9,
                    point.x,
                    point.y
                );
            },
            {
                passive: false
            }
        );


        // --------------------------------------------------------
        // Pointer down
        // --------------------------------------------------------

        svg.addEventListener(
            "pointerdown",
            (event) => {
                if (event.button !== 0) {
                    return;
                }

                drag = true;
                moved = false;

                last = [
                    event.clientX,
                    event.clientY
                ];

                svg.setPointerCapture?.(
                    event.pointerId
                );
            }
        );


        // --------------------------------------------------------
        // Pointer move
        // --------------------------------------------------------

        svg.addEventListener(
            "pointermove",
            (event) => {

                const target =
                    event.target.closest?.(
                        ".studio-ward,.studio-marker"
                    );


                // Hover behaviour
                if (!drag) {
                    if (target) {
                        tooltip(
                            win,
                            event,
                            target.dataset.zoneId
                        );

                        target.classList.add(
                            "hovered"
                        );
                    }

                    return;
                }


                // Panning behaviour
                const rect =
                    svg.getBoundingClientRect();

                const dx =
                    event.clientX -
                    last[0];

                const dy =
                    event.clientY -
                    last[1];


                if (
                    Math.abs(dx) +
                    Math.abs(dy) >
                    3
                ) {
                    moved = true;
                }


                box.x -=
                    dx /
                    rect.width *
                    box.width;

                box.y -=
                    dy /
                    rect.height *
                    box.height;


                last = [
                    event.clientX,
                    event.clientY
                ];


                svg.setAttribute(
                    "viewBox",
                    `${box.x} ${box.y} ${box.width} ${box.height}`
                );
            }
        );


        // --------------------------------------------------------
        // Pointer up
        // --------------------------------------------------------

        svg.addEventListener(
            "pointerup",
            (event) => {
                drag = false;

                svg.releasePointerCapture?.(
                    event.pointerId
                );
            }
        );


        // --------------------------------------------------------
        // Pointer leave
        // --------------------------------------------------------

        svg.addEventListener(
            "pointerleave",
            () => {
                win
                    .querySelectorAll(
                        ".hovered"
                    )
                    .forEach((node) => {
                        node.classList.remove(
                            "hovered"
                        );
                    });


                const tooltipElement =
                    win.querySelector(
                        ".map-v-final-tooltip"
                    );

                if (tooltipElement) {
                    tooltipElement.hidden = true;
                }
            }
        );


        // --------------------------------------------------------
        // Click / zone selection
        // --------------------------------------------------------

        svg.addEventListener(
            "click",
            (event) => {
                if (moved) {
                    moved = false;
                    return;
                }


                const node =
                    event.target.closest?.(
                        ".studio-ward,.studio-marker"
                    );


                if (
                    node &&
                    typeof selectDashboardZone ===
                        "function"
                ) {
                    selectDashboardZone(
                        node.dataset.zoneId
                    );
                }
            }
        );


        fit();
    }


    // ============================================================
    // WINDOW CREATION
    // ============================================================

    function create(type) {
        if (state.windows.has(type)) {
            const existing =
                state.windows.get(type);

            existing.style.zIndex =
                ++state.z;

            return existing;
        }


        const hostElement =
            host();

        const specification =
            TYPES[type];


        const element =
            document.createElement("section");

        element.className =
            "map-studio-window";


        const offset =
            (
                state.nextOffset++ % 4
            ) * 30;


        element.style.left =
            `${40 + offset}px`;

        element.style.top =
            `${84 + offset}px`;

        element.style.zIndex =
            ++state.z;


        element.innerHTML = `
            <header class="map-studio-window-head">
                <div>
                    <span class="map-studio-kicker">
                        ${esc(specification.kicker)}
                    </span>

                    <strong>
                        ${esc(specification.title)}
                    </strong>

                    <small>
                        ${esc(specification.description)}
                    </small>
                </div>

                <button
                    class="map-studio-close"
                    type="button"
                >
                    ×
                </button>
            </header>

            <div class="map-studio-body">
                <div class="map-studio-loading">
                    Preparing live Chennai view…
                </div>

                <div class="map-studio-legend">
                    ${specification.legend
                        .map(
                            (item) => `
                                <span>
                                    <i class="${esc(item[0])}"></i>
                                    ${esc(item[1])}
                                </span>
                            `
                        )
                        .join("")}
                </div>
            </div>
        `;


        hostElement.appendChild(
            element
        );

        state.windows.set(
            type,
            element
        );


        element
            .querySelector(
                ".map-studio-close"
            )
            .onclick = () => {
                element.remove();

                state.windows.delete(
                    type
                );
            };


        dragHead(element);
        hydrate(element, type);

        return element;
    }


    // ============================================================
    // DATA HYDRATION
    // ============================================================

    async function hydrate(el, type) {
        const body =
            el.querySelector(
                ".map-studio-body"
            );


        for (let i = 0; i < 100; i++) {
            const dataSet = data();

            if (dataSet) {
                const svg =
                    makeSvg(
                        type,
                        dataSet
                    );


                if (svg) {
                    const legend =
                        body.querySelector(
                            ".map-studio-legend"
                        );

                    body.replaceChildren(
                        svg
                    );

                    body.appendChild(
                        legend
                    );

                    bind(el);

                    return;
                }
            }


            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        100
                    )
            );
        }


        // --------------------------------------------------------
        // Data unavailable
        // --------------------------------------------------------

        body.innerHTML = `
            <div class="map-studio-error">
                <div>
                    <strong>
                        Chennai geography is unavailable.
                    </strong>

                    <br>

                    <span>
                        Dashboard data did not become available.
                    </span>

                    <br>

                    <button type="button">
                        Retry
                    </button>
                </div>
            </div>
        `;


        body
            .querySelector("button")
            .onclick = () => {
                body.innerHTML = `
                    <div class="map-studio-loading">
                        Preparing live Chennai view…
                    </div>
                `;

                hydrate(
                    el,
                    type
                );
            };
    }


    // ============================================================
    // WINDOW DRAGGING
    // ============================================================

    function dragHead(el) {
        const header =
            el.querySelector(
                ".map-studio-window-head"
            );


        let drag = false;

        let startX = 0;
        let startY = 0;

        let offsetX = 0;
        let offsetY = 0;


        header.addEventListener(
            "pointerdown",
            (event) => {
                if (
                    event.target.closest(
                        "button"
                    )
                ) {
                    return;
                }


                drag = true;

                startX =
                    event.clientX;

                startY =
                    event.clientY;


                const rect =
                    el.getBoundingClientRect();

                const parent =
                    host().getBoundingClientRect();


                offsetX =
                    rect.left -
                    parent.left;

                offsetY =
                    rect.top -
                    parent.top;


                header.setPointerCapture?.(
                    event.pointerId
                );
            }
        );


        header.addEventListener(
            "pointermove",
            (event) => {
                if (!drag) {
                    return;
                }


                const parent =
                    host().getBoundingClientRect();


                el.style.left =
                    Math.max(
                        8,
                        Math.min(
                            parent.width -
                            el.offsetWidth -
                            8,

                            offsetX +
                            event.clientX -
                            startX
                        )
                    ) + "px";


                el.style.top =
                    Math.max(
                        76,
                        Math.min(
                            parent.height -
                            el.offsetHeight -
                            8,

                            offsetY +
                            event.clientY -
                            startY
                        )
                    ) + "px";
            }
        );


        header.addEventListener(
            "pointerup",
            () => {
                drag = false;
            }
        );
    }


    // ============================================================
    // WORKSPACE CONTROLS
    // ============================================================

    function open(type) {
        const hostElement =
            host();

        hostElement.hidden = false;

        create(type);
    }


    function close() {
        const hostElement =
            document.querySelector(
                ".map-studio-host"
            );


        if (hostElement) {
            hostElement.hidden = true;
        }


        state.windows.forEach(
            (windowElement) => {
                windowElement.remove();
            }
        );


        state.windows.clear();

        state.nextOffset = 0;
    }


    // ------------------------------------------------------------
    // Tile windows
    // ------------------------------------------------------------

    function tile() {
        const hostElement =
            host();

        const windows =
            [
                ...state.windows.values()
            ];


        if (!windows.length) {
            return;
        }


        const columns =
            windows.length < 3
                ? windows.length
                : 2;


        const gap = 14;


        const width =
            Math.max(
                320,
                (
                    hostElement.clientWidth -
                    gap * (columns + 1)
                ) / columns
            );


        const rows =
            Math.ceil(
                windows.length /
                columns
            );


        const height =
            Math.max(
                260,
                (
                    hostElement.clientHeight -
                    100 -
                    gap * (rows + 1)
                ) / rows
            );


        windows.forEach(
            (windowElement, index) => {
                const row =
                    Math.floor(
                        index /
                        columns
                    );

                const column =
                    index %
                    columns;


                windowElement.style.left =
                    gap +
                    column *
                    (width + gap) +
                    "px";


                windowElement.style.top =
                    86 +
                    row *
                    (height + gap) +
                    "px";


                windowElement.style.width =
                    width + "px";


                windowElement.style.height =
                    height + "px";
            }
        );
    }


    // ------------------------------------------------------------
    // Stack windows
    // ------------------------------------------------------------

    function stack() {
        const hostElement =
            host();


        [
            ...state.windows.values()
        ].forEach(
            (windowElement, index) => {
                windowElement.style.width =
                    "min(760px, calc(100vw - 80px))";

                windowElement.style.height =
                    "min(560px, calc(100vh - 140px))";

                windowElement.style.left =
                    40 +
                    index * 22 +
                    "px";

                windowElement.style.top =
                    86 +
                    index * 22 +
                    "px";

                windowElement.style.zIndex =
                    ++state.z;
            }
        );
    }


    // ============================================================
    // DASHBOARD LAUNCHER
    // ============================================================

    function launcher() {
        const header =
            document.querySelector(
                ".map-panel .panel-header"
            );


        if (
            !header ||
            header.querySelector(
                ".map-insight-launcher-final"
            )
        ) {
            return;
        }


        const button =
            document.createElement("button");

        button.className =
            "map-insight-launcher-enhanced " +
            "map-insight-launcher-final";

        button.type = "button";

        button.innerHTML =
            "MAP STUDIO <b>↗</b>";


        button.onclick = () => {
            open("risk");
        };


        header.appendChild(
            button
        );
    }


    // ============================================================
    // BOOTSTRAP
    // ============================================================

    function boot() {
        ensureStyle();
        launcher();
    }


    // ============================================================
    // PUBLIC API
    // ============================================================

    window.openMapStudio = open;

    window.refreshMapStudio = () => {};


    // ============================================================
    // INITIALIZATION
    // ============================================================

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once: true
            }
        );
    } else {
        boot();
    }

})();