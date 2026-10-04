// Heliocentric positions and velocities of the planets (and Ceres).
//
// Planets: the JPL "Keplerian Elements for Approximate Positions of the Major
// Planets" (E.M. Standish, Table 1, valid 1800-2050), the same model and code as
// InterImm/interplanetary-logistics (js/ephemeris.js), extended from Earth and
// Mars to every planet. "Earth" is the Earth-Moon barycenter.
// Ceres: rounded osculating elements, good to about a degree; it is scenery.
//
// Units: km, km/s, seconds; time is a Julian Date (TDB treated as UTC).
// The frame is the mean ecliptic and equinox of J2000.

export const AU = 149597870.7; // km
export const MU_SUN = 1.32712440018e11; // km^3/s^2
export const LIGHT_KMS = 299792.458;

const J2000 = 2451545.0;
const DAYS_PER_CENTURY = 36525;
const DEG = Math.PI / 180;

export const BODIES = ['mercury', 'venus', 'earth', 'mars', 'ceres', 'jupiter', 'saturn', 'uranus', 'neptune'];

// [value at J2000, rate per Julian century]; a in AU, angles in degrees.
const ELEMENTS = {
    mercury: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749],
        L: [252.25032350, 149472.67411175], peri: [77.45779628, 0.16047689], node: [48.33076593, -0.12534081] },
    venus: { a: [0.72333566, 0.00000390], e: [0.00677672, -0.00004107], I: [3.39467605, -0.00078890],
        L: [181.97909950, 58517.81538729], peri: [131.60246718, 0.00268329], node: [76.67984255, -0.27769418] },
    earth: { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668],
        L: [100.46457166, 35999.37244981], peri: [102.93768193, 0.32327364], node: [0.0, 0.0] },
    mars: { a: [1.52371034, 0.00001847], e: [0.09339410, 0.00007882], I: [1.84969142, -0.00813131],
        L: [-4.55343205, 19140.30268499], peri: [-23.94362959, 0.44441088], node: [49.55953891, -0.29257343] },
    ceres: { a: [2.7675, 0], e: [0.0758, 0], I: [10.59, 0],
        L: [159.9, 7819.4], peri: [153.9, 0], node: [80.3, 0] },
    jupiter: { a: [5.20288700, -0.00011607], e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714],
        L: [34.39644051, 3034.74612775], peri: [14.72847983, 0.21252668], node: [100.47390909, 0.20469106] },
    saturn: { a: [9.53667594, -0.00125060], e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609],
        L: [49.95424423, 1222.49362201], peri: [92.59887831, -0.41897216], node: [113.66242448, -0.28867794] },
    uranus: { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939],
        L: [313.23810451, 428.48202785], peri: [170.95427630, 0.40805281], node: [74.01692503, 0.04240589] },
    neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372],
        L: [-55.12002969, 218.45945325], peri: [44.96476227, -0.32241464], node: [131.78422574, -0.00508664] },
};

const at = (pair, T) => pair[0] + pair[1] * T;

function solveKepler(M, e) {
    let E = M + e * Math.sin(M);
    for (let i = 0; i < 30; i++) {
        const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        E -= dE;
        if (Math.abs(dE) < 1e-13) break;
    }
    return E;
}

// Rotation from the orbital plane into the ecliptic frame, for one body at one time.
function frame(el, T) {
    const I = at(el.I, T) * DEG, node = at(el.node, T) * DEG, w = at(el.peri, T) * DEG - node;
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(node), sO = Math.sin(node), cI = Math.cos(I), sI = Math.sin(I);
    return (xp, yp) => [
        (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
        (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
        sw * sI * xp + cw * sI * yp,
    ];
}

/** Heliocentric position in km. */
export function position(body, jd) {
    const el = ELEMENTS[body];
    const T = (jd - J2000) / DAYS_PER_CENTURY;
    const a = at(el.a, T) * AU, e = at(el.e, T);
    let M = (at(el.L, T) - at(el.peri, T)) * DEG;
    M = Math.atan2(Math.sin(M), Math.cos(M));
    const E = solveKepler(M, e);
    return frame(el, T)(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E));
}

/** Position (km) and velocity (km/s); the velocity is a central difference of the position model. */
export function planetState(body, jd) {
    const h = 0.01;
    const ahead = position(body, jd + h), behind = position(body, jd - h);
    return { r: position(body, jd), v: ahead.map((c, i) => (c - behind[i]) / (2 * h * 86400)) };
}

/** The whole orbit at a given time, as n points (km), for drawing. */
export function orbitPath(body, jd, n = 160) {
    const el = ELEMENTS[body];
    const T = (jd - J2000) / DAYS_PER_CENTURY;
    const a = at(el.a, T) * AU, e = at(el.e, T), rot = frame(el, T), pts = [];
    for (let k = 0; k <= n; k++) {
        const E = (2 * Math.PI * k) / n;
        pts.push(rot(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)));
    }
    return pts;
}

/** Semi-major axis in AU (J2000 value). */
export const semiMajorAU = (body) => ELEMENTS[body].a[0];

/** Mean motion in radians per day (J2000 value). */
export const meanMotion = (body) => (ELEMENTS[body].L[1] * DEG) / DAYS_PER_CENTURY;

/** Mean longitude in radians at jd. */
export const meanLongitude = (body, jd) => at(ELEMENTS[body].L, (jd - J2000) / DAYS_PER_CENTURY) * DEG;

export const distanceKm = (a, b, jd) => {
    const p = position(a, jd), q = position(b, jd);
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

export const dateToJulianDate = (date) => date.getTime() / 86400000 + 2440587.5;
export const julianDateToDate = (jd) => new Date((jd - 2440587.5) * 86400000);
