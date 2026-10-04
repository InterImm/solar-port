// Solar Port page: the sky, the trip inquiry, the departures board, ships in flight,
// the boarding pass and the extra tools in the kit's floating toolkit.

import { AU, BODIES, LIGHT_KMS, position, distanceKm, dateToJulianDate } from './ephemeris.js';
import { hohmann, plan, leg, transferPath, pathAU } from './transfer.js';
import { quote, loadTariff, DEFAULT_TARIFF } from './tariff.js';
import { createOrrery } from './orrery.js';
import { PORTS, SHIPS, TEXT } from './strings.js';

const lang = document.documentElement.lang.startsWith('zh') ? 'cn' : 'en';
const T = TEXT[lang];
const STORY_DAYS = 70491; // InterImm story time runs this many days ahead of real time (2026 -> 2219)
const FACILITIES = 'https://interimm.org/mars-open-facilities/';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

document.querySelectorAll('[data-t]').forEach((el) => { if (T[el.dataset.t]) el.textContent = T[el.dataset.t]; });

// ---------- time ----------
const nowJD = () => dateToJulianDate(new Date());
let offset = 0, playing = false;
const jd = () => nowJD() + offset;
const isoDay = (j, story) => new Date((j - 2440587.5 + (story ? STORY_DAYS : 0)) * 86400000).toISOString().slice(0, 10);
const msd = (j) => (j + 69.184 / 86400 - 2405522.0028779) / 1.0274912517;
const mtc = (j) => { const h = (msd(j) % 1) * 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; };
const lagMin = (a, b, j) => distanceKm(BODIES[a], BODIES[b], j) / LIGHT_KMS / 60;
const money = (n, cur) => `${Math.round(n).toLocaleString('en-US')} ${cur}`;
const name = (i) => PORTS[i][lang][0];
const port = (i) => PORTS[i][lang][1];
const shipName = (k) => SHIPS[k % SHIPS.length][lang === 'cn' ? 0 : 1];
const codeIndex = (c) => PORTS.findIndex((p) => p.code === c);

// ---------- state ----------
const params = new URLSearchParams(location.search);
let from = Math.max(0, codeIndex(params.get('from') ?? 'E-SH'));
let to = codeIndex(params.get('to') ?? 'M-HZ'); if (to < 0) to = 3;
let speed = ['eco', 'exp', 'torch'].includes(params.get('class')) ? params.get('class') : 'eco';
let kind = 'pax';
let tariff = DEFAULT_TARIFF;

const sky = createOrrery($('sky'), { names: (i) => name(i), onPick: (i) => {
    if (i === from) return;
    if (i === to) setRoute(to, from); else setRoute(from, i);
} });

