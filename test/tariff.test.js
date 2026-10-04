import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { quote, isTariff, DEFAULT_TARIFF } from '../js/tariff.js';

const tariff = JSON.parse(fs.readFileSync(new URL('../tariff.json', import.meta.url)));
const route = { cls: 'exp', dv: 10, tof: 100, path: 2 };

test('tariff.json is a complete tariff', () => assert.ok(isTariff(tariff)));

test('the price follows the formula', () => {
    const t = { ...DEFAULT_TARIFF, passenger: { base: 1000, perDv: 10, dvExp: 2, perAU: 100, perDay: 1, round: 1 } };
    const q = quote(t, route);
    assert.equal(q.subtotal, 1000 + 10 * 100 + 100 * 2 + 100);
    assert.equal(q.total, Math.round(2300 * t.classMultiplier.exp));
});

test('freight scales with mass', () => {
    const one = quote(tariff, route, 'freightPerKg', 1).total, ton = quote(tariff, route, 'freightPerKg', 1000).total;
    assert.ok(Math.abs(ton - one * 1000) <= 1000 * 0.5 + 1);
});

test('broken tariffs are rejected', () => {
    assert.equal(isTariff({}), false);
    assert.equal(isTariff({ ...tariff, classMultiplier: { eco: 1 } }), false);
});
