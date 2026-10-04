import test from 'node:test';
import assert from 'node:assert/strict';
import { plan, hohmann, transferPath, pathAU } from '../js/transfer.js';
import { AU, position } from '../js/ephemeris.js';
import { norm, sub } from './helpers.js';

const JD = 2461317.5; // 2026-10-04

test('Hohmann Earth to Mars: about 259 days and 5.6 km/s', () => {
    const h = hohmann('earth', 'mars', JD);
    assert.ok(Math.abs(h.tof - 259) < 2, `${h.tof}`);
    assert.ok(Math.abs(h.dv - 5.6) < 0.1, `${h.dv}`);
    assert.ok(Math.abs(h.syn - 780) < 5, `${h.syn}`);
});

test('the 2026 Earth to Mars window opens in late 2026', () => {
    const t = plan('earth', 'mars', JD, 'eco');
    const dep = new Date((t.depJD - 2440587.5) * 864e5);
    assert.ok(dep > new Date('2026-10-04') && dep < new Date('2027-01-15'), dep.toISOString());
    assert.ok(t.dv > 5 && t.dv < 7, `${t.dv}`);
});

test('faster classes fly shorter and cost more delta-v, on several routes', () => {
    for (const [a, b] of [['earth', 'mars'], ['mars', 'earth'], ['earth', 'venus'], ['earth', 'jupiter'], ['mars', 'ceres']]) {
        const [eco, exp, torch] = ['eco', 'exp', 'torch'].map((c) => plan(a, b, JD, c));
        assert.ok(eco.tof > exp.tof && exp.tof > torch.tof, `${a}-${b} tof`);
        assert.ok(eco.dv < exp.dv && exp.dv < torch.dv, `${a}-${b} dv ${eco.dv} ${exp.dv} ${torch.dv}`);
        assert.ok(exp.wait <= 120.01 && torch.wait <= 42.01, `${a}-${b} wait`);
    }
});

test('the drawn path starts at the origin and ends at the destination', () => {
    for (const c of ['eco', 'exp', 'torch']) {
        const t = plan('earth', 'mars', JD, c), pts = transferPath(t);
        assert.ok(norm(sub(pts[0], position('earth', t.depJD))) / AU < 1e-6);
        assert.ok(norm(sub(pts.at(-1), position('mars', t.depJD + t.tof))) / AU < 1e-3, c);
        assert.ok(pathAU(t) > 1.5 && pathAU(t) < 5, `${pathAU(t)}`);
    }
});
