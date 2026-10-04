// Internal tariff page (ops/): edit the coefficients, compare the three speed classes on any
// route, and copy the result as tariff.json for the repo. Edits are a preview kept in this
// browser only; the public page always reads the committed tariff.json.

import { BODIES, dateToJulianDate } from './ephemeris.js';
import { plan } from './transfer.js';
import { quote, loadTariff, isTariff, DEFAULT_TARIFF } from './tariff.js';
import { PORTS } from './strings.js';

const $ = (id) => document.getElementById(id);
const KEY = 'solar-port-tariff-preview';
const LIVE = new URL('../tariff.json', import.meta.url);
let live = DEFAULT_TARIFF, tariff = DEFAULT_TARIFF, from = 2, to = 3;
const clone = (o) => JSON.parse(JSON.stringify(o));
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(tariff)); } catch { /* private mode */ } };
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const ROWS = [['base', '起步价'], ['perDv', '每 (km/s)^n'], ['dvExp', 'Δv 指数 n'], ['perAU', '每飞行 1 AU'], ['perDay', '每在船 1 天'], ['round', '取整到']];
const CLASS = { eco: '经济', exp: '快线', torch: '急行' };

function form() {
    $('coefs').innerHTML = ROWS.map(([k, label]) => `<tr><td>${label}</td>
      <td><input data-g="passenger" data-k="${k}" type="number" step="any" value="${tariff.passenger[k]}" aria-label="乘客 ${label}"></td>
      <td><input data-g="freightPerKg" data-k="${k}" type="number" step="any" value="${tariff.freightPerKg[k]}" aria-label="货运 ${label}"></td></tr>`).join('');
    $('mults').innerHTML = Object.entries(CLASS).map(([c, label]) => `<label class="f"><span>${label} 系数</span>
      <input data-g="classMultiplier" data-k="${c}" type="number" step="0.05" value="${tariff.classMultiplier[c]}"></label>`).join('');
    $('tjson').value = JSON.stringify(tariff, null, 2);
}

function render() {
    const p = tariff.passenger;
    $('formula').innerHTML = `票价 = ( <em>${p.base}</em> + <em>${p.perDv}</em> × Δv<sup><em>${p.dvExp}</em></sup> + <em>${p.perAU}</em> × 飞行距离 AU + <em>${p.perDay}</em> × 航程天数 ) × 舱等系数`;
    if (from === to) { $('breakdown').innerHTML = ''; $('opsNote').textContent = '出发地和目的地相同。'; return; }
    const jd = dateToJulianDate(new Date());
    const qs = Object.keys(CLASS).map((c) => { const t = plan(BODIES[from], BODIES[to], jd, c); return { t, q: quote(tariff, t), was: quote(live, t) }; });
    const row = (label, f) => `<tr><td>${label}</td>${qs.map(f).join('')}</tr>`;
    $('breakdown').innerHTML = `<tr><th></th>${Object.values(CLASS).map((c) => `<th>${c}</th>`).join('')}</tr>`
      + row('航程 · 天', ({ t }) => `<td>${Math.round(t.tof)}</td>`)
      + row('Δv · km/s', ({ t }) => `<td>${t.dv.toFixed(1)}</td>`)
      + row('飞行距离 · AU', ({ q }) => `<td>${q.au.toFixed(2)}</td>`)
      + row('起步价', ({ q }) => `<td>${fmt(q.base)}</td>`)
      + row('Δv 部分', ({ q }) => `<td>${fmt(q.dv)}</td>`)
      + row('里程部分', ({ q }) => `<td>${fmt(q.dist)}</td>`)
      + row('时间部分', ({ q }) => `<td>${fmt(q.day)}</td>`)
      + row('× 舱等', ({ q }) => `<td>× ${q.multiplier}</td>`)
      + `<tr class="total"><td>票价 ${tariff.currency}</td>${qs.map(({ q }) => `<td>${fmt(q.total)}</td>`).join('')}</tr>`
      + row('线上版本', ({ was }) => `<td>${fmt(was.total)}</td>`)
      + row('每公斤运费', ({ t }) => `<td>${fmt(quote(tariff, t, 'freightPerKg').total)}</td>`);
    $('opsNote').textContent = `${PORTS[from].cn[0]} → ${PORTS[to].cn[0]}，从今天起搜索。“线上版本”是仓库里 tariff.json 的报价。`;
}

function selects() {
    for (const [id, v] of [['opsFrom', from], ['opsTo', to]]) {
        $(id).innerHTML = PORTS.map((p, i) => `<option value="${i}">${p.cn[0]} · ${p.cn[1]}</option>`).join('');
        $(id).value = v;
    }
}

document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.dataset.g) return;
    const v = parseFloat(el.value);
    if (!Number.isFinite(v)) return;
    tariff[el.dataset.g][el.dataset.k] = v;
    save(); $('tjson').value = JSON.stringify(tariff, null, 2); render();
});
$('opsFrom').onchange = (e) => { from = +e.target.value; render(); };
$('opsTo').onchange = (e) => { to = +e.target.value; render(); };
$('tLive').onclick = () => { tariff = clone(live); save(); form(); render(); };
$('tApply').onclick = () => {
    try {
        const t = JSON.parse($('tjson').value);
        if (!isTariff(t)) throw new Error('shape');
        tariff = t; save(); form(); render();
    } catch { $('opsNote').textContent = 'JSON 读不出来，检查一下逗号、引号和字段名。'; }
};
$('tCopy').onclick = async () => {
    const text = `${JSON.stringify(tariff, null, 2)}\n`;
    try { await navigator.clipboard.writeText(text); $('opsNote').textContent = '已复制。把它粘贴到仓库的 tariff.json 并提交，星港就会用新运价。'; }
    catch { $('tjson').select(); }
};

selects();
live = await loadTariff(LIVE);
let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* none */ }
tariff = isTariff(saved) ? saved : clone(live);
form();
render();
