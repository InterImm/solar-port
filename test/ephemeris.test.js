import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { planetState, position, BODIES, AU, distanceKm } from '../js/ephemeris.js';
import { norm, sub } from './helpers.js';

const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/jpl_horizons.json', import.meta.url)));

test('Earth and Mars agree with JPL Horizons over 2026-2034', () => {
    // Same limits as InterImm/interplanetary-logistics, which uses the same model.
    const limits = { earth: { km: 25000, ms: 4 }, mars: { km: 80000, ms: 8 } };
    for (const body of ['earth', 'mars']) {
        for (const ref of fx[body]) {
            const s = planetState(body, ref.jd);
            assert.ok(norm(sub(s.r, ref.r)) < limits[body].km, `${body} JD ${ref.jd} position`);
            assert.ok(norm(sub(s.v, ref.v)) * 1000 < limits[body].ms, `${body} JD ${ref.jd} velocity`);
        }
    }
});

test('every body sits at a sensible distance from the Sun', () => {
    const expect = { mercury: [0.30, 0.47], venus: [0.71, 0.73], earth: [0.98, 1.02], mars: [1.38, 1.67], ceres: [2.5, 3.0],
        jupiter: [4.9, 5.5], saturn: [9.0, 10.1], uranus: [18.2, 20.1], neptune: [29.7, 30.4] };
    for (let jd = 2451545; jd < 2451545 + 365.25 * 50; jd += 397) {
        for (const b of BODIES) {
            const r = norm(position(b, jd)) / AU;
            assert.ok(r > expect[b][0] && r < expect[b][1], `${b} at JD ${jd}: ${r.toFixed(3)} AU`);
        }
    }
});

test('Earth-Mars light delay stays between about 3 and 22 minutes', () => {
    for (let jd = 2461000; jd < 2461000 + 800; jd += 10) {
        const min = distanceKm('earth', 'mars', jd) / 299792.458 / 60;
        assert.ok(min > 3 && min < 22.5, `${min} min`);
    }
});
