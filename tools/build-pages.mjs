// Writes index.html (Chinese), en/index.html (English) and ops/index.html from one template,
// with the words from js/strings.js baked in so the page reads right before the script runs.
// Run after changing the template or the strings:  node tools/build-pages.mjs
// `npm test` fails if the committed pages are out of date.

import fs from 'node:fs';
import { TEXT } from '../js/strings.js';

const SITE = 'https://interimm.org/solar-port/';
const KIT = 'https://interimm.org/kit';
export const VERSION = '20261004b';

const head = ({ lang, title, description, root, canonical, extra = '' }) => `<!doctype html>
<html lang="${lang === 'cn' ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8">
<script>document.documentElement.classList.add("js");(function(m){if(m)document.documentElement.dataset.theme=m[1]})(document.cookie.match(/(?:^|; )interimm-theme=(light|dark)/))</script>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<meta name="description" content="${description}">
${extra}<link rel="icon" href="${root}assets/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="${root}assets/favicon-192x192.png" sizes="192x192">
<link rel="apple-touch-icon" href="${root}assets/apple-touch-icon.png">
<!-- Shared InterImm look (colours, fonts, header, footer, toolkit), served by interimm.org. See
     https://github.com/InterImm/interimm.github.io/blob/hugo/kit/README.md -->
<link rel="stylesheet" href="${KIT}/interimm.css?v=${VERSION}">
<link rel="stylesheet" href="${root}css/port.css?v=${VERSION}">
<script src="${KIT}/interimm.js?v=${VERSION}" defer></script>
`;

const header = (lang, T, root) => `<a class="skip-link" href="#main">${T.skip}</a>

<!-- Header: replaced with the live interimm.org menu by the kit script; this markup is the fallback.
     data-toolkit adds the floating toolkit button; js/portal.js adds this page's tools to its panel. -->
<header class="site-header" data-interimm-header data-lang="${lang}" data-current="archives" data-no-signal data-toolkit data-lang-cn="${SITE}" data-lang-en="${SITE}en/">
  <div class="wrap header-inner">
    <a class="brand" href="https://interimm.org/${lang === 'cn' ? '' : 'en/'}">
      <img class="brand-mark" src="${root}assets/favicon-96x96.png" alt="" width="32" height="32">
      <span class="brand-name">${T.org}</span>
    </a>
  </div>
</header>`;

const footer = (lang) => `<!-- Footer: replaced with the live interimm.org footer by the kit script; this markup is the fallback. -->
<footer class="site-footer" data-interimm-footer>
  <div class="wrap"><p>${lang === 'cn' ? '星际移民中心' : 'Interplanetary Immigration Center'} · <a href="https://github.com/InterImm/solar-port">${lang === 'cn' ? '源代码' : 'Source'}</a></p></div>
</footer>`;