// ---------- departures board and ships in flight (Hohmann schedule) ----------
const ROUTES = [[2, 3], [3, 2], [2, 1], [3, 4], [2, 5], [4, 3], [3, 5], [2, 6], [5, 6]];
const flightNo = (i, j) => `IM${100 + i * 10 + j}`;
function shipsInFlight(j) {
    const out = [];
    ROUTES.forEach(([a, b]) => {
        const h = hohmann(BODIES[a], BODIES[b], j - 3000);
        let dep = h.depJD;
        while (dep + h.syn < j) dep += h.syn;
        if (dep < j && dep + h.tof > j) out.push({ a, b, dep, tof: h.tof, f: (j - dep) / h.tof });
    });
    return out;
}
let fleet = [];
function buildFleet() {
    const j0 = nowJD();
    fleet = shipsInFlight(j0).map((s) => {
        const t = leg(BODIES[s.a], BODIES[s.b], s.dep, s.tof);
        return { ...s, path: t ? transferPath(t, 120) : null };
    });
}
function renderBoard(animate) {
    const j = jd();
    const rows = ROUTES.slice().sort((x, y) => (y[0] === from) - (x[0] === from)).slice(0, 7)
        .map(([a, b]) => ({ a, b, h: hohmann(BODIES[a], BODIES[b], j) })).sort((x, y) => x.h.wait - y.h.wait);
    $('board').innerHTML = rows.map(({ a, b, h }, n) => {
        const st = h.wait < 1 ? ['boarding', 'hot'] : h.wait < 60 ? ['ontime', 'ok'] : ['waiting', 'warn'];
        return `<tr data-a="${a}" data-b="${b}" class="${a === from && b === to ? 'sel' : ''}">
          <td><span class="${animate ? 'flip' : ''}" style="animation-delay:${n * 60}ms">${flightNo(a, b)}</span></td><td>${esc(shipName(a * 3 + b))}</td>
          <td>${PORTS[a].code} → ${esc(port(b))}</td><td>${isoDay(h.depJD, true)}</td><td>${Math.round(h.tof)} ${T.days}</td>
          <td><span class="pill ${st[1]}">${T[st[0]]}</span></td></tr>`;
    }).join('');
    const live = fleet.map((s) => ({ ...s, f: Math.min(1, Math.max(0, (j - s.dep) / s.tof)) }));
    $('ships').innerHTML = live.map((s) => `<button type="button" class="ship" data-a="${s.a}" data-b="${s.b}">
        <b>${esc(shipName(s.a * 3 + s.b))}</b><span class="m">${PORTS[s.a].code} → ${PORTS[s.b].code}</span>
        <span class="note">${esc(name(s.a))} → ${esc(port(s.b))}</span><span class="m">${Math.round(s.f * 100)}%</span>
        <span class="bar"><i style="width:${(s.f * 100).toFixed(1)}%"></i></span></button>`).join('');
    sky.state.ships = live.filter((s) => s.path && s.f > 0 && s.f < 1)
        .map((s) => ({ at: s.path[Math.min(s.path.length - 1, Math.round(s.f * (s.path.length - 1)))] }));
}

// ---------- inquiry ----------
function fillSelects() {
    for (const id of ['from', 'to']) {
        $(id).innerHTML = PORTS.map((p, i) => `<option value="${i}">${esc(name(i))} · ${esc(port(i))}</option>`).join('');
    }
    $('from').value = from; $('to').value = to;
}
function current() { return from === to ? null : plan(BODIES[from], BODIES[to], jd(), speed); }
function renderDesk() {
    const j = jd(), d = distanceKm(BODIES[from], BODIES[to], j);
    $('massBox').hidden = kind !== 'cargo';
    $('speedBox').hidden = kind === 'msg' || from === to;
    const rows = [[T.dist, `${(d / 1e6).toFixed(1)} ${T.mkm}`], [T.lag, `${(d / LIGHT_KMS / 60).toFixed(1)} ${T.min}`, kind === 'msg']];
    if (kind !== 'msg' && from !== to) {
        const all = ['eco', 'exp', 'torch'].map((c) => plan(BODIES[from], BODIES[to], j, c));
        $('speed').innerHTML = all.map((p) => `<button type="button" data-c="${p.cls}" aria-pressed="${p.cls === speed}">
            <b>${T[p.cls]}</b><small>${Math.round(p.tof)} ${T.days}</small><small>${money(quote(tariff, p).total, tariff.currency)}</small></button>`).join('');
        const t = current();
        rows.push([T.window, t.wait < 1 ? T.open : `${isoDay(t.depJD, true)} (${Math.round(t.wait)} ${T.days})`]);
        rows.push([T.tof, `${Math.round(t.tof)} ${T.days}`]);
        rows.push([T.dv, `${t.dv.toFixed(1)} km/s`]);
        rows.push([T.path, `${pathAU(t).toFixed(2)} AU`]);
        if (kind === 'pax') rows.push([T.fare, money(quote(tariff, t).total, tariff.currency), true]);
        else {
            const m = Math.max(1, parseFloat($('mass').value) || 0);
            rows.push([T.freight, money(quote(tariff, t, 'freightPerKg', m).total, tariff.currency), true]);
        }
    }
    $('kv').innerHTML = rows.map(([a, b, big]) => `<dt>${a}</dt><dd class="${big ? 'big' : ''}">${b}</dd>`).join('');
    $('why').textContent = from === to ? T.same : kind === 'msg' ? T.msgW : T[`${speed}W`];
    $('book').hidden = kind === 'msg' || from === to;
    renderArrival();
}

