/* Enrique Alabort — personal site
   A stochastic strut lattice (Poisson-disc nodes, Delaunay struts) that grows
   in on load, thickens around the cursor, freezes on scroll, and then prints
   bottom-up into metal as the page is scrolled. */
(function () {
    'use strict';

    var TAU = Math.PI * 2;
    var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduced = function () { return reduceMotionQuery.matches; };
    var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };

    /* ===== Footer year ===== */
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    /* ===== Smooth scrolling for in-page links ===== */
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
        });
    });

    /* ===== Active section link ===== */
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.topbar-links a'));
    if (navLinks.length && 'IntersectionObserver' in window) {
        var linkById = {};
        navLinks.forEach(function (link) { linkById[link.getAttribute('href').slice(1)] = link; });
        var sectionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var link = linkById[entry.target.id];
                if (link) link.classList.toggle('is-active', entry.isIntersecting);
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        Object.keys(linkById).forEach(function (id) {
            var section = document.getElementById(id);
            if (section) sectionObserver.observe(section);
        });
    }

    /* ===== Reveal cards on scroll ===== */
    (function () {
        var items = document.querySelectorAll('.card');
        if (!items.length) return;
        if (!('IntersectionObserver' in window) || reduced()) return;
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('in-view');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        items.forEach(function (item, i) {
            item.classList.add('reveal');
            item.style.transitionDelay = (Math.min(i % 4, 3) * 60) + 'ms';
            observer.observe(item);
        });
    })();

    /* ===== Rotating words in the hero ===== */
    (function () {
        var dynamicWords = document.querySelectorAll('.dynamic-word');
        if (!dynamicWords.length || reduced()) return;
        dynamicWords.forEach(function (el, index) {
            var words;
            try { words = JSON.parse(el.getAttribute('data-words')); } catch (err) { return; }
            if (!Array.isArray(words) || words.length < 2) return;
            var current = 0, timer = null;
            function rotate() {
                if (document.hidden) return;
                el.style.opacity = '0';
                el.style.transform = 'translateY(-8px)';
                setTimeout(function () {
                    current = (current + 1) % words.length;
                    el.textContent = words[current];
                    el.style.opacity = '1';
                    el.style.transform = 'translateY(0)';
                }, 380);
            }
            setTimeout(function () { timer = setInterval(rotate, 3200); }, 3200 + index * 1600);
            reduceMotionQuery.addEventListener('change', function (e) {
                if (e.matches && timer) { clearInterval(timer); timer = null; }
            });
        });
    })();

    /* =====================================================================
       Lattice
       ===================================================================== */
    var canvas = document.getElementById('lattice');
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');
    var slider = document.getElementById('densitySlider');
    var densityValue = document.getElementById('densityValue');
    var regenBtn = document.getElementById('regenBtn');
    var topbar = document.getElementById('topbar');

    var ACCENT = '143, 216, 255';
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var METAL_DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    var FIELD_R = 270;                 // cursor field radius, CSS px
    var CELL = 96;                     // spatial hash cell, CSS px
    var LX = -0.55, LY = -0.83;        // light direction for the metal render
    var MIN_SIN = Math.sin(30 * Math.PI / 180);   // struts flatter than 30° to horizontal are dropped

    // Geometry
    var W = 0, H = 0;
    var spacing = 60;
    var nodes = [];                    // [{x, y}]
    var edges = [];                    // [{a, b, mx, my, len, d0, d1}]
    var adj = [];                      // node index -> [edge index]
    var grid = [], gcols = 0, grows = 0;
    var maxDepth = 1;
    var edgeStamp = null, nodeStamp = null, stampNo = 0;

    // Layers
    var wire = document.createElement('canvas');
    var wctx = wire.getContext('2d');
    var metal = document.createElement('canvas');
    var mctx = metal.getContext('2d');
    var metalReady = false, metalGen = 0;
    var strutW = 5;

    // A tile of speckle, like partially fused powder on an as-built surface:
    // per-pixel grain plus soft blotches at two scales.
    var grainTile = (function () {
        var S = 192, c = document.createElement('canvas'); c.width = S; c.height = S;
        var g = c.getContext('2d');
        var img = g.createImageData(S, S), d = img.data;
        for (var i = 0; i < d.length; i += 4) {
            var v = (Math.random() - 0.5) * 2;
            var light = v > 0;
            d[i] = d[i + 1] = d[i + 2] = light ? 255 : 0;
            d[i + 3] = Math.abs(v) * 38;
        }
        g.putImageData(img, 0, 0);
        function blotches(count, rMin, rMax, aMax) {
            for (var k = 0; k < count; k++) {
                var light = Math.random() > 0.5, r = rMin + Math.random() * (rMax - rMin);
                g.fillStyle = (light ? 'rgba(255,255,255,' : 'rgba(0,0,0,') + (Math.random() * aMax) + ')';
                g.beginPath(); g.arc(Math.random() * S, Math.random() * S, r, 0, TAU); g.fill();
            }
        }
        blotches(900, 0.7, 1.8, 0.22);
        blotches(220, 1.8, 3.6, 0.12);
        blotches(60, 3.5, 6, 0.07);
        return c;
    })();
    var grainMain = ctx.createPattern(grainTile, 'repeat');
    var grainMetal = mctx.createPattern(grainTile, 'repeat');

    // Animation state
    var growing = false, growStart = 0, growDur = 1400;
    var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, over: false };
    var fieldA = 0;
    var frozen = false;
    var frontY = Infinity;             // melt line, viewport px; anchored to the page
    var zoomP = 0;                     // 0..1 through the final zoom-out into the implant
    var rafId = null;
    var partSection = document.getElementById('part');
    var aboutEnd = document.querySelector('#about .container > :last-child');
    var expStart = document.getElementById('experience-title');

    // The line sits in the gap between the Profile section's last card and
    // the Experience title, so it scrolls with the page: everything from
    // Experience down is printed, the hero and Profile stay as wire.
    function measureFront() {
        if (!aboutEnd || !expStart) return Infinity;
        var a = aboutEnd.getBoundingClientRect().bottom;
        var b = expStart.getBoundingClientRect().top;
        return (a + b) / 2;
    }

    var seed = (Math.random() * 0xffffffff) >>> 0;
    var rng = mulberry32(seed);

    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    /* ---------- Sizing ---------- */
    function sizeCanvases() {
        W = canvas.offsetWidth || window.innerWidth;
        H = canvas.offsetHeight || window.innerHeight;
        canvas.width = Math.round(W * DPR);
        canvas.height = Math.round(H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        wire.width = canvas.width;
        wire.height = canvas.height;
        wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    // Slider 0..100 -> target strut count, 600..3000, independent of screen
    // size. Spacing is derived from the count via the Poisson-disc packing
    // density and the fraction of Delaunay edges that survive the 30° rule.
    // Internal targets sit just inside 600..3000 so that, with the ±3%
    // tolerance below, the realised count never leaves that range.
    var STRUTS_MIN = 625, STRUTS_MAX = 2910;
    var STRUTS_PER_NODE = 1.9;
    function targetFor(v) {
        return Math.round(STRUTS_MIN + (STRUTS_MAX - STRUTS_MIN) * (v / 100));
    }
    function spacingForTarget(target) {
        var nodesWanted = target / STRUTS_PER_NODE;
        return Math.sqrt(W * H * 0.72 / nodesWanted);
    }

    /* ---------- Poisson-disc sampling (Bridson), on a torus ----------
       The domain wraps, so the lattice tiles seamlessly by plain translation.
       That is what lets the final zoom-out cover the implant's patch with
       copies of the on-screen lattice without a visible seam. */
    function poisson(w, h, r) {
        var k = 22, cs = r / Math.SQRT2;
        var gw = Math.ceil(w / cs), gh = Math.ceil(h / cs);
        var g = new Int32Array(gw * gh); g.fill(-1);
        var pts = [], active = [];
        var r2 = r * r;

        function wrap(v, size) { v = v % size; return v < 0 ? v + size : v; }
        function add(x, y) {
            var i = pts.length / 2;
            pts.push(x, y);
            g[((y / cs) | 0) * gw + ((x / cs) | 0)] = i;
            active.push(i);
        }
        add(rng() * w, rng() * h);

        while (active.length) {
            var ai = (rng() * active.length) | 0;
            var pi = active[ai], px = pts[pi * 2], py = pts[pi * 2 + 1];
            var found = false;
            for (var n = 0; n < k; n++) {
                var ang = rng() * TAU, rad = r * (1 + rng());
                var x = wrap(px + Math.cos(ang) * rad, w), y = wrap(py + Math.sin(ang) * rad, h);
                var gx = (x / cs) | 0, gy = (y / cs) | 0, ok = true;
                for (var yy = gy - 3; yy <= gy + 3 && ok; yy++) {
                    var cy = ((yy % gh) + gh) % gh;
                    for (var xx = gx - 3; xx <= gx + 3; xx++) {
                        var j = g[cy * gw + ((xx % gw) + gw) % gw];
                        if (j < 0) continue;
                        var dx = Math.abs(pts[j * 2] - x), dy = Math.abs(pts[j * 2 + 1] - y);
                        if (dx > w / 2) dx = w - dx;
                        if (dy > h / 2) dy = h - dy;
                        if (dx * dx + dy * dy < r2) { ok = false; break; }
                    }
                }
                if (ok) { add(x, y); found = true; break; }
            }
            if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
        }
        return pts;
    }

    /* ---------- Delaunay (Bowyer–Watson) -> unique edges ---------- */
    function delaunayEdges(pts) {
        var n = pts.length;
        if (n < 3) return [];
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, i;
        for (i = 0; i < n; i++) {
            var p = pts[i];
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
        var dmax = Math.max(maxX - minX, maxY - minY) || 1;
        var midx = (minX + maxX) / 2, midy = (minY + maxY) / 2;
        var px = new Float64Array(n + 3), py = new Float64Array(n + 3);
        for (i = 0; i < n; i++) { px[i] = pts[i].x; py[i] = pts[i].y; }
        px[n] = midx - 20 * dmax; py[n] = midy - dmax;
        px[n + 1] = midx;         py[n + 1] = midy + 20 * dmax;
        px[n + 2] = midx + 20 * dmax; py[n + 2] = midy - dmax;

        function tri(a, b, c) {
            var ax = px[a], ay = py[a], bx = px[b], by = py[b], cx = px[c], cy = py[c];
            var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
            if (Math.abs(d) < 1e-9) return { a: a, b: b, c: c, x: 0, y: 0, r2: -1, rr: 0 };
            var a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
            var ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
            var uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
            var r2 = (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy);
            return { a: a, b: b, c: c, x: ux, y: uy, r2: r2, rr: Math.sqrt(r2) };
        }

        var order = new Array(n);
        for (i = 0; i < n; i++) order[i] = i;
        order.sort(function (a, b) { return px[a] - px[b]; });

        var tris = [tri(n, n + 1, n + 2)];
        var done = [];
        var edgeUse = new Map();
        for (var oi = 0; oi < n; oi++) {
            i = order[oi];
            var x = px[i], y = py[i];
            var keep = [], bad = [];
            for (var t = 0; t < tris.length; t++) {
                var T = tris[t];
                // Points arrive in x order, so a triangle whose circumcircle
                // lies entirely to the left of x is final.
                if (T.r2 >= 0 && T.x + T.rr < x) { done.push(T); continue; }
                var ddx = T.x - x, ddy = T.y - y;
                if (ddx * ddx + ddy * ddy < T.r2) bad.push(T); else keep.push(T);
            }
            edgeUse.clear();
            for (t = 0; t < bad.length; t++) {
                var B = bad[t];
                countEdge(edgeUse, B.a, B.b); countEdge(edgeUse, B.b, B.c); countEdge(edgeUse, B.c, B.a);
            }
            edgeUse.forEach(function (v) {
                if (v.n === 1) keep.push(tri(v.a, v.b, i));
            });
            tris = keep;
        }
        tris = done.concat(tris);

        var seen = new Set(), out = [];
        for (i = 0; i < tris.length; i++) {
            var R = tris[i];
            if (R.a >= n || R.b >= n || R.c >= n) continue;
            pushEdge(seen, out, R.a, R.b); pushEdge(seen, out, R.b, R.c); pushEdge(seen, out, R.c, R.a);
        }
        return out;
    }
    function countEdge(map, a, b) {
        var lo = a < b ? a : b, hi = a < b ? b : a, key = lo * 1048576 + hi;
        var v = map.get(key);
        if (v) v.n++; else map.set(key, { a: a, b: b, n: 1 });
    }
    function pushEdge(seen, out, a, b) {
        var lo = a < b ? a : b, hi = a < b ? b : a, key = lo * 1048576 + hi;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ a: lo, b: hi });
    }

    /* ---------- Build the lattice ---------- */
    function generate(withGrow) {
        var target = targetFor(+slider.value);
        var r = spacingForTarget(target);
        // Same seed for both passes, so the slider morphs one lattice rather
        // than rolling a new one at every step; the button rolls a new seed.
        rng = mulberry32(seed);
        buildLattice(r);
        // Correct toward the target count (each pass is only a few ms).
        for (var pass = 0; pass < 3; pass++) {
            var err = strutCount() / target;
            if (err > 0.97 && err < 1.03) break;
            r *= Math.sqrt(err);
            rng = mulberry32(seed);
            buildLattice(r);
        }
        finishGenerate(withGrow);
    }

    // Struts that cross the wrap boundary exist on both sides; count them once.
    function strutCount() {
        var c = 0;
        for (var i = 0; i < edges.length; i++) if (!edges[i].dup) c++;
        return c;
    }

    function buildLattice(r) {
        spacing = r;
        var maxLen = spacing * 2.4;
        var m = spacing * 2.7;                     // periodic copies reach past the longest strut
        var pts = poisson(W, H, spacing);
        nodes = [];
        var i;
        for (i = 0; i < pts.length; i += 2) nodes.push({ x: pts[i], y: pts[i + 1], core: true });
        var n0 = nodes.length;
        for (i = 0; i < n0; i++) {
            for (var sx = -1; sx <= 1; sx++) {
                for (var sy = -1; sy <= 1; sy++) {
                    if (!sx && !sy) continue;
                    var x = nodes[i].x + sx * W, y = nodes[i].y + sy * H;
                    if (x >= -m && x <= W + m && y >= -m && y <= H + m) nodes.push({ x: x, y: y, core: false });
                }
            }
        }

        var raw = delaunayEdges(nodes);
        edges = [];
        for (i = 0; i < raw.length; i++) {
            var e = raw[i], a = nodes[e.a], b = nodes[e.b];
            if (!a.core && !b.core) continue;
            var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
            if (len > maxLen) continue;
            // Self-supporting only: no strut flatter than 30° to the horizontal.
            if (Math.abs(dy) < MIN_SIN * len) continue;
            e.len = len; e.mx = (a.x + b.x) / 2; e.my = (a.y + b.y) / 2;
            var nx = -dy / len, ny = dx / len;
            if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny; }
            e.nx = nx; e.ny = ny;
            edges.push(e);
        }

        // Drop nodes that lost every strut, and renumber.
        var used = new Uint8Array(nodes.length);
        for (i = 0; i < edges.length; i++) { used[edges[i].a] = 1; used[edges[i].b] = 1; }
        var remap = new Int32Array(nodes.length), kept = [];
        for (i = 0; i < nodes.length; i++) if (used[i]) { remap[i] = kept.length; kept.push(nodes[i]); }
        nodes = kept;
        adj = new Array(nodes.length);
        for (i = 0; i < nodes.length; i++) adj[i] = [];
        for (i = 0; i < edges.length; i++) {
            var E = edges[i];
            E.a = remap[E.a]; E.b = remap[E.b];
            adj[E.a].push(i); adj[E.b].push(i);
            // A strut crossing the wrap boundary exists twice (once from each
            // side). The single-tile renders need both halves; renders that
            // lay whole tiles side by side must draw only one, so mark the
            // copy whose off-tile node sits to the top/left as the duplicate.
            var na = nodes[E.a], nb = nodes[E.b], off = !na.core ? na : (!nb.core ? nb : null);
            E.dup = false;
            if (off) {
                var sx = off.x >= W ? 1 : off.x < 0 ? -1 : 0, sy = off.y >= H ? 1 : off.y < 0 ? -1 : 0;
                E.dup = !(sy > 0 || (sy === 0 && sx > 0));
            }
        }
        buildGrid();
    }

    function finishGenerate(withGrow) {
        var i;
        buildDepths();
        edgeStamp = new Uint32Array(edges.length);
        nodeStamp = new Uint32Array(nodes.length);

        strutW = clamp(spacing * 0.23, 3, 13);
        renderWire();
        scheduleMetal();

        var label = strutCount().toLocaleString() + ' struts';
        if (densityValue) densityValue.textContent = label;
        slider.setAttribute('aria-valuetext', label);

        if (withGrow && !reduced()) {
            growing = true;
            growStart = performance.now();
            growDur = clamp(900 + maxDepth * 28, 1100, 2000);
        } else {
            growing = false;
        }
        kick();
    }

    function buildGrid() {
        gcols = Math.ceil(W / CELL) + 2;
        grows = Math.ceil(H / CELL) + 2;
        grid = new Array(gcols * grows);
        for (var i = 0; i < nodes.length; i++) {
            var c = cellIndex(nodes[i].x, nodes[i].y);
            if (c < 0) continue;
            (grid[c] || (grid[c] = [])).push(i);
        }
    }
    function cellIndex(x, y) {
        var cx = Math.floor(x / CELL) + 1, cy = Math.floor(y / CELL) + 1;
        if (cx < 0 || cy < 0 || cx >= gcols || cy >= grows) return -1;
        return cy * gcols + cx;
    }

    // BFS depth from a seed near the centre; the grow-in animation follows it.
    function buildDepths() {
        var sx = W * (0.35 + rng() * 0.3), sy = H * (0.35 + rng() * 0.3);
        var best = 0, bd = Infinity, i;
        for (i = 0; i < nodes.length; i++) {
            var dx = nodes[i].x - sx, dy = nodes[i].y - sy, d = dx * dx + dy * dy;
            if (d < bd) { bd = d; best = i; }
        }
        var depth = new Int32Array(nodes.length); depth.fill(-1);
        var queue = [best]; depth[best] = 0; maxDepth = 0;
        var q = 0, scan = 0;
        for (;;) {
            for (; q < queue.length; q++) {
                var n = queue[q], dn = depth[n];
                var list = adj[n];
                for (i = 0; i < list.length; i++) {
                    var e = edges[list[i]];
                    var other = e.a === n ? e.b : e.a;
                    if (depth[other] < 0) {
                        depth[other] = dn + 1;
                        if (dn + 1 > maxDepth) maxDepth = dn + 1;
                        queue.push(other);
                    }
                }
            }
            // Any component the seed can't reach starts growing after the main one.
            while (scan < nodes.length && depth[scan] >= 0) scan++;
            if (scan >= nodes.length) break;
            depth[scan] = ++maxDepth;
            queue.push(scan);
        }
        for (i = 0; i < edges.length; i++) {
            var E = edges[i], da = depth[E.a], db = depth[E.b];
            if (da < 0) da = maxDepth; if (db < 0) db = maxDepth;
            // Draw from the shallower node outward.
            if (db < da) { var t = E.a; E.a = E.b; E.b = t; var s = da; da = db; db = s; }
            E.d0 = da; E.d1 = db;
        }
        nodes.forEach(function (nd, idx) { nd.d = depth[idx] < 0 ? maxDepth : depth[idx]; });
    }

    /* ---------- Wire layer (static, redrawn only on generate/resize) ---------- */
    function renderWire() {
        wctx.clearRect(0, 0, W, H);
        wctx.lineWidth = 1;
        wctx.lineCap = 'round';
        wctx.strokeStyle = 'rgba(' + ACCENT + ', 0.42)';
        wctx.beginPath();
        for (var i = 0; i < edges.length; i++) {
            var e = edges[i], a = nodes[e.a], b = nodes[e.b];
            wctx.moveTo(a.x, a.y); wctx.lineTo(b.x, b.y);
        }
        wctx.stroke();
        wctx.fillStyle = 'rgba(' + ACCENT + ', 0.85)';
        wctx.beginPath();
        for (i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            wctx.moveTo(n.x + 1.6, n.y); wctx.arc(n.x, n.y, 1.6, 0, TAU);
        }
        wctx.fill();
    }

    /* ---------- Metal layer (rendered once, in idle slices) ---------- */
    function scheduleMetal() {
        metalReady = false;
        var gen = ++metalGen;
        metal.width = Math.round(W * METAL_DPR);
        metal.height = Math.round(H * METAL_DPR);
        mctx.setTransform(METAL_DPR, 0, 0, METAL_DPR, 0, 0);
        mctx.globalCompositeOperation = 'source-over';
        mctx.clearRect(0, 0, W, H);
        mctx.lineCap = 'round';

        var pass = 0, i = 0;
        function work() {
            if (pass === 0) { if (i < edges.length) { drawShadow(edges[i++]); return true; } pass = 1; i = 0; }
            if (pass === 1) { if (i < edges.length) { drawStrut(edges[i++]); return true; } pass = 2; i = 0; mctx.globalCompositeOperation = 'source-atop'; }
            if (pass === 2) { if (i < nodes.length) { drawJointAO(nodes[i++]); return true; } pass = 3; }
            return false;
        }
        function step() {
            if (gen !== metalGen) return;
            var t0 = performance.now();
            while (performance.now() - t0 < 7) {
                if (!work()) {
                    finishMetal();
                    metalReady = true;
                    scheduleDome();
                    if (frontY < H) kick();
                    return;
                }
            }
            setTimeout(step, 16);
        }
        setTimeout(step, 40);
    }

    function drawShadow(e) {
        var a = nodes[e.a], b = nodes[e.b], ox = strutW * 0.22, oy = strutW * 0.38;
        mctx.lineWidth = strutW + 1.4;
        mctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
        mctx.beginPath(); mctx.moveTo(a.x + ox, a.y + oy); mctx.lineTo(b.x + ox, b.y + oy); mctx.stroke();
    }
    // A matte cylinder: soft diffuse falloff from the lit side to the far
    // edge, no specular. The powder-bed grain is laid over the whole layer
    // afterwards in finishMetal.
    function drawStrut(e) {
        var a = nodes[e.a], b = nodes[e.b], nx = e.nx, ny = e.ny, hw = strutW / 2;
        var grad = mctx.createLinearGradient(e.mx + nx * hw, e.my + ny * hw, e.mx - nx * hw, e.my - ny * hw);
        grad.addColorStop(0,    '#4a4f56');
        grad.addColorStop(0.30, '#7d8289');
        grad.addColorStop(0.62, '#555a61');
        grad.addColorStop(1,    '#2b2f34');
        mctx.lineWidth = strutW;
        mctx.strokeStyle = grad;
        mctx.beginPath(); mctx.moveTo(a.x, a.y); mctx.lineTo(b.x, b.y); mctx.stroke();
    }
    // Darken where struts meet, so joints read as fused rather than overlapped.
    function drawJointAO(n) {
        var r = strutW * 1.5;
        var g = mctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
        g.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        mctx.fillStyle = g;
        mctx.fillRect(n.x - r, n.y - r, r * 2, r * 2);
    }
    // Powder-bed grain and faint layer steps, clipped to the struts.
    function finishMetal() {
        mctx.globalCompositeOperation = 'source-atop';
        mctx.fillStyle = grainMetal;
        mctx.fillRect(0, 0, W, H);
        mctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        for (var y = 0; y < H; y += 2.6) mctx.fillRect(0, y, W, 0.7);
        mctx.globalCompositeOperation = 'source-over';
    }

    /* ---------- Frame ---------- */
    function kick() {
        if (rafId === null) rafId = window.requestAnimationFrame(frame);
    }

    function frame(now) {
        rafId = null;
        if (!W || !H || !wire.width) return;   // viewport not laid out yet
        var active = false;

        var growT = 1;
        if (growing) {
            growT = clamp((now - growStart) / growDur, 0, 1);
            if (growT >= 1) growing = false; else active = true;
        }

        var wantField = (mouse.over && !frozen) ? 1 : 0;
        if (Math.abs(wantField - fieldA) > 0.004) { fieldA += (wantField - fieldA) * 0.12; active = true; }
        else fieldA = wantField;

        if (mouse.over) {
            var ddx = mouse.tx - mouse.x, ddy = mouse.ty - mouse.y;
            if (ddx * ddx + ddy * ddy > 0.09) { mouse.x += ddx * 0.22; mouse.y += ddy * 0.22; active = true; }
            else { mouse.x = mouse.tx; mouse.y = mouse.ty; }
        }

        ctx.clearRect(0, 0, W, H);
        if (zoomP > 0) {
            drawZoom(zoomP);
        } else {
            if (growing) drawGrow(growT); else ctx.drawImage(wire, 0, 0, W, H);
            if (fieldA > 0.004 && !growing) drawField();
            if (frontY < H) drawPrint();
        }

        if (active && !document.hidden) kick();
    }

    // Grow-in: struts draw outward from the seed in BFS order.
    function drawGrow(t) {
        var eased = 1 - Math.pow(1 - t, 3);
        var front = eased * (maxDepth + 1.2);
        var i, e, a, b;
        ctx.lineCap = 'round';
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(' + ACCENT + ', 0.36)';
        ctx.beginPath();
        var tips = [];
        for (i = 0; i < edges.length; i++) {
            e = edges[i];
            if (front >= e.d0 + 1) { a = nodes[e.a]; b = nodes[e.b]; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
            else if (front > e.d0) tips.push(i);
        }
        ctx.stroke();

        ctx.lineWidth = 1.6;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        for (i = 0; i < tips.length; i++) {
            e = edges[tips[i]]; a = nodes[e.a]; b = nodes[e.b];
            var f = front - e.d0; f = f * f * (3 - 2 * f);
            ctx.moveTo(a.x, a.y); ctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
        }
        ctx.stroke();

        ctx.fillStyle = 'rgba(' + ACCENT + ', 0.85)';
        ctx.beginPath();
        for (i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.d > front) continue;
            ctx.moveTo(n.x + 1.6, n.y); ctx.arc(n.x, n.y, 1.6, 0, TAU);
        }
        ctx.fill();
    }

    // Cursor field: struts near the pointer thicken and brighten. Only edges
    // in nearby grid cells are touched, so cost is independent of lattice size.
    var buckets = [[], [], [], [], [], [], [], []];
    function drawField() {
        var mx = mouse.x, my = mouse.y, R = FIELD_R;
        var reach = R + spacing * 2.4;

        var glow = ctx.createRadialGradient(mx, my, 0, mx, my, R * 1.7);
        glow.addColorStop(0, 'rgba(' + ACCENT + ', ' + (0.13 * fieldA) + ')');
        glow.addColorStop(0.35, 'rgba(' + ACCENT + ', ' + (0.07 * fieldA) + ')');
        glow.addColorStop(0.7, 'rgba(' + ACCENT + ', ' + (0.025 * fieldA) + ')');
        glow.addColorStop(1, 'rgba(' + ACCENT + ', 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(mx - R * 1.7, my - R * 1.7, R * 3.4, R * 3.4);

        for (var k = 0; k < 8; k++) buckets[k].length = 0;
        stampNo++;
        var nearNodes = [];
        var cx0 = Math.floor((mx - reach) / CELL) + 1, cx1 = Math.floor((mx + reach) / CELL) + 1;
        var cy0 = Math.floor((my - reach) / CELL) + 1, cy1 = Math.floor((my + reach) / CELL) + 1;
        for (var cy = Math.max(0, cy0); cy <= Math.min(grows - 1, cy1); cy++) {
            for (var cx = Math.max(0, cx0); cx <= Math.min(gcols - 1, cx1); cx++) {
                var cell = grid[cy * gcols + cx];
                if (!cell) continue;
                for (var i = 0; i < cell.length; i++) {
                    var ni = cell[i], n = nodes[ni];
                    var ndx = n.x - mx, ndy = n.y - my, nd = Math.sqrt(ndx * ndx + ndy * ndy);
                    if (nd < R) nearNodes.push(ni, 1 - nd / R);
                    var list = adj[ni];
                    for (var j = 0; j < list.length; j++) {
                        var ei = list[j];
                        if (edgeStamp[ei] === stampNo) continue;
                        edgeStamp[ei] = stampNo;
                        var e = edges[ei], a = nodes[e.a], b = nodes[e.b];
                        var d = Math.sqrt(segDist2(mx, my, a.x, a.y, b.x, b.y));
                        if (d >= R) continue;
                        var f = 1 - d / R; f = f * f * (3 - 2 * f);
                        buckets[Math.min(7, (f * 8) | 0)].push(ei);
                    }
                }
            }
        }

        ctx.lineCap = 'round';
        for (k = 0; k < 8; k++) {
            var bk = buckets[k];
            if (!bk.length) continue;
            var fb = (k + 0.5) / 8, mix = fb * 0.8;
            var r = Math.round(143 + (255 - 143) * mix), g = Math.round(216 + (255 - 216) * mix);
            ctx.lineWidth = 1 + 3.4 * fb * fieldA;
            ctx.strokeStyle = 'rgba(' + r + ', ' + g + ', 255, ' + ((0.45 + 0.55 * fb) * fieldA) + ')';
            ctx.beginPath();
            for (i = 0; i < bk.length; i++) {
                var E = edges[bk[i]], A = nodes[E.a], B = nodes[E.b];
                ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
            }
            ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.95 * fieldA) + ')';
        ctx.beginPath();
        for (i = 0; i < nearNodes.length; i += 2) {
            var N = nodes[nearNodes[i]], ff = nearNodes[i + 1]; ff = ff * ff * (3 - 2 * ff);
            var rr = 1.6 + 2.4 * ff * fieldA;
            ctx.moveTo(N.x + rr, N.y); ctx.arc(N.x, N.y, rr, 0, TAU);
        }
        ctx.fill();
    }
    function segDist2(px, py, ax, ay, bx, by) {
        var dx = bx - ax, dy = by - ay;
        var t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        var x = ax + dx * t - px, y = ay + dy * t - py;
        return x * x + y * y;
    }

    // Print. Below the melt line, struts fatten from wire to full thickness
    // across a band, and below the band the pre-rendered metal takes over.
    var BAND_FRAC = 0.42;
    var bandBuckets = [];
    for (var bi = 0; bi < 12; bi++) bandBuckets.push([]);

    function drawPrint() {
        var band = H * BAND_FRAC;
        var fy = frontY;
        var metalTop = fy + band * 0.8;

        if (fy > -band) drawBand(fy, band);

        if (metalReady) {
            var sy = Math.max(0, Math.floor(metalTop * METAL_DPR));
            var sh = metal.height - sy;
            if (sh > 0) ctx.drawImage(metal, 0, sy, metal.width, sh, 0, sy / METAL_DPR, W, sh / METAL_DPR);
        } else if (metalTop < H) {
            // Metal not rendered yet (fast scroll straight after load): stand in with plain thick struts.
            ctx.save();
            ctx.beginPath(); ctx.rect(0, Math.max(0, metalTop), W, H); ctx.clip();
            ctx.lineCap = 'round'; ctx.lineWidth = strutW;
            ctx.strokeStyle = '#8d939b';
            ctx.beginPath();
            for (var i = 0; i < edges.length; i++) {
                var e = edges[i], a = nodes[e.a], b = nodes[e.b];
                ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            }
            ctx.stroke();
            ctx.restore();
        }

        if (fy <= -band || fy >= H) return;

        // Cooling tint on the freshly fused struts (drawn pixels only).
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        var heat = ctx.createLinearGradient(0, fy, 0, fy + band * 0.7);
        heat.addColorStop(0, 'rgba(255, 150, 70, 0.7)');
        heat.addColorStop(0.35, 'rgba(255, 120, 60, 0.28)');
        heat.addColorStop(1, 'rgba(255, 100, 60, 0)');
        ctx.fillStyle = heat;
        ctx.fillRect(0, Math.max(0, fy), W, band * 0.7);
        ctx.restore();

        // The melt line.
        if (fy > -3) {
            ctx.globalCompositeOperation = 'lighter';
            var glow = ctx.createLinearGradient(0, fy - 22, 0, fy + 22);
            glow.addColorStop(0, 'rgba(255, 190, 120, 0)');
            glow.addColorStop(0.5, 'rgba(255, 220, 180, 0.42)');
            glow.addColorStop(1, 'rgba(255, 190, 120, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, fy - 22, W, 44);
            ctx.fillStyle = 'rgba(255, 248, 236, 0.95)';
            ctx.fillRect(0, fy - 0.75, W, 1.5);
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    // Struts in the band, bucketed by thickness and shaded with four offset
    // strokes (base, mid, light, ridge) so they read as cylinders without a
    // per-strut gradient every frame.
    function drawBand(fy, band) {
        var K = bandBuckets.length, k, i;
        for (k = 0; k < K; k++) bandBuckets[k].length = 0;
        var reach = spacing * 1.3, bottom = fy + band;
        for (i = 0; i < edges.length; i++) {
            var my = edges[i].my;
            if (my < fy - reach || my > bottom + reach) continue;
            var t = clamp((my - fy) / band, 0, 1); t = t * t * (3 - 2 * t);
            bandBuckets[Math.min(K - 1, (t * K) | 0)].push(i);
        }
        ctx.save();
        ctx.beginPath(); ctx.rect(0, Math.max(0, fy), W, H); ctx.clip();
        ctx.lineCap = 'round';
        for (k = 0; k < K; k++) {
            var bk = bandBuckets[k];
            if (!bk.length) continue;
            var t2 = (k + 0.5) / K, w = 1.2 + (strutW - 1.2) * t2;
            strokeOffset(bk, w + 1.4, 'rgba(0, 0, 0, ' + (0.55 * t2) + ')', w * 0.22, w * 0.38, 0);
            strokeOffset(bk, w, '#2f3338', 0, 0, 0);
            strokeOffset(bk, w * 0.72, '#5a5f66', 0, 0, w * 0.07);
            strokeOffset(bk, w * 0.42, '#7d8289', 0, 0, w * 0.17);
        }
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = grainMain;
        ctx.fillRect(0, Math.max(0, fy), W, band);
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
    function strokeOffset(list, width, style, ox, oy, nOff) {
        ctx.lineWidth = width; ctx.strokeStyle = style;
        ctx.beginPath();
        for (var i = 0; i < list.length; i++) {
            var e = edges[list[i]], a = nodes[e.a], b = nodes[e.b];
            var dx = ox + e.nx * nOff, dy = oy + e.ny * nOff;
            ctx.moveTo(a.x + dx, a.y + dy); ctx.lineTo(b.x + dx, b.y + dy);
        }
        ctx.stroke();
    }

    /* ---------- Lattice to part: zoom out into an acetabular cup ----------
       The lattice wraps onto a hemisphere by arc length (azimuthal equidistant
       about the point facing the camera), so at the start of the zoom the
       screen is simply a close-up of the dome. While the dome is larger than
       the screen it is drawn per frame as projected struts (few are visible);
       once it fits, a pre-rendered image of the whole cup takes over. */
    var CUP_Z = 9;                                  // how far the camera pulls back
    var CUP_TILT = 34 * Math.PI / 180;              // camera elevation above the rim plane
    var CUP_HOLES = [                               // [polar angle from apex, azimuth, angular radius]
        [0.0, 0.0, 0.135],
        [0.62, 0.05, 0.105], [0.57, 0.78, 0.100], [0.66, 1.50, 0.105],
        [0.60, 2.25, 0.100], [0.63, 3.05, 0.105]
    ];
    var cup = null;                                 // {r, R, sinT, cosT, holes:[{c, rho}]}
    var domeImg = document.createElement('canvas');
    var domeCtx = domeImg.getContext('2d');
    var domeReady = false, domeGen = 0, DOME_DPR = Math.min(DPR * 2, 3);
    var grainDome = domeCtx.createPattern(grainTile, 'repeat');
    var P0 = { x: 0, y: 0, z: 1 }, P1 = { x: 0, y: 0, z: 1 };

    function layoutCup() {
        var r = Math.min(H * 0.34, W * 0.40);
        var sinT = Math.sin(CUP_TILT), cosT = Math.cos(CUP_TILT);
        // cup axis and rim-plane basis in view space (x right, y down, z toward camera)
        var ax = { x: 0, y: -cosT, z: sinT }, e1 = { x: 1, y: 0, z: 0 }, e2 = { x: 0, y: sinT, z: cosT };
        var holes = [];
        for (var i = 0; i < CUP_HOLES.length; i++) {
            var psi = CUP_HOLES[i][0], om = CUP_HOLES[i][1];
            var sp = Math.sin(psi), cp = Math.cos(psi), co = Math.cos(om), so = Math.sin(om);
            holes.push({
                c: { x: cp * ax.x + sp * (co * e1.x + so * e2.x),
                     y: cp * ax.y + sp * (co * e1.y + so * e2.y),
                     z: cp * ax.z + sp * (co * e1.z + so * e2.z) },
                rho: CUP_HOLES[i][2], cosRho: Math.cos(CUP_HOLES[i][2] + 0.012), threaded: i === 0
            });
        }
        cup = { r: r, R: CUP_Z * r, sinT: sinT, cosT: cosT, ax: ax, e1: e1, e2: e2, holes: holes };
        return cup;
    }

    // lattice px (relative to the view centre) -> unit sphere point in view space
    function toSphere(X, Y, R, out) {
        var d = Math.sqrt(X * X + Y * Y);
        if (d < 1e-6) { out.x = 0; out.y = 0; out.z = 1; return true; }
        var al = d / R;
        if (al >= 1.5707) { out.z = -1; return false; }
        var sa = Math.sin(al);
        out.x = sa * X / d; out.y = sa * Y / d; out.z = Math.cos(al);
        return out.z > 0.015 && (-out.y * cup.cosT + out.z * cup.sinT) >= 0;   // facing camera and on the dome
    }
    function inHole(P) {
        var hs = cup.holes;
        for (var i = 0; i < hs.length; i++) {
            var h = hs[i];
            if (P.x * h.c.x + P.y * h.c.y + P.z * h.c.z > h.cosRho) return true;
        }
        return false;
    }

    // Path of the visible dome: upper half of the sphere disc plus the front
    // half of the rim ellipse.
    function domePath(g, cx, cy, rs) {
        g.beginPath();
        g.arc(cx, cy, rs, Math.PI, TAU);
        g.ellipse(cx, cy, rs, rs * cup.sinT, 0, 0, Math.PI);
        g.closePath();
    }

    // Struts of the tiles that fall inside a disc of arc radius dMax (lattice
    // px) around the view centre, projected onto the sphere.
    function strutTiles(g, cx, cy, rs, dMax, ti0, ti1, tj0, tj1) {
        var R = cup.R, reach = dMax + spacing * 2.5;
        for (var i = ti0; i <= ti1; i++) {
            for (var j = tj0; j <= tj1; j++) {
                var ox = i * W - W / 2, oy = j * H - H / 2;
                for (var k = 0; k < edges.length; k++) {
                    var e = edges[k];
                    if (e.dup) continue;
                    var X = e.mx + ox, Y = e.my + oy;
                    if (X * X + Y * Y > reach * reach) continue;
                    var a = nodes[e.a], b = nodes[e.b];
                    if (!toSphere(a.x + ox, a.y + oy, R, P0)) continue;
                    if (!toSphere(b.x + ox, b.y + oy, R, P1)) continue;
                    if (inHole(P0) || inHole(P1)) continue;
                    g.moveTo(cx + rs * P0.x, cy + rs * P0.y);
                    g.lineTo(cx + rs * P1.x, cy + rs * P1.y);
                }
            }
        }
    }

    function tileRange(dMax) {
        var n = Math.ceil((dMax + spacing * 2.5 + W / 2) / W), m = Math.ceil((dMax + spacing * 2.5 + H / 2) / H);
        return { i0: -n, i1: n, j0: -m, j1: m };
    }

    function shadeDome(g, cx, cy, rs, alpha) {
        g.save();
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = alpha;
        var sh = g.createRadialGradient(cx - rs * 0.32, cy - rs * 0.40, rs * 0.08, cx, cy, rs * 1.25);
        sh.addColorStop(0, 'rgba(255, 255, 255, 0.20)');
        sh.addColorStop(0.42, 'rgba(0, 0, 0, 0)');
        sh.addColorStop(1, 'rgba(0, 0, 0, 0.80)');
        g.fillStyle = sh;
        g.fillRect(cx - rs * 1.3, cy - rs * 1.3, rs * 2.6, rs * 2.6);
        g.restore();
    }

    function drawHoles(g, cx, cy, rs, alpha) {
        g.save();
        g.globalAlpha = alpha;
        var hs = cup.holes;
        for (var i = 0; i < hs.length; i++) {
            var h = hs[i], c = h.c;
            if (c.z < 0.3) continue;   // edge-on holes read as slivers; the photo shows none
            // basis perpendicular to c
            var ux = -c.y, uy = c.x, uz = 0, ul = Math.sqrt(ux * ux + uy * uy) || 1; ux /= ul; uy /= ul;
            var vx = c.y * uz - c.z * uy, vy = c.z * ux - c.x * uz, vz = c.x * uy - c.y * ux;
            var cr = Math.cos(h.rho), sr = Math.sin(h.rho);
            function ring(scale, dx, dy) {
                g.beginPath();
                for (var t = 0; t < 40; t++) {
                    var an = t / 40 * TAU, ca = Math.cos(an) * sr * scale, sa = Math.sin(an) * sr * scale;
                    var px = cr * c.x + ca * ux + sa * vx, py = cr * c.y + ca * uy + sa * vy;
                    var sx = cx + rs * px + dx, sy = cy + rs * py + dy;
                    if (t === 0) g.moveTo(sx, sy); else g.lineTo(sx, sy);
                }
                g.closePath();
            }
            // bore wall, then the opening shifted toward the sphere centre for depth
            ring(1, 0, 0);
            g.fillStyle = '#40444a'; g.fill();
            g.lineWidth = Math.max(0.8, rs * 0.006); g.strokeStyle = 'rgba(225, 228, 232, 0.85)'; g.stroke();
            var depth = rs * h.rho * 0.42;
            ring(0.86, -c.x * depth, -c.y * depth);
            g.fillStyle = '#0b0d10'; g.fill();
            if (h.threaded) {
                g.lineWidth = Math.max(0.6, rs * 0.004); g.strokeStyle = 'rgba(190, 194, 200, 0.7)';
                ring(0.93, -c.x * depth * 0.18, -c.y * depth * 0.18); g.stroke();
                ring(0.80, -c.x * depth * 0.36, -c.y * depth * 0.36); g.stroke();
            }
        }
        g.restore();
    }

    function drawRim(g, cx, cy, rs, alpha) {
        g.save();
        g.globalAlpha = alpha;
        g.beginPath();
        g.ellipse(cx, cy, rs, rs * cup.sinT, 0, 0, Math.PI);
        g.lineWidth = Math.max(1, rs * 0.014);
        g.strokeStyle = 'rgba(214, 218, 223, 0.9)';
        g.stroke();
        g.lineWidth = Math.max(0.6, rs * 0.005);
        g.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        g.beginPath();
        g.ellipse(cx, cy, rs * 0.995, rs * cup.sinT * 0.985, 0, 0.05, Math.PI - 0.05);
        g.stroke();
        g.restore();
    }

    // Per-frame dome render for the early zoom, when only part of the dome is on screen.
    function drawDomeVector(cx, cy, rs, s, alpha) {
        var corner = Math.sqrt(W * W + H * H) / 2 / rs;
        var dMax = corner >= 1 ? cup.R * 1.5707 : cup.R * Math.asin(corner);
        var tr = tileRange(dMax);
        ctx.save();
        ctx.globalAlpha = alpha;
        domePath(ctx, cx, cy, rs);
        ctx.fillStyle = 'rgba(16, 18, 22, 0.92)';
        ctx.fill();
        ctx.lineCap = 'round';
        ctx.beginPath();
        strutTiles(ctx, cx, cy, rs, dMax, tr.i0, tr.i1, tr.j0, tr.j1);
        var w = Math.max(0.7, strutW * s * 0.9);
        if (s > 0.4) {
            ctx.lineWidth = w; ctx.strokeStyle = '#4a4e54'; ctx.stroke();
            ctx.lineWidth = w * 0.5; ctx.strokeStyle = '#8d9197'; ctx.stroke();
        } else {
            ctx.lineWidth = w; ctx.strokeStyle = '#7b7f85'; ctx.stroke();
        }
        ctx.restore();
        shadeDome(ctx, cx, cy, rs, alpha);
        drawHoles(ctx, cx, cy, rs, alpha);
        if (rs < Math.sqrt(W * W + H * H)) drawRim(ctx, cx, cy, rs, alpha);
    }

    // Whole cup pre-rendered at 2x device resolution, in idle slices.
    function scheduleDome() {
        domeReady = false;
        var gen = ++domeGen;
        if (!cup) layoutCup();
        var rs = cup.r * DOME_DPR, size = Math.ceil(rs * 2.04);
        var cx = size / 2, cy = size / 2;
        domeImg.width = size; domeImg.height = size;
        domeCtx.setTransform(1, 0, 0, 1, 0, 0);
        domeCtx.clearRect(0, 0, size, size);
        domePath(domeCtx, cx, cy, rs);
        domeCtx.fillStyle = 'rgba(16, 18, 22, 0.92)';
        domeCtx.fill();
        domeCtx.lineCap = 'round';
        var dMax = cup.R * 1.5707, tr = tileRange(dMax);
        var wdt = Math.max(0.8, strutW / CUP_Z * DOME_DPR * 0.9);
        var i = tr.i0, j = tr.j0;
        function step() {
            if (gen !== domeGen) return;
            var t0 = performance.now();
            while (performance.now() - t0 < 7) {
                if (i > tr.i1) {
                    shadeDome(domeCtx, cx, cy, rs, 1);
                    domeCtx.save();
                    domeCtx.globalCompositeOperation = 'source-atop';
                    domeCtx.globalAlpha = 0.5;
                    domeCtx.fillStyle = grainDome;
                    domeCtx.fillRect(0, 0, size, size);
                    domeCtx.restore();
                    drawHoles(domeCtx, cx, cy, rs, 1);
                    drawRim(domeCtx, cx, cy, rs, 1);
                    domeReady = true;
                    kick();
                    return;
                }
                domeCtx.beginPath();
                strutTiles(domeCtx, cx, cy, rs, dMax, i, i, j, j);
                domeCtx.lineWidth = wdt; domeCtx.strokeStyle = '#4a4e54'; domeCtx.stroke();
                domeCtx.lineWidth = wdt * 0.5; domeCtx.strokeStyle = '#8d9197'; domeCtx.stroke();
                j++;
                if (j > tr.j1) { j = tr.j0; i++; }
            }
            setTimeout(step, 16);
        }
        setTimeout(step, 60);
    }

    function drawZoom(p) {
        if (!cup) layoutCup();
        var e = p * p * (3 - 2 * p);
        var s = Math.pow(CUP_Z, -e);                     // lattice scale: 1 -> 1/Z
        var rs = s * cup.R;                              // dome radius on screen
        var cyEnd = H * 0.46 + cup.r * (1 - cup.sinT) / 2;
        var cx = W / 2, cy = H / 2 + (cyEnd - H / 2) * e;

        var w = clamp(e / 0.10, 0, 1);                   // flat -> sphere
        var sSwitch = Math.min(0.6, 1.6 * DOME_DPR / CUP_Z);
        var w2 = domeReady ? clamp((sSwitch - s) / 0.06, 0, 1) : 0;   // projected struts -> image

        if (w < 1) {
            ctx.save();
            ctx.globalAlpha = 1 - w;
            ctx.setTransform(s * DPR, 0, 0, s * DPR, (cx - s * W / 2) * DPR, (cy - s * H / 2) * DPR);
            var src = metalReady ? metal : wire;
            var n = Math.ceil((1 / s - 1) / 2);
            for (var i = -n; i <= n; i++) for (var j = -n; j <= n; j++)
                ctx.drawImage(src, 0, 0, src.width, src.height, i * W, j * H, W, H);
            ctx.restore();
        }
        if (w > 0 && w2 < 1) drawDomeVector(cx, cy, rs, s, w * (1 - w2));
        if (w2 > 0) {
            ctx.save();
            ctx.globalAlpha = w2;
            var k = rs / (cup.r * DOME_DPR);
            ctx.drawImage(domeImg, cx - domeImg.width / 2 * k, cy - domeImg.height / 2 * k, domeImg.width * k, domeImg.height * k);
            ctx.restore();
        }
        if (w > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.globalAlpha = 0.45 * w * (1 - w2);
            ctx.fillStyle = grainMain;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }
    }

    /* ---------- Input ---------- */
    window.addEventListener('pointermove', function (e) {
        mouse.tx = e.clientX; mouse.ty = e.clientY;
        if (!mouse.over) { mouse.over = true; mouse.x = mouse.tx; mouse.y = mouse.ty; }
        kick();
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
        var t = e.touches[0]; if (!t) return;
        mouse.tx = t.clientX; mouse.ty = t.clientY;
        if (!mouse.over) { mouse.over = true; mouse.x = mouse.tx; mouse.y = mouse.ty; }
        kick();
    }, { passive: true });
    function leave() { mouse.over = false; kick(); }
    document.documentElement.addEventListener('mouseleave', leave);
    window.addEventListener('touchend', leave, { passive: true });
    window.addEventListener('touchcancel', leave, { passive: true });
    window.addEventListener('blur', leave);

    var scrollTicking = false;
    function onScroll() {
        scrollTicking = false;
        var y = window.scrollY, vh = H || window.innerHeight;
        frozen = y > 24;
        frontY = measureFront();
        if (partSection) {
            // 0 when the section's top reaches the top of the viewport, 1 at the page bottom.
            var sectionTop = partSection.getBoundingClientRect().top + y;
            var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            var total = maxScroll - sectionTop;
            zoomP = total > 0 ? clamp((y - sectionTop) / total, 0, 1) : 0;
            document.documentElement.style.setProperty('--zoom', zoomP.toFixed(4));
        }
        var scrolled = y > 40;
        if (topbar) topbar.classList.toggle('is-scrolled', scrolled);
        document.body.classList.toggle('is-scrolled', scrolled);
        kick();
    }
    window.addEventListener('scroll', function () {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(onScroll);
    }, { passive: true });

    var sliderTimer = null;
    function updateSliderFill() {
        slider.style.setProperty('--fill', slider.value + '%');
    }
    slider.addEventListener('input', function () {
        updateSliderFill();
        clearTimeout(sliderTimer);
        sliderTimer = setTimeout(function () { generate(false); }, 50);
    });

    if (regenBtn) {
        regenBtn.addEventListener('click', function () {
            seed = (Math.random() * 0xffffffff) >>> 0;
            rng = mulberry32(seed);
            regenBtn.classList.add('is-spinning');
            setTimeout(function () { regenBtn.classList.remove('is-spinning'); }, 600);
            generate(true);
        });
    }

    var resizeTimer = null, lastW = 0, lastH = 0;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            var w = canvas.offsetWidth, h = canvas.offsetHeight;
            if (w === lastW && h === lastH) { frontY = measureFront(); kick(); return; }
            var big = Math.abs(w - lastW) / lastW > 0.02 || Math.abs(h - lastH) / lastH > 0.25;
            sizeCanvases();
            frontY = measureFront();
            cup = null;
            if (big) { lastW = w; lastH = h; generate(false); }
            else { renderWire(); scheduleMetal(); kick(); }
        }, 160);
    });

    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
    window.addEventListener('load', onScroll);   // fonts settle layout, so re-measure the gap
    reduceMotionQuery.addEventListener('change', function () { growing = false; kick(); });

    /* ---------- Boot ---------- */
    sizeCanvases();
    lastW = W; lastH = H;
    updateSliderFill();
    generate(true);
    onScroll();
})();
