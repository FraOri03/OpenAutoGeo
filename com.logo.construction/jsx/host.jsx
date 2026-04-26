// ============================================================
// SMART CONSTRUCTION ENGINE v0.19
// Construction Circles: rilevamento per PathItem (Forma).
// Il centro viene snappato alle intersezioni della griglia.
// ============================================================

function runProceduralGrid(lineSize, isDashed, showCircles, showHandles, minScore) {
    minScore = (minScore === undefined || minScore < 1) ? 2 : minScore;

    try {
        if (app.documents.length === 0) return "Error: Nessun documento aperto.";
        var doc = app.activeDocument;
        var sel = doc.selection;

        if (!sel || sel.length === 0) return "Error: Seleziona un tracciato vettoriale.";

        var layer = getOrCreateLayer("SMART_CONSTRUCTION");
        layer.pageItems.removeAll();

        var colCyan = createRGB(0, 160, 210);
        var colRed  = createRGB(220, 30, 30);

        var pts    =[];
        var bounds = [
            sel[0].visibleBounds[0],
            sel[0].visibleBounds[1],
            sel[0].visibleBounds[2],
            sel[0].visibleBounds[3]
        ];

        // ── 1. RACCOLTA PUNTI E BOUNDING BOX ──────────────────────────
        function collect(items) {
            for (var i = 0; i < items.length; i++) {
                var it = items[i];
                try {
                    var b = it.visibleBounds;
                    if (b[0] < bounds[0]) bounds[0] = b[0];
                    if (b[1] > bounds[1]) bounds[1] = b[1];
                    if (b[2] > bounds[2]) bounds[2] = b[2];
                    if (b[3] < bounds[3]) bounds[3] = b[3];
                } catch(e) {}

                if      (it.typename === "PathItem")         { for (var p = 0; p < it.pathPoints.length; p++) pts.push(it.pathPoints[p]); }
                else if (it.typename === "GroupItem")        { collect(it.pageItems); }
                else if (it.typename === "CompoundPathItem") { collect(it.pathItems); }
            }
        }
        collect(sel);

        if (pts.length === 0) return "Error: Nessun punto vettoriale trovato. Hai fatto 'Oggetto > Espandi'?";

        // ── 2. FREQUENCY MAP (griglia) ────────────────────────────────
        var tol  = 3;
        var xMap = [];
        var yMap =[];

        for (var i = 0; i < pts.length; i++) {
            var a = pts[i].anchor;
            scoreCoord(xMap, a[0], tol);
            scoreCoord(yMap, a[1], tol);
        }

        var maxX = maxCount(xMap);
        var maxY = maxCount(yMap);
        var drawnX = 0, drawnY = 0;

        // ── 3. DISEGNO LINEE FILTRATE ─────────────────────────────────
        var ext = 60;

        for (var i = 0; i < xMap.length; i++) {
            if (xMap[i].count >= minScore) {
                var op = scoreToOpacity(xMap[i].count, maxX);
                drawL(layer, [xMap[i].val, bounds[1] + ext], [xMap[i].val, bounds[3] - ext], colCyan, lineSize, isDashed, op);
                drawnX++;
            }
        }
        for (var i = 0; i < yMap.length; i++) {
            if (yMap[i].count >= minScore) {
                var op = scoreToOpacity(yMap[i].count, maxY);
                drawL(layer, [bounds[0] - ext, yMap[i].val], [bounds[2] + ext, yMap[i].val], colCyan, lineSize, isDashed, op);
                drawnY++;
            }
        }

        // ── 4. CERCHI COSTRUTTIVI (Shape Algorithm) ───────────────────
        var circleCount = 0;
        if (showCircles) {
            circleCount = detectAndDrawCircles(layer, sel, xMap, yMap, colRed, lineSize, tol);
        }

        // ── 5. MANIGLIE E NODI ────────────────────────────────────────
        for (var i = 0; i < pts.length; i++) {
            var a    = pts[i].anchor;
            var lDir = pts[i].leftDirection;
            var rDir = pts[i].rightDirection;

            if (showHandles) {
                drawH(layer, a, lDir, colCyan, lineSize);
                drawH(layer, a, rDir, colCyan, lineSize);
            }

            drawMarker(layer, a, lineSize * 4, colCyan);
        }

        // Ritorna le statistiche complete per il pannello
        return "Success|" + xMap.length + "|" + drawnX + "|" + yMap.length + "|" + drawnY + "|" + pts.length + "|" + circleCount;

    } catch(err) {
        return "Error: " + err.message + " (Linea: " + err.line + ")";
    }
}

// ============================================================
// RILEVAMENTO CERCHI COSTRUTTIVI
// ============================================================
var SNAP_TOL = 12;
var CIRCLE_RATIO = 0.90;   
var ELLIPSE_RATIO = 0.45;  
var MIN_SIZE = 10;