let facilities = null;
fetch(`${FACILITIES}data/index.json`, { cache: 'no-cache' }).then((r) => r.json()).then((d) => { facilities = d; renderArrival(); })
    .catch(() => { facilities = false; renderArrival(); });
function renderArrival() {
    const j = jd();
    let html = `<h3>${T.arrival} · ${esc(port(to))}</h3>`;
    if (to !== 3) { $('arrival').innerHTML = html + `<p class="note">${T.soon}</p>`; return; }
    html += `<p>${T.marsTime} <b class="mono">${mtc(j)}</b> · ${T.sol} <b class="mono">${Math.floor(msd(j)).toLocaleString('en-US')}</b></p>`;
    if (facilities) {
        const list = facilities.facilities.slice().sort((a, b) => (b.id === 'horizon-depot') - (a.id === 'horizon-depot')).slice(0, 4);
        html += `<ul class="fac">${list.map((f) => {
            const k = f.kpis && f.kpis[0], pct = k && k.design ? Math.round((k.value / k.design) * 100) : null;
            const tone = f.status === 'operating' ? 'ok' : f.status === 'offline' ? 'hot' : 'warn';
            return `<li><a href="${FACILITIES}#${esc(f.id)}">${esc(lang === 'cn' ? f.name_zh : f.name)}</a>
              <span class="pill ${tone}">${esc(T.status[f.status] || f.status)}${pct != null ? ` · ${pct}%` : ''}</span></li>`;
        }).join('')}</ul>`;
    } else if (facilities === false) html += `<p class="note">${T.noData}</p>`;
    const map = lang === 'cn' ? 'https://interimm.org/mars-map/' : 'https://interimm.org/mars-map/en/';
    html += `<p class="links"><a href="${FACILITIES}">${T.facLink}</a> · <a href="${map}">${T.mapLink}</a> · <a href="https://interimm.org/hub/">${T.hubLink}</a></p>`;
    $('arrival').innerHTML = html;
}

function renderTime() {
    const j = jd();
    $('dStory').textContent = `${T.story} ${isoDay(j, true)}`;
    $('dReal').textContent = `${T.real} ${isoDay(j, false)}`;
}
function renderSky() {
    const s = sky.state, t = current();
    s.jd = jd(); s.from = from; s.to = to;
    s.route = t && kind !== 'msg' ? transferPath(t) : null;
    sky.draw();
}
function renderAll(animate = true) { renderTime(); renderDesk(); renderBoard(animate); renderSky(); renderTools(); }

function routeLink(extra = {}) {
    const u = new URL(location.href);
    u.search = ''; u.hash = '';
    u.searchParams.set('from', PORTS[from].code); u.searchParams.set('to', PORTS[to].code); u.searchParams.set('class', speed);
    for (const [k, v] of Object.entries(extra)) if (v) u.searchParams.set(k, v);
    return u.toString();
}
function setRoute(a, b) {
    from = a; to = b; $('from').value = from; $('to').value = to;
    history.replaceState(null, '', routeLink());
    renderAll();
}

