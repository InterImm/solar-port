import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAGES } from '../tools/build-pages.mjs';

test('the committed pages match tools/build-pages.mjs (run it after editing)', () => {
    for (const [path, html] of Object.entries(PAGES)) {
        assert.equal(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), html, path);
    }
});

test('the public pages never link the ops page', () => {
    for (const path of ['index.html', 'en/index.html']) assert.ok(!PAGES[path].includes('ops'), path);
    assert.ok(PAGES['ops/index.html'].includes('noindex'));
});
