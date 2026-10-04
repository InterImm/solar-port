// Transfers between two bodies: the cheap Hohmann estimate used for the departures
// board, and a Lambert search for each speed class used by the trip inquiry.
//
// Delta-v here is heliocentric: the change of velocity needed to leave the departure
// planet's orbit onto the transfer orbit plus the change needed to match the
// destination planet's orbit (|v_inf| at each end). Escaping and landing burns are
// left out because they depend on the port, not the route.

import { AU, MU_SUN, BODIES, planetState, semiMajorAU, meanMotion, meanLongitude } from './ephemeris.js';
import { lambert } from './lambert.js';

const DAY = 86400;
const K = 0.01720209895; // Gaussian gravitational constant, AU^1.5 / day
const V_EARTH = 29.7847; // km/s, circular speed at 1 AU

const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Hohmann estimate between circular, coplanar orbits.
 * @returns {{tof:number, wait:number, dv:number, syn:number, depJD:number}} days, km/s
 */
export function hohmann(from, to, jd) {
    const r1 = semiMajorAU(from), r2 = semiMajorAU(to);
    const at = (r1 + r2) / 2;
    const tof = (Math.PI * Math.sqrt(at ** 3)) / K;
    const n1 = meanMotion(from), n2 = meanMotion(to);
    const need = Math.PI - n2 * tof; // target's lead angle at departure
    const phase = meanLongitude(to, jd) - meanLongitude(from, jd);
    const rel = n2 - n1, syn = Math.abs((2 * Math.PI) / rel);
    let wait = ((need - phase) / rel) % syn;
    if (wait < 0) wait += syn;
    const v1 = V_EARTH / Math.sqrt(r1), v2 = V_EARTH / Math.sqrt(r2);
    const dv = Math.abs(v1 * (Math.sqrt((2 * r2) / (r1 + r2)) - 1)) + Math.abs(v2 * (1 - Math.sqrt((2 * r1) / (r1 + r2))));
    return { tof, wait, dv, syn, depJD: jd + wait };
}

/** One Lambert transfer: leave `from` at depJD, arrive at `to` tof days later. */
export function leg(from, to, depJD, tof) {
    const a = planetState(from, depJD), b = planetState(to, depJD + tof);
    const sol = lambert(MU_SUN, a.r, b.r, tof * DAY);
    if (!sol) return null;
    const dvDep = norm(sub(sol.v1, a.v)), dvArr = norm(sub(sol.v2, b.v));
    return { from, to, depJD, tof, dv: dvDep + dvArr, dvDep, dvArr, r1: a.r, v1: sol.v1, r2: b.r };
}

/**
 * Speed classes. `tof` is a list of flight times as fractions of the Hohmann time;
 * `within` is how many days ahead the class may depart (null: one synodic period).
 */
export const CLASSES = {
    eco: { tof: [0.8, 0.9, 1, 1.1], within: null },
    exp: { tof: [0.45, 0.52, 0.6], within: 120 },
    torch: { tof: [0.22, 0.27, 0.32], within: 42 },
};

const cache = new Map();

/** Cheapest transfer of a class departing from jd onwards. */
export function plan(from, to, jd, cls = 'eco') {
    const key = `${from}|${to}|${Math.floor(jd)}|${cls}`;
    if (cache.has(key)) return cache.get(key);
    const h = hohmann(from, to, jd), c = CLASSES[cls];
    const span = c.within ?? Math.min(h.syn, 900);
    const steps = 90;
    let best = null;
    const consider = (r) => { if (r && Number.isFinite(r.dv) && (!best || r.dv < best.dv)) best = r; };
    for (let s = 0; s <= steps; s++) {
        const dep = jd + (span * s) / steps;
        for (const f of c.tof) consider(leg(from, to, dep, h.tof * f));
    }
    // Refine the departure day and flight time around the best sample, staying inside the
    // class's range of flight times so a faster class never drifts back towards a slower one.
    const tMin = h.tof * Math.min(...c.tof), tMax = h.tof * Math.max(...c.tof);
    for (let k = 1; k <= 6 && best; k++) {
        const dd = span / steps / k, dt = (h.tof * 0.05) / k;
        for (const [a, b] of [[-dd, 0], [dd, 0], [0, -dt], [0, dt]]) {
            const tof = Math.min(tMax, Math.max(tMin, best.tof + b));
            const dep = best.depJD + a;
            if (dep >= jd && dep <= jd + span) consider(leg(from, to, dep, tof));
        }
    }
    if (best) Object.assign(best, { cls, wait: best.depJD - jd });
    if (cache.size > 600) cache.clear();
    cache.set(key, best);
    return best;
}

/** Points along a transfer (km), from the departure to the arrival position. */
export function transferPath(t, n = 96) {
    const { r1, v1, r2 } = t;
    const h = cross(r1, v1), hn = norm(h), r1n = norm(r1), v2 = dot(v1, v1);
    const evec = sub(r1.map((c) => c * (v2 / MU_SUN - 1 / r1n)), v1.map((c) => (c * dot(r1, v1)) / MU_SUN));
    const e = norm(evec), p = (hn * hn) / MU_SUN;
    const P = r1.map((c) => c / r1n), Q = cross(h, P).map((c) => c / hn);
    const nu1 = e > 1e-9 ? Math.atan2(dot(cross(evec, P), h) / hn, dot(evec, P)) : 0;
    let dth = Math.atan2(dot(r2, Q), dot(r2, P));
    if (dth < 0) dth += 2 * Math.PI;
    const pts = [];
    for (let k = 0; k <= n; k++) {
        const d = (dth * k) / n, r = p / (1 + e * Math.cos(nu1 + d));
        pts.push([0, 1, 2].map((i) => r * (Math.cos(d) * P[i] + Math.sin(d) * Q[i])));
    }
    return pts;
}

/** Length of the path flown, in AU. */
export function pathAU(t) {
    if (t.path == null) {
        const pts = transferPath(t, 180);
        let d = 0;
        for (let k = 1; k < pts.length; k++) d += norm(sub(pts[k], pts[k - 1]));
        t.path = d / AU;
    }
    return t.path;
}

export { BODIES };