// ---------- boarding pass ----------
function seal(seed) { // a small square of ink dots, the same for the same flight
    const c = document.createElement('canvas'); c.width = c.height = 25; const g = c.getContext('2d');
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#17171a';
    g.fillStyle = ink; let s = seed >>> 0;
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; if ((s >>> 16) & 1) g.fillRect(x, y, 1, 1); }
    for (const [x, y] of [[0, 0], [18, 0], [0, 18]]) { g.clearRect(x, y, 7, 7); g.fillRect(x, y, 7, 7); g.clearRect(x + 1, y + 1, 5, 5); g.fillRect(x + 2, y + 2, 3, 3); }
    c.setAttribute('aria-hidden', 'true');
    return c;
}
function openPass(passengerName, collect = true) {
    const t = current(); if (!t) return;
    const seed = Math.floor(t.depJD) * 31 + from * 7 + to;
    const stamps = store.get('solar-port-stamps', []);
    if (collect && !stamps.includes(PORTS[to].code)) { stamps.push(PORTS[to].code); store.set('solar-port-stamps', stamps); }
    const deck = 'ABCDE'[seed % 5], who = passengerName || store.get('solar-port-name', '') || '—';
    const suffix = speed === 'eco' ? '' : speed === 'exp' ? 'X' : 'T';
    $('pass').innerHTML = `<div class="pass-main">
      <div class="pass-top"><span>${T.org}</span><span>${T.pass} · ${T[speed]}</span></div>
      <div class="pass-route"><div><div class="code">${PORTS[from].code}</div><small>${esc(name(from))} · ${esc(port(from))}</small></div>
        <svg class="arc" viewBox="0 0 90 34" aria-hidden="true"><path d="M4 30 Q45 -6 86 30" fill="none" stroke="currentColor" stroke-dasharray="4 4"/><circle cx="86" cy="30" r="3" fill="var(--accent)"/></svg>
        <div class="to"><div class="code">${PORTS[to].code}</div><small>${esc(name(to))} · ${esc(port(to))}</small></div></div>
      <div class="pass-grid">
        <div><span>${T.passenger}</span>${esc(who)}</div><div><span>${T.ship}</span>${esc(shipName(from * 3 + to))}</div>
        <div><span>${T.flight}</span>${flightNo(from, to)}${suffix}</div><div><span>${T.gate}</span>${'AB'[seed % 2]}${1 + (seed % 9)}</div>
        <div><span>${T.departs}</span>${isoDay(t.depJD, true)}</div><div><span>${T.arrives}</span>${isoDay(t.depJD + t.tof, true)}</div>
        <div><span>${T.deck}</span>${deck}</div><div><span>${T.room}</span>${deck}${10 + (seed % 40)}</div>
      </div>
      <p class="note">${T.fare} ${money(quote(tariff, t).total, tariff.currency)} · ${T.tof} ${Math.round(t.tof)} ${T.days} · ${T.lag} ${lagMin(from, to, t.depJD + t.tof).toFixed(1)} ${T.min}</p>
    </div>
    <div class="stub"><div class="pass-top"><span>${T.stamps} · ${stamps.length}</span></div><div id="sealBox"></div>
      <p class="note">${stamps.map((c) => esc(name(codeIndex(c)))).join(' · ')}</p>
      <div class="stamp">${esc(port(to))}<br>${isoDay(t.depJD + t.tof, true).slice(0, 7)}</div></div>`;
    $('sealBox').append(seal(seed));
    $('dlg').showModal();
    renderTools();
}
function toast(msg) {
    const el = $('toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
}
async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast(T.copied); } catch { toast(text); }
}

// ---------- extra tools in the kit's floating toolkit ----------
const tools = document.createElement('div');
tools.className = 'toolkit-tools port-tools';
tools.innerHTML = `<p class="tool-title">${T.tools}</p>
  <p class="tool-row"><span>${T.link}</span><b id="tkLink">–</b></p>
  <button class="tool-row" type="button" id="tkNow"><span>${T.now}</span><b id="tkNowV"></b></button>
  <button class="tool-row" type="button" id="tkShare"><span>${T.share}</span><b>${'↗'}</b></button>
  <button class="tool-row" type="button" id="tkStamps"><span>${T.myStamps}</span><b id="tkStampsV">0</b></button>
  <label class="tool-conv"><span>${T.conv}</span><input type="date" id="tkDate"></label>
  <p class="note" id="tkConv">${T.convNote}</p>`;
