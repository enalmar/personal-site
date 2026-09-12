/* Enrique Alabort — personal site
   Profile scale diagram, the citations chart, and the four research sketches:
   stiffness matching (metallic bone), a Pareto design space (alloys by design),
   grain boundary sliding (superplasticity) and microtwinning (superalloys).
   Each sketch runs only while on screen and respects prefers-reduced-motion. */
(function () {
    'use strict';

    var TAU = Math.PI * 2;
    var reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduced = function () { return reduceMotionQuery.matches; };
    var clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
    var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
    var lerp = function (a, b, t) { return a + (b - a) * t; };
    var DPR = Math.min(window.devicePixelRatio || 1, 2);

    var COL = {
        text: '#e8ecf2', medium: '#c3cad4', muted: '#96a0ae', soft: '#6b7684',
        accent: '#8fd8ff', accentRgb: '143, 216, 255',
        blue: '#2f95d6', orange: '#cf7a28', violet: '#8b6fe6',
        line: 'rgba(255, 255, 255, 0.12)', grid: 'rgba(255, 255, 255, 0.06)'
    };
    var SANS = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    var SERIF = '"Fraunces", "Iowan Old Style", "Palatino Linotype", serif';

    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    /* =====================================================================
       Profile: the scale diagram
       ===================================================================== */
    (function () {
        var scale = document.getElementById('scale');
        if (!scale) return;
        var points = Array.prototype.slice.call(scale.querySelectorAll('.scale-point'));
        var bands = Array.prototype.slice.call(scale.querySelectorAll('.scale-band'));

        if ('IntersectionObserver' in window && !reduced()) {
            var io = new IntersectionObserver(function (entries) {
                if (entries[0].isIntersecting) { scale.classList.add('is-in'); io.disconnect(); }
            }, { threshold: 0.25 });
            io.observe(scale);
        } else {
            scale.classList.add('is-in');
        }

        var lit = null;
        function light(band) {
            lit = band;
            scale.classList.toggle('has-focus', !!band);
            var key = band ? band.getAttribute('data-band') : null;
            bands.forEach(function (b) { b.classList.toggle('is-lit', b === band); });
            points.forEach(function (p) {
                p.classList.toggle('is-lit', !!key && p.getAttribute('data-band').split(' ').indexOf(key) >= 0);
            });
        }
        bands.forEach(function (band) {
            band.addEventListener('mouseenter', function () { light(band); });
            band.addEventListener('mouseleave', function () { if (document.activeElement !== band) light(null); });
            band.addEventListener('focus', function () { light(band); });
            band.addEventListener('blur', function () { light(null); });
            band.addEventListener('click', function () { light(lit === band ? null : band); });
        });
    })();

    /* =====================================================================
       Citations per year (Google Scholar, read 12 Sep 2026)
       ===================================================================== */
    (function () {
        var fig = document.getElementById('citesChart');
        if (!fig) return;
        var DATA = [[2016, 19], [2017, 52], [2018, 77], [2019, 148], [2020, 229], [2021, 274],
                    [2022, 359], [2023, 429], [2024, 432], [2025, 450], [2026, 352]];
        var W = 320, H = 118, L = 4, R = 4, T = 16, B = 18, GAP = 2;
        var n = DATA.length, max = 450;
        var plotW = W - L - R, plotH = H - T - B;
        var bw = (plotW - GAP * (n - 1)) / n;
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('role', 'img');

        function el(tag, attrs, text) {
            var e = document.createElementNS(ns, tag);
            for (var k in attrs) e.setAttribute(k, attrs[k]);
            if (text != null) e.textContent = text;
            svg.appendChild(e);
            return e;
        }
        function barPath(x, y, w, h, r) {
            r = Math.min(r, w / 2, h);
            return 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + (-r) +
                   'h' + (w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'V' + (y + h) + 'Z';
        }

        var tip = document.createElement('div');
        tip.className = 'chart-tip';
        fig.appendChild(tip);

        DATA.forEach(function (d, i) {
            var x = L + i * (bw + GAP), h = Math.max(1.5, plotH * d[1] / max), y = T + plotH - h;
            var partial = d[0] === 2026;
            var bar = el('path', { d: barPath(x, y, bw, h, 2), 'class': 'bar' + (partial ? ' partial' : '') });
            var hit = el('rect', { x: x - GAP / 2, y: T, width: bw + GAP, height: plotH, 'class': 'bar-hit' });
            if (d[0] % 3 === 1 || d[0] === 2026) el('text', { x: x + bw / 2, y: H - 5, 'class': 'lbl', 'text-anchor': 'middle' }, String(d[0]).slice(2).replace(/^/, "’"));
            if (d[1] === max) el('text', { x: x + bw / 2, y: y - 4, 'class': 'val', 'text-anchor': 'middle' }, String(d[1]));
            function show() {
                bar.classList.add('is-hot');
                tip.textContent = d[0] + ' · ' + d[1] + ' citations' + (partial ? ' so far' : '');
                var rect = fig.getBoundingClientRect(), sr = svg.getBoundingClientRect();
                var sx = sr.width / W;
                tip.style.left = (sr.left - rect.left + (x + bw / 2) * sx) + 'px';
                tip.style.top = (sr.top - rect.top + y * sx) + 'px';
                tip.classList.add('is-on');
            }
            function hide() { bar.classList.remove('is-hot'); tip.classList.remove('is-on'); }
            hit.addEventListener('mouseenter', show);
            hit.addEventListener('mouseleave', hide);
            hit.addEventListener('touchstart', show, { passive: true });
        });
        el('line', { x1: L, y1: T + plotH + 0.5, x2: W - R, y2: T + plotH + 0.5, 'class': 'axis' });
        fig.insertBefore(svg, fig.firstChild);
        svg.addEventListener('mouseleave', function () { tip.classList.remove('is-on'); });
    })();

    /* =====================================================================
       Sketch runner: sizing, visibility, frame loop
       ===================================================================== */
    function Sketch(canvas, spec) {
        if (!canvas || !canvas.getContext) return null;
        var ctx = canvas.getContext('2d');
        var self = { canvas: canvas, ctx: ctx, w: 0, h: 0, visible: false, t: 0, raf: null, last: 0, dirty: true };

        function size() {
            var w = canvas.clientWidth, h = canvas.clientHeight;
            if (!w || !h) return false;
            if (w !== self.w || h !== self.h) {
                self.w = w; self.h = h;
                canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR);
                ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
                if (spec.init) spec.init(self);
                self.dirty = true;
            }
            return true;
        }
        function frame(now) {
            self.raf = null;
            if (!self.visible || !size()) return;
            var dt = self.last ? Math.min(0.05, (now - self.last) / 1000) : 0;
            self.last = now;
            if (!reduced() || self.dirty) {
                if (!reduced()) self.t += dt;
                var again = spec.draw(self, ctx, self.w, self.h, self.t, dt);
                self.dirty = false;
                if (again && !reduced()) kick();
            }
        }
        function kick() {
            if (self.raf === null && self.visible) self.raf = window.requestAnimationFrame(frame);
        }
        self.kick = function () { self.dirty = true; kick(); };

        if ('ResizeObserver' in window) {
            new ResizeObserver(function () { size(); self.dirty = true; kick(); }).observe(canvas);
        } else {
            window.addEventListener('resize', function () { size(); self.dirty = true; kick(); });
        }
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                self.visible = entries[0].isIntersecting;
                if (self.visible) { self.last = 0; kick(); }
            }, { threshold: 0.05 }).observe(canvas);
        } else {
            self.visible = true; kick();
        }
        document.addEventListener('visibilitychange', function () { if (!document.hidden) { self.last = 0; kick(); } });
        reduceMotionQuery.addEventListener('change', function () { self.dirty = true; kick(); });
        return self;
    }

    function hud(ctx, text, x, y, align, color, size, font) {
        ctx.font = (size || 11) + 'px ' + (font || SANS);
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color || COL.soft;
        ctx.fillText(text, x, y);
    }
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    }

    /* =====================================================================
       1. Metallic bone — stiffness matching
       ===================================================================== */
    (function () {
        var canvas = document.getElementById('vizBone');
        var slider = document.getElementById('boneDensity');
        var out = document.getElementById('boneDensityOut');
        if (!canvas || !slider) return;

        var E_SOLID = 110;                              // Ti-6Al-4V, GPa
        var target = +slider.value / 100, shown = target;
        var LOG_MIN = Math.log10(0.1), LOG_MAX = Math.log10(200);
        function modulus(rho) { return E_SOLID * 0.5 * Math.pow(rho, 1.5); }   // Gibson–Ashby scaling, illustrative
        function toY(E, y0, y1) { return y1 - (Math.log10(E) - LOG_MIN) / (LOG_MAX - LOG_MIN) * (y1 - y0); }

        var sk = Sketch(canvas, {
            draw: function (s, ctx, w, h, t, dt) {
                var moving = Math.abs(target - shown) > 0.0005;
                if (moving) shown += (target - shown) * (reduced() ? 1 : Math.min(1, dt * 9));
                else shown = target;

                ctx.clearRect(0, 0, w, h);
                var rho = shown, E = modulus(rho);

                // --- unit cells, left ---
                var narrow = w < 420;
                var cellL = Math.min(w * (narrow ? 0.15 : 0.17), h * 0.26), ox = w * 0.05, oy = h * 0.5 - cellL;
                var tw = cellL * 0.42 * Math.sqrt(rho);
                ctx.save();
                ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                function cell(x, y) {
                    var pts = [[x, y], [x + cellL, y], [x + cellL, y + cellL], [x, y + cellL]];
                    var cx = x + cellL / 2, cy = y + cellL / 2;
                    ctx.beginPath();
                    for (var i = 0; i < 4; i++) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[(i + 1) % 4][0], pts[(i + 1) % 4][1]); }
                    for (i = 0; i < 4; i++) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(cx, cy); }
                    ctx.stroke();
                }
                for (var pass = 0; pass < 2; pass++) {
                    ctx.lineWidth = pass ? tw : tw + 2;
                    ctx.strokeStyle = pass ? '#7d8289' : 'rgba(0, 0, 0, 0.55)';
                    for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) cell(ox + i * cellL, oy + j * cellL);
                }
                // light edge along the struts
                ctx.lineWidth = Math.max(0.8, tw * 0.22);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
                ctx.save(); ctx.translate(-tw * 0.22, -tw * 0.22);
                for (i = 0; i < 2; i++) for (j = 0; j < 2; j++) cell(ox + i * cellL, oy + j * cellL);
                ctx.restore();
                ctx.restore();
                hud(ctx, 'ρ = ' + Math.round(rho * 100) + '%  ·  t/L ≈ ' + (0.42 * Math.sqrt(rho)).toFixed(2), ox, oy + 2 * cellL + 22, 'left', COL.muted, 11);
                hud(ctx, 'STRUT LATTICE', ox, oy - 12, 'left', COL.soft, 9.5);

                // --- modulus gauge, right ---
                var gx = w * (narrow ? 0.46 : 0.50), y0 = h * 0.12, y1 = h * 0.88, gw = 14, lx = gx + gw + (narrow ? 18 : 26);
                function band(lo, hi, label, color) {
                    var ya = toY(hi, y0, y1), yb = toY(lo, y0, y1);
                    ctx.fillStyle = color;
                    ctx.fillRect(gx - 20, ya, gw + 40, yb - ya);
                    hud(ctx, label, lx, (ya + yb) / 2 + 4, 'left', COL.muted, 10.5);
                }
                band(10, 20, 'cortical bone', 'rgba(' + COL.accentRgb + ', 0.14)');
                band(0.1, 2, 'cancellous bone', 'rgba(' + COL.accentRgb + ', 0.10)');
                // axis
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(gx + gw / 2, y0); ctx.lineTo(gx + gw / 2, y1); ctx.stroke();
                [0.1, 1, 10, 100].forEach(function (v) {
                    var y = toY(v, y0, y1);
                    ctx.beginPath(); ctx.moveTo(gx + gw / 2 - 4, y); ctx.lineTo(gx + gw / 2 + 4, y); ctx.stroke();
                    hud(ctx, v + '', gx - 12, y + 3.5, 'right', COL.soft, 9.5);
                });
                hud(ctx, 'GPa', gx - 12, y0 - 8, 'right', COL.soft, 9.5);
                // solid reference
                var ys = toY(E_SOLID, y0, y1);
                ctx.fillStyle = COL.medium;
                ctx.beginPath(); ctx.moveTo(gx + gw / 2 - 5, ys); ctx.lineTo(gx + gw / 2, ys - 5); ctx.lineTo(gx + gw / 2 + 5, ys); ctx.lineTo(gx + gw / 2, ys + 5); ctx.closePath(); ctx.fill();
                if (narrow) { hud(ctx, 'solid Ti‑6Al‑4V', lx, ys - 1, 'left', COL.medium, 10); hud(ctx, '110 GPa', lx, ys + 11, 'left', COL.soft, 9.5); }
                else hud(ctx, 'solid Ti‑6Al‑4V · 110 GPa', lx, ys + 4, 'left', COL.medium, 10.5);
                // lattice marker
                var ym = toY(E, y0, y1);
                ctx.fillStyle = 'rgba(' + COL.accentRgb + ', 0.25)';
                ctx.beginPath(); ctx.arc(gx + gw / 2, ym, 11, 0, TAU); ctx.fill();
                ctx.fillStyle = COL.accent;
                ctx.beginPath(); ctx.arc(gx + gw / 2, ym, 5, 0, TAU); ctx.fill();
                ctx.strokeStyle = COL.accent; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(ox + 2 * cellL + 10, h * 0.5); ctx.lineTo(gx - 30, h * 0.5); ctx.lineTo(gx - 30, ym); ctx.lineTo(gx + gw / 2 - 12, ym); ctx.stroke();
                var label = E >= 20 ? 'stiffer than bone' : E >= 10 ? 'cortical range' : E > 2 ? 'between the two' : E >= 0.1 ? 'cancellous range' : 'too compliant';
                hud(ctx, (E < 10 ? E.toFixed(1) : Math.round(E)) + ' GPa', lx, ym + 1, 'left', COL.text, 15, SERIF);
                hud(ctx, label, lx, ym + 14, 'left', COL.accent, 9.5);

                return moving;
            }
        });
        if (!sk) return;
        slider.addEventListener('input', function () {
            target = +slider.value / 100;
            out.textContent = slider.value + '%';
            slider.setAttribute('aria-valuetext', slider.value + '% relative density, about ' + modulus(target).toFixed(1) + ' gigapascals');
            sk.kick();
        });
    })();

    /* =====================================================================
       2. Alloys by design — a Pareto front in property space
       ===================================================================== */
    (function () {
        var canvas = document.getElementById('vizAlloys');
        if (!canvas) return;
        var rng = mulberry32(20190715);
        var N = 240, pts = [];
        for (var i = 0; i < N; i++) {
            var E = 45 + rng() * 83;
            var sig = 330 + 6.6 * E + (rng() + rng() + rng() - 1.5) * 300;
            sig = clamp(sig, 420, 1290);
            pts.push({ E: E, s: sig, front: false, order: rng() });
        }
        // Pareto front: lowest modulus for a given strength.
        var sorted = pts.slice().sort(function (a, b) { return a.E - b.E; });
        var best = -Infinity, front = [];
        sorted.forEach(function (p) { if (p.s > best) { best = p.s; p.front = true; front.push(p); } });
        // The "made" candidate: on the front, in the low-modulus corner, strongest there.
        var chosen = null;
        front.forEach(function (p) { if (p.E >= 58 && p.E <= 82 && (!chosen || p.s > chosen.s)) chosen = p; });
        if (!chosen) chosen = front[Math.floor(front.length / 2)];
        var REF = { E: 112, s: 900 };
        var hover = null, revealStart = null;

        var X0 = 40, X1 = 130, S0 = 400, S1 = 1300;
        function layout(w, h) { return { l: 42, r: 16, t: 18, b: 34, w: w, h: h }; }
        function px(L, E) { return L.l + (E - X0) / (X1 - X0) * (L.w - L.l - L.r); }
        function py(L, s) { return L.h - L.b - (s - S0) / (S1 - S0) * (L.h - L.t - L.b); }

        var sk = Sketch(canvas, {
            draw: function (s, ctx, w, h, t) {
                if (revealStart === null) revealStart = t;
                var rt = reduced() ? 1 : clamp((t - revealStart) / 1.4, 0, 1);
                var L = layout(w, h);
                ctx.clearRect(0, 0, w, h);

                // grid + axes
                ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
                [60, 80, 100, 120].forEach(function (v) { var x = px(L, v); ctx.beginPath(); ctx.moveTo(x, L.t); ctx.lineTo(x, h - L.b); ctx.stroke(); hud(ctx, v + '', x, h - L.b + 13, 'center', COL.soft, 9.5); });
                [600, 800, 1000, 1200].forEach(function (v) { var y = py(L, v); ctx.beginPath(); ctx.moveTo(L.l, y); ctx.lineTo(w - L.r, y); ctx.stroke(); hud(ctx, v + '', L.l - 6, y + 3.5, 'right', COL.soft, 9.5); });
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.beginPath(); ctx.moveTo(L.l, L.t); ctx.lineTo(L.l, h - L.b); ctx.lineTo(w - L.r, h - L.b); ctx.stroke();
                hud(ctx, 'Young’s modulus, GPa  ·  ← closer to bone', L.l, h - 6, 'left', COL.muted, 9.5);
                ctx.save(); ctx.translate(12, L.t + (h - L.t - L.b) / 2); ctx.rotate(-Math.PI / 2);
                hud(ctx, 'yield strength, MPa  ·  stronger →', 0, 0, 'center', COL.muted, 9.5);
                ctx.restore();

                // candidates
                pts.forEach(function (p) {
                    var a = smooth((rt - p.order * 0.6) / 0.4);
                    if (a <= 0) return;
                    var x = px(L, p.E), y = py(L, p.s);
                    ctx.fillStyle = p.front ? COL.blue : 'rgba(255, 255, 255, ' + (0.26 * a) + ')';
                    ctx.globalAlpha = p.front ? a : 1;
                    ctx.beginPath(); ctx.arc(x, y, p.front ? 3.4 : 2.2, 0, TAU); ctx.fill();
                    if (p.front) { ctx.strokeStyle = 'rgba(7, 9, 13, 0.9)'; ctx.lineWidth = 1.5; ctx.stroke(); }
                    ctx.globalAlpha = 1;
                });

                // front line (draws in after the points)
                var lt = smooth((rt - 0.55) / 0.45);
                if (lt > 0) {
                    ctx.save();
                    ctx.beginPath();
                    front.forEach(function (p, i) { var x = px(L, p.E), y = py(L, p.s); if (i === 0) ctx.moveTo(x, y); else { ctx.lineTo(x, py(L, front[i - 1].s)); ctx.lineTo(x, y); } });
                    ctx.setLineDash([2000]); ctx.lineDashOffset = 2000 * (1 - lt);
                    ctx.strokeStyle = 'rgba(47, 149, 214, 0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
                    ctx.restore();
                    hud(ctx, 'Pareto front', px(L, front[front.length - 1].E) + 6, py(L, front[front.length - 1].s) + 4, 'left', COL.blue, 10);
                }

                // reference + chosen
                if (rt > 0.9) {
                    var rx = px(L, REF.E), ry = py(L, REF.s);
                    ctx.fillStyle = COL.text;
                    ctx.beginPath(); ctx.moveTo(rx, ry - 5); ctx.lineTo(rx + 5, ry); ctx.lineTo(rx, ry + 5); ctx.lineTo(rx - 5, ry); ctx.closePath(); ctx.fill();
                    hud(ctx, 'Ti‑6Al‑4V', rx - 8, ry - 8, 'right', COL.medium, 10);
                    var cx = px(L, chosen.E), cy = py(L, chosen.s);
                    var pulse = reduced() ? 0 : 0.5 + 0.5 * Math.sin(t * 2.2);
                    ctx.fillStyle = 'rgba(207, 122, 40, ' + (0.18 + 0.12 * pulse) + ')';
                    ctx.beginPath(); ctx.arc(cx, cy, 10 + 3 * pulse, 0, TAU); ctx.fill();
                    ctx.fillStyle = COL.orange;
                    ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, TAU); ctx.fill();
                    ctx.strokeStyle = 'rgba(7, 9, 13, 0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
                    hud(ctx, 'made & tested', cx + 12, cy - 6, 'left', COL.orange, 10);
                    hud(ctx, 'low modulus · high strength', cx + 12, cy + 6, 'left', COL.soft, 9);
                }

                // hover tooltip
                if (hover) {
                    var hx = px(L, hover.E), hy = py(L, hover.s);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'; ctx.lineWidth = 1.2;
                    ctx.beginPath(); ctx.arc(hx, hy, 6, 0, TAU); ctx.stroke();
                    var text = 'E ' + Math.round(hover.E) + ' GPa · σy ' + Math.round(hover.s) + ' MPa' + (hover.front ? ' · on the front' : '');
                    ctx.font = '10.5px ' + SANS;
                    var tw = ctx.measureText(text).width + 14;
                    var bx = clamp(hx - tw / 2, 4, w - tw - 4), by = hy - 30;
                    if (by < 4) by = hy + 14;
                    ctx.fillStyle = 'rgba(12, 15, 20, 0.94)';
                    roundRect(ctx, bx, by, tw, 20, 5); ctx.fill();
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 1; ctx.stroke();
                    hud(ctx, text, bx + 7, by + 14, 'left', COL.text, 10.5);
                }
                return rt < 1 || !reduced();   // keeps the chosen marker breathing
            }
        });
        if (!sk) return;
        canvas.addEventListener('pointermove', function (e) {
            var r = canvas.getBoundingClientRect(), L = layout(sk.w, sk.h);
            var mx = e.clientX - r.left, my = e.clientY - r.top, best = null, bd = 14 * 14;
            pts.forEach(function (p) { var dx = px(L, p.E) - mx, dy = py(L, p.s) - my, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = p; } });
            if (best !== hover) { hover = best; sk.kick(); }
        });
        canvas.addEventListener('pointerleave', function () { hover = null; sk.kick(); });
    })();

    /* =====================================================================
       3. Superplasticity — grain boundary sliding
       ===================================================================== */
    (function () {
        var canvas = document.getElementById('vizSuper');
        if (!canvas) return;
        var rng = mulberry32(20150601);
        var LAMBDA_MAX = 3.4, D0 = 15;
        var seeds = [], w0 = 0, h0 = 0, cx = 0, cy = 0, lamPrev = 1, phaseStart = 0;

        function reset(w, h) {
            w0 = w * 0.24; h0 = h * 0.56; cx = w / 2; cy = h / 2 + 6;
            seeds = [];
            var dy = D0 * 0.87, row = 0;
            for (var y = -h0 / 2 + D0 * 0.5; y < h0 / 2; y += dy, row++) {
                for (var x = -w0 / 2 + D0 * 0.5 + (row % 2) * D0 / 2; x < w0 / 2; x += D0) {
                    seeds.push({ x: cx + x + (rng() - 0.5) * D0 * 0.5, y: cy + y + (rng() - 0.5) * D0 * 0.5, a: rng() * TAU, spin: (rng() - 0.5) });
                }
            }
            lamPrev = 1;
        }
        function relax(lam) {
            var hw = w0 * lam / 2, hh = h0 / lam / 2, i, j;
            for (var it = 0; it < 2; it++) {
                for (i = 0; i < seeds.length; i++) {
                    for (j = i + 1; j < seeds.length; j++) {
                        var dx = seeds[j].x - seeds[i].x, dy = seeds[j].y - seeds[i].y, d2 = dx * dx + dy * dy;
                        if (d2 < D0 * D0 && d2 > 0.01) {
                            var d = Math.sqrt(d2), push = (D0 - d) / d * 0.25;
                            seeds[i].x -= dx * push; seeds[i].y -= dy * push; seeds[j].x += dx * push; seeds[j].y += dy * push;
                        }
                    }
                }
                for (i = 0; i < seeds.length; i++) {
                    seeds[i].x = clamp(seeds[i].x, cx - hw + 2, cx + hw - 2);
                    seeds[i].y = clamp(seeds[i].y, cy - hh + 2, cy + hh - 2);
                }
            }
        }
        // Bowyer–Watson, returning triangles with circumcentres.
        function delaunay(P) {
            var n = P.length, px = new Float64Array(n + 3), py = new Float64Array(n + 3), i;
            for (i = 0; i < n; i++) { px[i] = P[i].x; py[i] = P[i].y; }
            var big = 5000;
            px[n] = cx - big; py[n] = cy - big; px[n + 1] = cx + big; py[n + 1] = cy - big; px[n + 2] = cx; py[n + 2] = cy + big;
            function tri(a, b, c) {
                var ax = px[a], ay = py[a], bx = px[b], by = py[b], qx = px[c], qy = py[c];
                var d = 2 * (ax * (by - qy) + bx * (qy - ay) + qx * (ay - by));
                if (Math.abs(d) < 1e-9) return { a: a, b: b, c: c, x: 0, y: 0, r2: -1 };
                var a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = qx * qx + qy * qy;
                var ux = (a2 * (by - qy) + b2 * (qy - ay) + c2 * (ay - by)) / d;
                var uy = (a2 * (qx - bx) + b2 * (ax - qx) + c2 * (bx - ax)) / d;
                return { a: a, b: b, c: c, x: ux, y: uy, r2: (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy) };
            }
            var tris = [tri(n, n + 1, n + 2)], use = new Map();
            for (i = 0; i < n; i++) {
                var x = px[i], y = py[i], keep = [], bad = [];
                for (var t = 0; t < tris.length; t++) { var T = tris[t], dx = T.x - x, dy = T.y - y; if (dx * dx + dy * dy < T.r2) bad.push(T); else keep.push(T); }
                use.clear();
                bad.forEach(function (B) { [[B.a, B.b], [B.b, B.c], [B.c, B.a]].forEach(function (e) { var k = Math.min(e[0], e[1]) * 4096 + Math.max(e[0], e[1]); var v = use.get(k); if (v) v.n++; else use.set(k, { a: e[0], b: e[1], n: 1 }); }); });
                use.forEach(function (v) { if (v.n === 1) keep.push(tri(v.a, v.b, i)); });
                tris = keep;
            }
            return { tris: tris, n: n, px: px, py: py };
        }

        Sketch(canvas, {
            init: function (s) { reset(s.w, s.h); phaseStart = s.t; },
            draw: function (s, ctx, w, h, t) {
                var T = t - phaseStart, lam, fade = 1;
                if (reduced()) { lam = 2.4; }
                else if (T < 1) lam = 1;
                else if (T < 7) lam = 1 + (LAMBDA_MAX - 1) * smooth((T - 1) / 6);
                else if (T < 8.6) lam = LAMBDA_MAX;
                else if (T < 9.4) { lam = LAMBDA_MAX; fade = 1 - (T - 8.6) / 0.8; }
                else { reset(w, h); phaseStart = t; lam = 1; }

                if (lam !== lamPrev) {
                    var kx = lam / lamPrev, ky = lamPrev / lam;
                    seeds.forEach(function (p) { p.x = cx + (p.x - cx) * kx; p.y = cy + (p.y - cy) * ky; p.a += p.spin * (lam - lamPrev) * 0.9; });
                    lamPrev = lam;
                    relax(lam);
                }
                var sw = w0 * lam, sh = h0 / lam, x0 = cx - sw / 2, y0 = cy - sh / 2;

                ctx.clearRect(0, 0, w, h);
                ctx.globalAlpha = fade;

                // ghost of the starting gauge length
                ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)'; ctx.lineWidth = 1;
                ctx.strokeRect(cx - w0 / 2, cy - h0 / 2, w0, h0); ctx.setLineDash([]);

                // grips
                ctx.fillStyle = '#3a3f46';
                ctx.fillRect(x0 - 14, cy - sh / 2 - 6, 12, sh + 12);
                ctx.fillRect(x0 + sw + 2, cy - sh / 2 - 6, 12, sh + 12);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(x0 - 14, cy); ctx.lineTo(x0 - 30, cy); ctx.moveTo(x0 + sw + 14, cy); ctx.lineTo(x0 + sw + 30, cy); ctx.stroke();
                hud(ctx, '←', x0 - 34, cy + 4, 'right', COL.muted, 11);
                hud(ctx, '→', x0 + sw + 34, cy + 4, 'left', COL.muted, 11);

                // sample body
                var g = ctx.createLinearGradient(0, y0, 0, y0 + sh);
                g.addColorStop(0, '#6a7079'); g.addColorStop(0.5, '#575c64'); g.addColorStop(1, '#3f444b');
                ctx.fillStyle = g; ctx.fillRect(x0, y0, sw, sh);

                // grain boundaries: Voronoi edges of the seeds, clipped to the sample
                ctx.save();
                ctx.beginPath(); ctx.rect(x0, y0, sw, sh); ctx.clip();
                var D = delaunay(seeds), tris = D.tris, edgeMap = new Map(), i;
                for (i = 0; i < tris.length; i++) {
                    var Tr = tris[i];
                    [[Tr.a, Tr.b], [Tr.b, Tr.c], [Tr.c, Tr.a]].forEach(function (e) {
                        var k = Math.min(e[0], e[1]) * 4096 + Math.max(e[0], e[1]);
                        var v = edgeMap.get(k); if (v) v.push(Tr); else edgeMap.set(k, [Tr]);
                    });
                }
                ctx.strokeStyle = 'rgba(15, 18, 22, 0.85)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
                ctx.beginPath();
                edgeMap.forEach(function (list) {
                    if (list.length === 2) { ctx.moveTo(list[0].x, list[0].y); ctx.lineTo(list[1].x, list[1].y); }
                });
                ctx.stroke();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)'; ctx.lineWidth = 0.8;
                ctx.beginPath();
                edgeMap.forEach(function (list) {
                    if (list.length === 2) { ctx.moveTo(list[0].x + 0.7, list[0].y + 0.7); ctx.lineTo(list[1].x + 0.7, list[1].y + 0.7); }
                });
                ctx.stroke();
                // orientation ticks: each grain rotates a little as it slides
                ctx.strokeStyle = 'rgba(' + COL.accentRgb + ', 0.55)'; ctx.lineWidth = 1.2;
                ctx.beginPath();
                seeds.forEach(function (p) { var dx = Math.cos(p.a) * 3.2, dy = Math.sin(p.a) * 3.2; ctx.moveTo(p.x - dx, p.y - dy); ctx.lineTo(p.x + dx, p.y + dy); });
                ctx.stroke();
                ctx.restore();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, sw - 1, sh - 1);

                ctx.globalAlpha = 1;
                hud(ctx, 'ε = ' + Math.round((lam - 1) * 100) + ' %', 16, 24, 'left', COL.text, 17, SERIF);
                hud(ctx, 'Ti‑6Al‑4V · 850 °C · 10⁻⁴ s⁻¹', w - 14, 22, 'right', COL.muted, 10.5);
                return !reduced();
            }
        });
    })();

    /* =====================================================================
       4. Superalloys — γ/γ′ and a thickening microtwin
       ===================================================================== */
    (function () {
        var canvas = document.getElementById('vizSuperalloy');
        if (!canvas) return;
        var rng = mulberry32(20170301);
        var PITCH = 26, CUBE = 19, THETA = -Math.PI / 4, GAMMA = 0.707;   // fcc twinning shear ≈ 1/√2
        var twins = [], phaseStart = 0, cycle = 0;
        var PAD = PITCH * 6, field = null, fieldW = 0, fieldH = 0;

        function newTwin(w, h) {
            return { off: (rng() - 0.5) * Math.min(w, h) * 0.5, hwMax: 9 + rng() * 8 };
        }
        // The cuboid field is rendered once per size into an offscreen canvas
        // (with a margin so the sheared copies never run out of precipitates),
        // then blitted three times a frame under the twin transforms.
        function buildField(w, h) {
            fieldW = w + 2 * PAD; fieldH = h + 2 * PAD;
            field = document.createElement('canvas');
            field.width = Math.round(fieldW * DPR); field.height = Math.round(fieldH * DPR);
            var g = field.getContext('2d');
            g.setTransform(DPR, 0, 0, DPR, 0, 0);
            g.fillStyle = '#5c626b';
            for (var y = 0; y < fieldH; y += PITCH) {
                for (var x = 0; x < fieldW; x += PITCH) {
                    roundRect(g, x + (PITCH - CUBE) / 2, y + (PITCH - CUBE) / 2, CUBE, CUBE, 2.5); g.fill();
                }
            }
            g.fillStyle = 'rgba(255, 255, 255, 0.10)';
            for (y = 0; y < fieldH; y += PITCH) {
                for (x = 0; x < fieldW; x += PITCH) {
                    g.fillRect(x + (PITCH - CUBE) / 2, y + (PITCH - CUBE) / 2, CUBE, 2);
                    g.fillRect(x + (PITCH - CUBE) / 2, y + (PITCH - CUBE) / 2, 2, CUBE);
                }
            }
        }
        function drawGrid(ctx) {
            ctx.drawImage(field, -PAD, -PAD, fieldW, fieldH);
        }
        // Simple shear of magnitude g along the twin direction, about the point p0.
        function shearTransform(ctx, g, p0) {
            var c = Math.cos(THETA), s = Math.sin(THETA);
            // M = R(θ) · [1 g; 0 1] · R(−θ)
            var r11 = c, r12 = -s, r21 = s, r22 = c;
            var q11 = c, q12 = s, q21 = -s, q22 = c;          // R(−θ)
            var t11 = r11 * 1 + r12 * 0, t12 = r11 * g + r12 * 1, t21 = r21 * 1 + r22 * 0, t22 = r21 * g + r22 * 1;   // R·Sh
            var a = t11 * q11 + t12 * q21, b = t21 * q11 + t22 * q21, cc = t11 * q12 + t12 * q22, d = t21 * q12 + t22 * q22;
            var e = p0.x - (a * p0.x + cc * p0.y), f = p0.y - (b * p0.x + d * p0.y);
            ctx.transform(a, b, cc, d, e, f);
        }
        function bandQuad(ctx, cx, cy, ux, uy, nx, ny, d0, d1) {
            var L = 2000;
            ctx.beginPath();
            ctx.moveTo(cx + ux * L + nx * d0, cy + uy * L + ny * d0);
            ctx.lineTo(cx - ux * L + nx * d0, cy - uy * L + ny * d0);
            ctx.lineTo(cx - ux * L + nx * d1, cy - uy * L + ny * d1);
            ctx.lineTo(cx + ux * L + nx * d1, cy + uy * L + ny * d1);
            ctx.closePath();
        }

        Sketch(canvas, {
            init: function (s) { buildField(s.w, s.h); twins = [newTwin(s.w, s.h)]; phaseStart = s.t; },
            draw: function (s, ctx, w, h, t) {
                if (!field) buildField(w, h);
                var T = t - phaseStart, DUR = 7.5;
                if (T > DUR) { phaseStart = t; T = 0; twins = [newTwin(w, h)]; cycle++; }
                var tw = twins[0];
                var grow = reduced() ? 1 : smooth((T - 0.6) / 3.2);        // nucleation → thickening
                var fade = T > DUR - 0.7 && !reduced() ? (DUR - T) / 0.7 : 1;
                var hw = tw.hwMax * grow;
                var cx = w / 2, cy = h / 2;
                var ux = Math.cos(THETA), uy = Math.sin(THETA), nx = -uy, ny = ux;
                var band0 = tw.off - hw, band1 = tw.off + hw;                 // distances along n
                var p0 = { x: cx + nx * band0, y: cy + ny * band0 };            // upper twin boundary
                var p1 = { x: cx + nx * band1, y: cy + ny * band1 };            // lower twin boundary

                ctx.clearRect(0, 0, w, h);
                ctx.fillStyle = '#262b31'; ctx.fillRect(0, 0, w, h);          // γ matrix

                // untwinned side A
                ctx.save(); bandQuad(ctx, cx, cy, ux, uy, nx, ny, -3000, band0); ctx.clip(); drawGrid(ctx); ctx.restore();
                // the twin: sheared
                ctx.save(); bandQuad(ctx, cx, cy, ux, uy, nx, ny, band0, band1); ctx.clip();
                shearTransform(ctx, GAMMA, p0); drawGrid(ctx); ctx.restore();
                // untwinned side B, displaced by the full shear across the band
                ctx.save(); bandQuad(ctx, cx, cy, ux, uy, nx, ny, band1, 3000); ctx.clip();
                ctx.translate(ux * GAMMA * 2 * hw, uy * GAMMA * 2 * hw); drawGrid(ctx); ctx.restore();

                if (hw > 0.2) {
                    // twin tint and boundaries (partial dislocations)
                    ctx.save(); bandQuad(ctx, cx, cy, ux, uy, nx, ny, band0, band1); ctx.clip();
                    ctx.fillStyle = 'rgba(' + COL.accentRgb + ', ' + (0.10 * fade) + ')'; ctx.fillRect(0, 0, w, h);
                    ctx.restore();
                    ctx.strokeStyle = 'rgba(' + COL.accentRgb + ', ' + (0.85 * fade) + ')'; ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p0.x + ux * 2000, p0.y + uy * 2000); ctx.lineTo(p0.x - ux * 2000, p0.y - uy * 2000);
                    ctx.moveTo(p1.x + ux * 2000, p1.y + uy * 2000); ctx.lineTo(p1.x - ux * 2000, p1.y - uy * 2000);
                    ctx.stroke();
                }

                // fade to a fresh field at the end of the cycle
                if (fade < 1) { ctx.fillStyle = 'rgba(38, 43, 49, ' + (1 - fade) + ')'; ctx.fillRect(0, 0, w, h); }

                // HUD
                ctx.fillStyle = 'rgba(7, 9, 13, 0.55)'; roundRect(ctx, 10, 10, 158, 40, 6); ctx.fill();
                hud(ctx, 'microtwin  ·  ' + (hw * 2 * 5).toFixed(0) + ' nm thick', 18, 26, 'left', COL.text, 11);
                hud(ctx, 'γ = 0.707 · thickening by partials', 18, 41, 'left', COL.soft, 9.5);
                ctx.fillStyle = 'rgba(7, 9, 13, 0.55)'; roundRect(ctx, w - 150, 10, 140, 26, 6); ctx.fill();
                hud(ctx, 'single crystal · [001] · 800 °C', w - 18, 27, 'right', COL.muted, 10);
                return !reduced();
            }
        });
    })();
})();
