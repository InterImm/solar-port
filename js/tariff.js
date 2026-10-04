// Prices. One formula for every route, with its coefficients in tariff.json:
//   price = (base + perDv * dv^dvExp + perAU * AU flown + perDay * days aboard) * class multiplier
// Passenger fares use `passenger`; freight uses `freightPerKg` times the mass in kg.

import { pathAU } from './transfer.js';

export const DEFAULT_TARIFF = {
    currency: 'CR',
    passenger: { base: 20000, perDv: 6000, dvExp: 2, perAU: 15000, perDay: 150, round: 100 },
    freightPerKg: { base: 2, perDv: 0.9, dvExp: 2, perAU: 0.5, perDay: 0, round: 1 },
    classMultiplier: { eco: 1, exp: 1.1, torch: 1.25 },
};

export function isTariff(t) {
    const ok = (g) => g && ['base', 'perDv', 'dvExp', 'perAU', 'perDay'].every((k) => Number.isFinite(g[k]));
    return !!(t && ok(t.passenger) && ok(t.freightPerKg) && t.classMultiplier
        && ['eco', 'exp', 'torch'].every((c) => Number.isFinite(t.classMultiplier[c])));
}

/** Price breakdown for a transfer from transfer.plan(). */
export function quote(tariff, t, who = 'passenger', mass = 1) {
    const g = tariff[who], m = tariff.classMultiplier[t.cls] ?? 1, au = pathAU(t);
    const parts = { base: g.base, dv: g.perDv * Math.pow(t.dv, g.dvExp), dist: g.perAU * au, day: g.perDay * t.tof };
    const sub = parts.base + parts.dv + parts.dist + parts.day;
    const r = g.round || 1;
    return { ...parts, au, multiplier: m, mass, subtotal: sub, total: Math.round((sub * m * mass) / r) * r };
}

/** Load tariff.json next to the page; fall back to the defaults. */
export async function loadTariff(url) {
    try {
        const r = await fetch(url, { cache: 'no-cache' });
        const t = await r.json();
        return isTariff(t) ? t : DEFAULT_TARIFF;
    } catch {
        return DEFAULT_TARIFF;
    }
}