function renderTools() {
    const j = jd(), e = position('earth', j), m = position('mars', j);
    const sunAngle = Math.acos(Math.max(-1, Math.min(1, -(e[0] * (m[0] - e[0]) + e[1] * (m[1] - e[1]) + e[2] * (m[2] - e[2]))
        / (Math.hypot(...e) * distanceKm('earth', 'mars', j)))));
    const link = $('tkLink'); if (link) link.textContent = sunAngle < (3 * Math.PI) / 180 ? T.degraded : T.clear;
    const nowV = $('tkNowV'); if (nowV) nowV.textContent = offset ? isoDay(nowJD(), true) : '';
    const st = $('tkStampsV'); if (st) st.textContent = store.get('solar-port-stamps', []).length;
}
function mountTools() {
    const panel = document.querySelector('[data-interimm-toolkit] .toolkit-panel');
    if (!panel || panel.contains(tools)) return !!panel;
    const signal = panel.querySelector('.toolkit-signal');
    signal ? signal.after(tools) : panel.prepend(tools);
    $('tkNow').onclick = () => { offset = 0; $('scrub').value = 0; renderAll(); };
    $('tkShare').onclick = () => copy(routeLink());
    $('tkStamps').onclick = () => {
        const s = store.get('solar-port-stamps', []);
        toast(s.length ? s.map((c) => name(codeIndex(c))).join(' · ') : T.noStamps);
    };
    $('tkDate').onchange = (ev) => {
        const d = new Date(ev.target.value); if (Number.isNaN(+d)) return;
        const j = dateToJulianDate(d);
        $('tkConv').textContent = `${isoDay(j, true)} · ${T.sol} ${Math.floor(msd(j)).toLocaleString('en-US')}`;
    };
    renderTools();
    return true;
}
if (!mountTools()) {
    const mo = new MutationObserver(() => { if (mountTools()) mo.disconnect(); });
    mo.observe(document.body, { childList: true });
}

// ---------- events ----------
$('from').onchange = (e) => setRoute(+e.target.value, to);
$('to').onchange = (e) => setRoute(from, +e.target.value);
$('swap').onclick = () => setRoute(to, from);
document.querySelectorAll('input[name=kind]').forEach((r) => { r.onchange = () => { kind = r.value; renderDesk(); renderSky(); }; });
$('mass').oninput = renderDesk;
$('speed').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    speed = b.dataset.c; history.replaceState(null, '', routeLink()); renderDesk(); renderSky();
};
$('name').value = store.get('solar-port-name', '');
$('name').oninput = (e) => store.set('solar-port-name', e.target.value.slice(0, 40));
$('book').onclick = () => openPass($('name').value.trim());
$('close').onclick = () => $('dlg').close();
$('copy').onclick = () => copy(routeLink({ pass: '1', name: $('name').value.trim() }));
$('ping').onclick = () => {
    const lag = lagMin(from, to, jd());
    sky.sendPulse(from, to, 1500 + lag * 120);
    toast(`${T.sent}${lag.toFixed(1)} ${T.min}`);
};
$('board').onclick = (e) => { const r = e.target.closest('tr[data-a]'); if (r) setRoute(+r.dataset.a, +r.dataset.b); };
$('ships').onclick = (e) => { const r = e.target.closest('[data-a]'); if (r) setRoute(+r.dataset.a, +r.dataset.b); };
$('scrub').oninput = (e) => { offset = +e.target.value; renderAll(false); };
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? T.pause : T.play; };
const seg = (on, off) => { $(on).setAttribute('aria-pressed', 'true'); $(off).setAttribute('aria-pressed', 'false'); };
$('scaleC').onclick = () => { sky.state.trueScale = false; seg('scaleC', 'scaleR'); sky.draw(); };
$('scaleR').onclick = () => { sky.state.trueScale = true; seg('scaleR', 'scaleC'); sky.draw(); };
$('v3').onclick = () => { sky.state.flat = false; seg('v3', 'v2'); sky.draw(); };
$('v2').onclick = () => { sky.state.flat = true; seg('v2', 'v3'); sky.draw(); };
document.addEventListener('interimm:theme', () => sky.draw());
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => sky.draw());

// ---------- start ----------
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let last = performance.now(), acc = 0;
function tick(t) {
    const dt = t - last; last = t;
    if (playing) {
        offset += (dt / 1000) * 40;
        if (offset > 1460) offset = -730;
        $('scrub').value = Math.round(offset);
        acc += dt;
        if (acc > 300) { acc = 0; renderTime(); renderDesk(); renderBoard(false); renderTools(); }
        renderSky();
    } else if (sky.state.pulse) sky.draw();
    requestAnimationFrame(tick);
}
fillSelects();
buildFleet();
renderAll();
loadTariff(new URL('../tariff.json', import.meta.url)).then((t) => {
    tariff = t; renderDesk();
    if (params.get('pass') === '1') openPass(params.get('name') || '', false); // a shared pass: show it, no stamp
});
if (!reduce) requestAnimationFrame(tick);
else setInterval(() => { if (sky.state.pulse) sky.draw(); }, 100);
