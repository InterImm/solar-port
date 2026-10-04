# 太阳系星港 · Solar Port

The Interplanetary Immigration Center's port for the whole solar system, live at
<https://interimm.org/solar-port/> (English: <https://interimm.org/solar-port/en/>).

- **Sky**: every planet (and Ceres) where it is right now, from JPL's approximate orbital elements.
  Drag to turn, switch between compressed and true scale, scrub or fast-forward time.
- **Trip inquiry**: pick two ports for the next launch window, flight time, Δv, distance flown, fare or
  freight cost and signal delay, in three speed classes (Economy, Express, Torch).
- **Boarding pass** with a share link, and passport stamps kept in the visitor's browser.
- **Departures board** and **ships in flight**, worked out from launch windows so every visitor sees the same timetable.
- **Arrival desk** for Mars: Mars time and live status from [Mars Open Facilities](https://interimm.org/mars-open-facilities/).
- The kit's floating **toolkit** button, with this page's extra tools: back to now, copy route link, stamps and a
  real-date to story-date converter.

Story dates are real dates plus 70,491 days (2026 → 2219). Everything runs in the browser; there is no server.

## Prices

All prices come from one formula with its coefficients in [`tariff.json`](tariff.json):

```
price = (base + perDv × Δv^dvExp + perAU × AU flown + perDay × days aboard) × class multiplier
```

`passenger` prices a ticket; `freightPerKg` prices one kilogram of cargo. To change prices, edit `tariff.json`
and push. The internal page `ops/` (not linked from the site, `noindex`) lets you try coefficients, compares the
three classes on any route against the live file, explains where every number comes from, and copies a new
`tariff.json` to paste in. It is unlisted, not secret: anyone with the address can open it.

## Files

| Path | What |
| --- | --- |
| `js/ephemeris.js` | Planet positions (Standish Table 1, 1800-2050), extended from Interplanetary Logistics' Earth and Mars |
| `js/lambert.js` | Lambert solver (Izzo), copied unchanged from [InterImm/interplanetary-logistics](https://github.com/InterImm/interplanetary-logistics) |
| `js/transfer.js` | Hohmann estimate for the board, Lambert search per speed class, transfer path |
| `js/tariff.js` | The price formula |
| `js/orrery.js` | The sky canvas |
| `js/portal.js`, `js/ops.js` | The public page and the internal page |
| `js/strings.js` | Every word, Chinese and English; ports and ships |
| `tools/build-pages.mjs` | Writes `index.html`, `en/index.html` and `ops/index.html` from one template |
| `css/port.css` | Styles this page adds to the shared [InterImm kit](https://github.com/InterImm/interimm.github.io/blob/hugo/kit/README.md) |

## Develop

```bash
npm test                    # Node 22+, no dependencies
node tools/build-pages.mjs  # after editing the template or strings
python3 -m http.server 8000 # then open http://localhost:8000
```

The header, footer, fonts and toolkit come from interimm.org/kit, so a local copy needs the internet to look right.
Pushing to `main` runs the tests and publishes to GitHub Pages (Settings → Pages → Source: GitHub Actions).