function portal(lang) {
    const T = TEXT[lang], root = lang === 'cn' ? '' : '../';
    const t = (k) => `data-t="${k}">${T[k]}`;
    return `${head({ lang, root, title: lang === 'cn' ? '太阳系星港 | 星际移民中心' : 'Solar Port | InterImm',
        description: T.lede, canonical: SITE,
        extra: `<link rel="canonical" href="${SITE}${lang === 'cn' ? '' : 'en/'}">
<link rel="alternate" hreflang="zh-CN" href="${SITE}">
<link rel="alternate" hreflang="en" href="${SITE}en/">
` })}<script type="module" src="${root}js/portal.js?v=${VERSION}"></script>
</head>
<body>
${header(lang, T, root)}

<main id="main" class="wrap port">
  <section class="intro" id="top">
    <p class="kicker" ${t('eyebrow')}</p>
    <h1 ${t('h1')}</h1>
    <p class="lede" ${t('lede')}</p>
  </section>

  <div class="grid">
    <section class="panel sky" id="sky-panel" aria-labelledby="sky-title">
      <div class="panel-head">
        <h2 id="sky-title" ${t('sky')}</h2>
        <div class="seg push" role="group">
          <button type="button" id="scaleC" aria-pressed="true" ${t('compressed')}</button>
          <button type="button" id="scaleR" aria-pressed="false" ${t('trueScale')}</button>
        </div>
        <div class="seg" role="group">
          <button type="button" id="v3" aria-pressed="true">3D</button>
          <button type="button" id="v2" aria-pressed="false">2D</button>
        </div>
      </div>
      <div class="sky-box">
        <canvas id="sky" role="img" aria-label="${T.sky}"></canvas>
        <p class="legend" ${t('legend')}</p>
      </div>
      <div class="timebar">
        <button class="chip-btn" id="play" type="button" ${t('play')}</button>
        <input type="range" id="scrub" min="-730" max="1460" value="0" step="1" aria-label="${T.story}">
        <p class="dates"><span id="dStory"></span><small id="dReal"></small></p>
      </div>
    </section>

    <section class="panel desk" id="desk" aria-labelledby="desk-title">
      <div class="panel-head"><h2 id="desk-title" ${t('desk')}</h2></div>
      <form id="q" onsubmit="return false">
        <div class="route">
          <label class="f"><span ${t('from')}</span><select id="from"></select></label>
          <button type="button" class="swap" id="swap" aria-label="${T.swap}" title="${T.swap}">⇄</button>
          <label class="f"><span ${t('to')}</span><select id="to"></select></label>
        </div>
        <div class="kind" role="radiogroup">
          <label><input type="radio" name="kind" value="pax" checked><span ${t('pax')}</span></label>
          <label><input type="radio" name="kind" value="cargo"><span ${t('cargo')}</span></label>
          <label><input type="radio" name="kind" value="msg"><span ${t('msg')}</span></label>
        </div>
        <div class="f" id="speedBox"><span ${t('speed')}</span><div class="speed" id="speed"></div></div>
        <label class="f" id="massBox" hidden><span ${t('mass')}</span><input type="number" id="mass" value="1200" min="1" inputmode="numeric"></label>
      </form>
      <div class="result">
        <dl class="kv" id="kv"></dl>
        <p class="note" id="why"></p>
        <label class="f"><span ${t('name')}</span><input type="text" id="name" maxlength="40" autocomplete="name" placeholder="${T.namePh}"></label>
        <div class="row">
          <button class="btn btn-primary" type="button" id="book" ${t('book')}</button>
          <button class="btn" type="button" id="ping" ${t('ping')}</button>
        </div>
      </div>
      <div class="arrival" id="arrival"></div>
    </section>
  </div>

  <div class="lower">
    <section class="panel" id="departures" aria-labelledby="board-title">
      <div class="panel-head"><h2 id="board-title" ${t('board')}</h2><span class="push note" ${t('boardNote')}</span></div>
      <div class="board-wrap"><table class="board">
        <thead><tr><th ${t('flight')}</th><th ${t('ship')}</th><th ${t('route')}</th><th ${t('departs')}</th><th ${t('duration')}</th><th ${t('state')}</th></tr></thead>
        <tbody id="board"></tbody>
      </table></div>
    </section>
    <section class="panel" id="inflight" aria-labelledby="ships-title">
      <div class="panel-head"><h2 id="ships-title" ${t('inflight')}</h2></div>
      <div class="ships" id="ships"></div>
    </section>
  </div>
</main>

<nav hidden data-toolkit-links data-toolkit-title="${T.toc}">
  <a href="#sky-panel">${T.sky}</a><a href="#desk">${T.desk}</a><a href="#departures">${T.board}</a><a href="#inflight">${T.inflight}</a>
</nav>

<dialog id="dlg" aria-label="${T.pass}">
  <div class="pass" id="pass"></div>
  <div class="pass-actions">
    <button class="btn" type="button" id="copy" ${t('copy')}</button>
    <button class="btn btn-primary" type="button" id="close" ${t('close')}</button>
  </div>
</dialog>
<p class="toast" id="toast" role="status" hidden></p>

${footer(lang)}
</body>
</html>
`;
}

