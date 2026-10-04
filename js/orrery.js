// The sky: a canvas drawing of the solar system seen from above the ecliptic, tilted
// and turned by dragging. Distances are compressed by default so Mercury and Neptune
// both fit; "true scale" draws them linearly.

import { AU, BODIES, position, orbitPath } from './ephemeris.js';

const COLOURS = ['#8a8a85', '#c9a35a', '#3d6fa8', '#b0441c', '#8c8476', '#b08155', '#c2a46b', '#5f9ea8', '#3f5fa0'];
const SIZES = [3, 4.5, 4.8, 4, 2.6, 9, 8, 6, 6];
const OUTER = 31; // AU, a little beyond Neptune

export function createOrrery(canvas, { names, onPick }) {
    const ctx = canvas.getContext('2d');
    const state = { yaw: -0.5, tilt: 1.05, trueScale: false, flat: false, jd: 0, from: 2, to: 3, hover: -1,
        route: null, ships: [], pulse: null };
    let W = 0, H = 0, hits = [];
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

    function resize() {
        const dpr = window.devicePixelRatio || 1, b = canvas.getBoundingClientRect();
        W = b.width; H = b.height;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function project(p) {
        const x = p[0] / AU, y = p[1] / AU, z = p[2] / AU;
        const r = Math.hypot(x, y, z), R = Math.min(W, H * 1.7) * 0.46;
        const s = r ? (state.trueScale ? (R * r) / OUTER : R * Math.pow(r / OUTER, 0.42)) / r : 0;
        const X = x * s, Y = y * s, Z = z * s;
        const cx = X * Math.cos(state.yaw) - Y * Math.sin(state.yaw), cy = X * Math.sin(state.yaw) + Y * Math.cos(state.yaw);
        const t = state.flat ? 0 : state.tilt;
        return { X: W / 2 + cx, Y: H / 2 + cy * Math.cos(t) - Z * Math.sin(t), d: cy };
    }

    function line(pts, colour, width = 1, dash = []) {
        ctx.beginPath();
        pts.forEach((p, k) => { const q = project(p); k ? ctx.lineTo(q.X, q.Y) : ctx.moveTo(q.X, q.Y); });
        ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    }

    function draw() {
        if (!W) return;
        const ink = css('--text'), muted = css('--muted'), rule = css('--border'), accent = css('--accent');
        ctx.clearRect(0, 0, W, H);
        hits = [];
        BODIES.forEach((b, i) => {
            const on = i === state.from || i === state.to;
            line(orbitPath(b, state.jd), on ? ink : rule, 1, b === 'ceres' ? [2, 4] : []);
        });
        if (state.route) line(state.route, accent, 1.6, [6, 5]);
        for (const s of state.ships) {
            const q = project(s.at);
            ctx.fillStyle = accent; ctx.beginPath();
            ctx.moveTo(q.X, q.Y - 4); ctx.lineTo(q.X + 3.5, q.Y + 3); ctx.lineTo(q.X - 3.5, q.Y + 3); ctx.closePath(); ctx.fill();
        }
        // The Sun, drawn as a seal: an ink disc with twelve short rays.
        const sun = project([0, 0, 0]);
        ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(sun.X, sun.Y, 7, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = ink; ctx.lineWidth = 1;
        for (let k = 0; k < 12; k++) {
            const a = (k * Math.PI) / 6;
            ctx.beginPath(); ctx.moveTo(sun.X + Math.cos(a) * 10, sun.Y + Math.sin(a) * 10);
            ctx.lineTo(sun.X + Math.cos(a) * 14, sun.Y + Math.sin(a) * 14); ctx.stroke();
        }
        const planets = BODIES.map((b, i) => ({ i, q: project(position(b, state.jd)) })).sort((a, b) => a.q.d - b.q.d);
        ctx.font = `12px ${css('--font') || 'sans-serif'}`;
        for (const { i, q } of planets) {
            const r = SIZES[i];
            hits.push({ i, X: q.X, Y: q.Y, r: r + 9 });
            if (!state.flat) { ctx.strokeStyle = rule; ctx.beginPath(); ctx.moveTo(q.X, q.Y); ctx.lineTo(q.X, q.Y + 10); ctx.stroke(); }
            ctx.fillStyle = COLOURS[i]; ctx.beginPath(); ctx.arc(q.X, q.Y, r, 0, 2 * Math.PI); ctx.fill();
            if (i === 6) { ctx.strokeStyle = COLOURS[i]; ctx.beginPath(); ctx.ellipse(q.X, q.Y, r * 1.9, r * 0.6, -0.3, 0, 2 * Math.PI); ctx.stroke(); }
            if (i === state.from || i === state.to || i === state.hover) {
                ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.X, q.Y, r + 5, 0, 2 * Math.PI); ctx.stroke(); ctx.lineWidth = 1;
            }
            ctx.fillStyle = i === state.from || i === state.to ? ink : muted;
            ctx.fillText(names(i), q.X + r + 6, q.Y - r - 2);
        }
        if (state.pulse) {
            const f = (performance.now() - state.pulse.t0) / state.pulse.ms;
            if (f >= 1) state.pulse = null;
            else {
                const a = project(position(BODIES[state.pulse.from], state.jd)), b = project(position(BODIES[state.pulse.to], state.jd));
                const X = a.X + (b.X - a.X) * f, Y = a.Y + (b.Y - a.Y) * f;
                ctx.strokeStyle = accent; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(a.X, a.Y); ctx.lineTo(X, Y); ctx.stroke(); ctx.globalAlpha = 1;
                ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(X, Y, 4, 0, 2 * Math.PI); ctx.fill();
            }
        }
    }

    // Drag to turn (sideways) and tilt (up and down); a click without a drag picks a planet.
    let drag = null;
    const local = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    const hit = (x, y) => hits.find((h) => Math.hypot(h.X - x, h.Y - y) < h.r);
    canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, tilt: state.tilt, moved: false }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
        if (drag) {
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
            if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
            state.yaw = drag.yaw + dx * 0.006;
            state.tilt = Math.max(0, Math.min(1.35, drag.tilt + dy * 0.005));
            draw();
            return;
        }
        const h = hit(...local(e)), i = h ? h.i : -1;
        if (i !== state.hover) { state.hover = i; canvas.style.cursor = h ? 'pointer' : ''; draw(); }
    });
    canvas.addEventListener('pointerup', (e) => {
        const d = drag; drag = null;
        if (!d || d.moved) return;
        const h = hit(...local(e));
        if (h) onPick(h.i);
    });
    window.addEventListener('resize', () => { resize(); draw(); });
    resize();
    return { state, draw, resize, sendPulse(from, to, ms) { state.pulse = { from, to, ms, t0: performance.now() }; } };
}