function detectAndDrawCircles(layer, items, xMap, yMap, col, lineSize, tol) {
    var count = 0;
    for (var i = 0; i < items.length; i++) {
        var it = items[i];

        if (it.typename === "PathItem") {
            if (!it.closed || it.pathPoints.length < 3) continue;

            var b = it.visibleBounds;  
            var w = b[2] - b[0];       
            var h = b[1] - b[3];       

            if (w < MIN_SIZE || h < MIN_SIZE) continue;

            var ratio = Math.min(w, h) / Math.max(w, h);
            if (ratio < ELLIPSE_RATIO) continue; 

            var cx = (b[0] + b[2]) / 2;
            var cy = (b[1] + b[3]) / 2;

            cx = snapToGrid(cx, xMap, SNAP_TOL);
            cy = snapToGrid(cy, yMap, SNAP_TOL);

            if (ratio >= CIRCLE_RATIO) {
                var r = Math.max(w, h) / 2;
                drawC(layer, cx, cy, r, col, lineSize * 1.5);
            } else {
                var rx = w / 2;
                var ry = h / 2;
                drawE(layer, cx, cy, rx, ry, col, lineSize * 1.5);
            }
            count++;

        } else if (it.typename === "GroupItem") {
            count += detectAndDrawCircles(layer, it.pageItems, xMap, yMap, col, lineSize, tol);
        } else if (it.typename === "CompoundPathItem") {
            count += detectAndDrawCircles(layer, it.pathItems, xMap, yMap, col, lineSize, tol);
        }
    }
    return count;
}

function snapToGrid(val, map, tol) {
    var best = val;
    var bestDist = tol + 1; 
    for (var i = 0; i < map.length; i++) {
        var d = Math.abs(map[i].val - val);
        if (d < bestDist) { bestDist = d; best = map[i].val; }
    }
    return (bestDist <= tol) ? best : val;
}

// ============================================================
// HELPERS GEOMETRICI & DRAW
// ============================================================
function scoreCoord(map, val, tol) {
    for (var i = 0; i < map.length; i++) {
        if (Math.abs(map[i].val - val) <= tol) { map[i].count++; return; }
    }
    map.push({ val: val, count: 1 });
}
function maxCount(map) {
    var m = 1;
    for (var i = 0; i < map.length; i++) if (map[i].count > m) m = map[i].count;
    return m;
}
function scoreToOpacity(count, maxC) {
    var t = (maxC > 1) ? (count - 1) / (maxC - 1) : 1;
    return Math.round(45 + t * 40);
}
function drawL(l, p1, p2, col, sw, d, opacity) {
    var ln = l.pathItems.add(); ln.setEntirePath([p1, p2]);
    ln.filled = false; ln.stroked = true; ln.strokeColor = col; ln.strokeWidth = sw;
    if (d) ln.strokeDasharray = [4, 2];
    ln.opacity = (opacity !== undefined) ? opacity : 60;
}
function drawC(l, cx, cy, r, col, sw) {
    var c = l.pathItems.ellipse(cy + r, cx - r, r * 2, r * 2);
    c.filled = false; c.stroked = true; c.strokeColor = col; c.strokeWidth = sw; c.opacity = 70;
}
function drawE(l, cx, cy, rx, ry, col, sw) {
    var e = l.pathItems.ellipse(cy + ry, cx - rx, rx * 2, ry * 2);
    e.filled = false; e.stroked = true; e.strokeColor = col; e.strokeWidth = sw; e.opacity = 55;
}
function drawH(l, a, h, col, sw) {
    if (dist(a, h) < 1) return;
    var ln = l.pathItems.add(); ln.setEntirePath([a, h]);
    ln.stroked = true; ln.strokeWidth = sw * 0.5; ln.strokeColor = col; ln.opacity = 50;
    var r = sw * 1.5; var d = l.pathItems.ellipse(h[1] + r, h[0] - r, r * 2, r * 2);
    d.fillColor = col; d.stroked = false;
}
function drawMarker(l, pos, size, col) {
    var m = l.pathItems.rectangle(pos[1] + (size / 2), pos[0] - (size / 2), size, size);
    m.fillColor = col; m.stroked = false;
}
function dist(p1, p2) { return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)); }
function createRGB(r, g, b) { var c = new RGBColor(); c.red = r; c.green = g; c.blue = b; return c; }
function getOrCreateLayer(n) {
    try { return app.activeDocument.layers.getByName(n); }
    catch(e) { var l = app.activeDocument.layers.add(); l.name = n; return l; }
}
function clearConstructionLayers() {
    try { app.activeDocument.layers.getByName("SMART_CONSTRUCTION").remove(); } catch(e) {}
}