function ops() {
    const root = '../';
    return `${head({ lang: 'cn', root, title: '运价与计算说明 | 太阳系星港', description: '内部页面',
        extra: '<meta name="robots" content="noindex, nofollow">\n' })}<script type="module" src="${root}js/ops.js?v=${VERSION}"></script>
</head>
<body>
${header('cn', TEXT.cn, root)}

<main id="main" class="wrap port ops">
  <section class="intro">
    <p class="kicker">内部 · 不对外链接 · Internal, not linked</p>
    <h1>运价与计算说明</h1>
    <p class="lede">给运营者看的页面：调整运价系数、对比三个速度等级，并核对星港上每个数字是怎么来的。这里的改动只在你的浏览器里预览；要上线，把 tariff.json 复制到仓库里提交。</p>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>运价规则 · Tariff</h2>
      <label class="push f inline"><span>航线</span><select id="opsFrom"></select></label>
      <label class="f inline"><span>→</span><select id="opsTo"></select></label>
    </div>
    <div class="tariff-body">
      <div>
        <p class="formula" id="formula"></p>
        <table class="coef">
          <thead><tr><th>系数</th><th>乘客</th><th>货运 / 公斤</th></tr></thead>
          <tbody id="coefs"></tbody>
        </table>
        <div class="mults" id="mults"></div>
      </div>
      <div>
        <table class="breakdown" id="breakdown"></table>
        <p class="note" id="opsNote"></p>
        <div class="row">
          <button class="btn" type="button" id="tCopy">复制 tariff.json</button>
          <button class="btn" type="button" id="tLive">载入线上版本</button>
          <button class="btn" type="button" id="tApply">应用下方 JSON</button>
        </div>
        <textarea id="tjson" spellcheck="false" aria-label="tariff.json"></textarea>
      </div>
    </div>
  </section>

  <section class="panel methods">
    <div class="panel-head"><h2>每个数字怎么来的 · Method</h2></div>
    <div class="methods-body">
      <div>
        <h3>计算得出</h3>
        <ul>
          <li><b>行星位置</b>：JPL 近似轨道根数（Standish 表 1，1800–2050 年有效），三维，黄道 J2000。地球和火星与星际物流项目同一套代码，并有 JPL Horizons 数据的测试。谷神星用取整的根数，只作布景。</li>
          <li><b>距离和信号延时</b>：两颗行星的直线距离除以光速。</li>
          <li><b>发射窗口、航程、Δv</b>：用星际物流项目的兰伯特求解器（Izzo 方法）在出发日期和航程上搜索最省 Δv 的转移。经济：航程为霍曼时间的 0.8–1.1 倍，一个会合周期内出发；快线：0.45–0.6 倍，120 天内出发；急行：0.22–0.32 倍，42 天内出发。</li>
          <li><b>飞行距离</b>：沿转移轨道的实际路径长度。</li>
          <li><b>火星协调时和火星日</b>：Mars24 公式，与火星时钟项目一致。</li>
          <li><b>出发航班和在途飞船</b>：按霍曼转移的窗口推算，所以每个人看到同一张时刻表。</li>
          <li><b>火星开放设施</b>：直接读取 interimm.org/mars-open-facilities 的实时数据。</li>
        </ul>
      </div>
      <div>
        <h3>简化</h3>
        <ul>
          <li>Δv 是日心 Δv：离开出发行星轨道和并入目的行星轨道的速度变化之和，不含起飞和降落，那取决于港口而不是航线。</li>
          <li>故事日期 = 现实日期 + 70,491 天。星图画的是现实中此刻的天空，因为轨道根数只在 2050 年前准确。</li>
          <li>只算单圈、顺行、脉冲点火，不算借力飞行。</li>
        </ul>
        <h3>设定（虚构）</h3>
        <ul>
          <li>港口名称和代码、飞船名、航班号、甲板和舱房、印章。</li>
          <li>运价公式的系数（上面这张表）。</li>
          <li>货币 MC：按脉冲星时间发行，每个纪元向每位登记居民发放同样数额，没有挖矿和印钞；每颗行星有自己的账本，跨行星转账在发出端锁定、凭光速传来的证明在接收端释放。票款按普通转账结算。</li>
        </ul>
      </div>
    </div>
  </section>
</main>

${footer('cn')}
</body>
</html>
`;
}

export const PAGES = { 'index.html': portal('cn'), 'en/index.html': portal('en'), 'ops/index.html': ops() };

if (import.meta.url === `file://${process.argv[1]}`) {
    const root = new URL('../', import.meta.url);
    for (const [path, html] of Object.entries(PAGES)) fs.writeFileSync(new URL(path, root), html);
    console.log(`wrote ${Object.keys(PAGES).join(', ')}`);
}
