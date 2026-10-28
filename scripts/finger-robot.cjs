// Max's way through a map: only real finger gestures on the screen (taps and
// drags), led by the hand of the on-screen hint, on an iPad held landscape.
// It goes to the map the way a child does (the Map button, the map's card),
// and when nobody is picked it presses "repeat" and taps whoever asks. It
// stops when the map is done, or when a station takes too many steps (stuck),
// or the hand points off screen too long (the camera did not bring it in), or
// no hint shows for too long (quiet) — with a screenshot of each.
//   npm run dev -- --port 5195   (another terminal)
//   node scripts/finger-robot.cjs <farm|city|factory> <outdir> [limit]
// Env: PORT (5195), JOURNEY=<dir> (a frame as each one asks and once it is
// done), PLAYWRIGHT (path to playwright-core), CHROME (browser executable).
// Prints one JSON line per helped station and a last line {end, errors}.
const PW = process.env.PLAYWRIGHT || '/Users/gusev/Documents/Landing/node_modules/playwright-core';
const { chromium } = require(PW);
const [mapName, out, limitArg] = process.argv.slice(2);
const LIMIT = Number(limitArg || 99);
const PORT = process.env.PORT || 5195;
const JOURNEY = process.env.JOURNEY || '';
const CHROME = process.env.CHROME || process.env.HOME + '/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/?quickhints&${mapName}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.getElementById('loader')?.classList.contains('is-done'), null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  // To the map the way a child goes: the Map button, then the map's card.
  await page.click('.map-btn', { force: true });
  await page.waitForTimeout(600);
  await page.click(`.map-card[data-map="${mapName}"]`, { force: true });
  await page.waitForFunction(() => !!window.__game.map, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const m = page.mouse;
  const drag = async (a, b, steps = 14) => {
    await m.move(a.x, a.y);
    await m.down();
    for (let i = 1; i <= steps; i++) await m.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    await m.up();
  };
  const tap = async (p) => {
    await m.move(p.x, p.y);
    await m.down();
    await page.waitForTimeout(60);
    await m.up();
  };
  const doneCount = () => page.evaluate(() => window.__game.map.needs.filter((x) => x.done).length);
  const rows = [];
  let row = null;
  let quiet = 0;
  // The factory's workers call only a while after the last station: its quiet stretches are longer.
  const QUIET = mapName === 'factory' ? 120 : 30;
  const t0 = Date.now();
  for (let step = 0; step < 1200 && Date.now() - t0 < 25 * 60 * 1000; step++) {
    const s = await page.evaluate(() => {
      const g = window.__game, mp = g.map, st = g.stage;
      if (!mp) return { gone: true };
      const P = (v) => { const p = st.project(v); return { x: p.x, y: p.y }; };
      const waiting = mp.needs.filter((n) => !n.done && mp.isNow(n));
      const cur = mp.helping ? mp.helping() : null;
      const out = { phase: mp.phase, done: mp.needs.filter((n) => n.done).length, total: mp.needs.length, waiting: waiting.length, cur: cur && cur.critter.name };
      const h = g.hint;
      if (!h) return out;
      out.h = { type: h.type, phrase: h.phrase };
      if (h.type === 'drag') {
        const grp = g.GROUPS.find((gr) => gr.items.some((i) => i.kind === h.kind));
        out.h.kind = h.kind;
        out.h.group = grp.id;
        out.h.name = grp.items.find((i) => i.kind === h.kind).name;
        out.h.to = P(h.to.clone().setY(0.2));
      } else if (h.type === 'connect') {
        out.h.from = P(h.from.post.getWorldPosition(h.from.post.position.clone()));
        out.h.to = P(h.to.post.getWorldPosition(h.to.post.position.clone()));
      } else if (h.type === 'tap') {
        out.h.kind = h.part.kind;
        out.h.at = P(h.local ? h.part.root.localToWorld(h.local.clone()) : h.part.root.position.clone().setY(0.45));
        if (h.phrase === 'twoHands') out.h.both = [0, 1].map((i) => P(h.part.root.localToWorld(h.part.buttonPoint(i))));
      } else if (h.type === 'tapWire') {
        // Where the hand points: the dot on the wire itself.
        out.h.at = P(h.wire.pointAt(h.u ?? 0.5));
      }
      return out;
    });
    if (s.gone) break;
    if (!row || row.done !== s.done) {
      if (row && JOURNEY) {
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${JOURNEY}/${mapName}-${String(row.done).padStart(2, '0')}-b-done.png` });
      }
      if (row) rows.push(row);
      row = { phase: s.phase, done: s.done, cur: s.cur, steps: [], t: Date.now() };
      quiet = 0;
      if (s.done >= LIMIT) break;
    }
    if (s.done === s.total) break;
    if (!s.h) {
      // Nobody picked: "repeat" brings the nearest one asking into view, then a tap on them.
      if (!s.cur && s.waiting > 1) {
        await page.click('.mission .speak', { force: true });
        await page.waitForTimeout(2200);
        const at = await page.evaluate(() => {
          const mp = window.__game.map; const n = mp.focused ?? mp.current(); if (!n) return null;
          const c = n.critter; const p = window.__game.stage.project(c.group.position.clone().setY((c.base ?? 0) + c.height * 0.5)); return { x: p.x, y: p.y, name: c.name };
        });
        if (at) { await tap(at); row.steps.push('tap ' + at.name); }
        await page.waitForTimeout(1500);
        if (JOURNEY) await page.screenshot({ path: `${JOURNEY}/${mapName}-${String(row.done).padStart(2, '0')}-a-asks-${at ? at.name : 'none'}.png` });
      } else {
        if (++quiet === QUIET) {
          await page.screenshot({ path: `${out}/quiet-${mapName}-${s.done}.png` });
          row.quiet = await page.evaluate(() => {
            const g = window.__game, mp = g.map, n = mp.helping ? mp.helping() : null;
            return { busy: g.input.busy, cur: n && n.critter.name, raw: (() => { const h = mp.hint(() => 9) ?? g.hints.sandboxHint(g.world); return h && { type: h.type, kind: h.kind, phrase: h.phrase }; })(), problem: (() => { const h = g.hints.problemHint(g.world); return h && { type: h.type, phrase: h.phrase }; })(), parts: g.world.parts.filter((p) => !p.pinned).map((p) => [p.kind, +p.root.position.x.toFixed(1), +p.root.position.z.toFixed(1), p.seated ? 'S' : '', +(p.speed ?? p.state.level).toFixed(2), p.closed ? 'C' : '']) };
          });
          rows.push(row);
          row = null;
          break;
        }
        await page.waitForTimeout(500);
      }
      continue;
    }
    const h = s.h;
    // A child does not drag at a hand they cannot see: wait for the view to bring it in.
    const vp = page.viewportSize();
    const off = [h.from, h.to, h.at].filter(Boolean).some((q) => q.x < 0 || q.y < 0 || q.x > vp.width || q.y > vp.height);
    if (off) {
      if (++quiet === 30) {
        await page.screenshot({ path: `${out}/offscreen-${mapName}-${s.done}.png` });
        row.offscreen = { h, vp, state: await page.evaluate(() => { const g = window.__game; return { busy: g.input.busy, hint: g.hint && { type: g.hint.type, kind: g.hint.kind }, cam: g.stage.viewGoal ? g.stage.viewGoal().target.toArray().map((x) => +x.toFixed(1)) : null }; }) };
        rows.push(row);
        row = null;
        break;
      }
      await page.waitForTimeout(500);
      continue;
    }
    quiet = 0;
    if (h.type === 'drag') {
      // Open the drawer, then drag the part out of it onto its place.
      const card = await (await page.$(`.group[data-group="${h.group}"] .part-btn`)).boundingBox();
      // A drawer of one kind is that part: drag it straight out (a tap would put it down at once).
      const single = await page.evaluate((id) => { const g = window.__game; return g.hud.offered(g.GROUPS.find((gr) => gr.id === id)).length === 1; }, h.group);
      if (!single) {
        await tap({ x: card.x + card.width / 2, y: card.y + card.height / 2 });
        await page.waitForTimeout(500);
      }
      const v = single ? null : await page.$(`.flyout .variant[aria-label="${h.name}"]`);
      const box = v ? await v.boundingBox() : card;
      await drag({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, h.to, 20);
      row.steps.push(`drag ${h.kind}${v || single ? '' : ' (card)'}`);
      await page.waitForTimeout(900);
    } else if (h.type === 'connect') {
      await drag(h.from, h.to);
      row.steps.push('wire');
      await page.waitForTimeout(700);
    } else if (h.type === 'tap') {
      if (h.both) {
        // Two fingers, one on each button, held together (a two-hand press).
        const fire = (type, id, q) => page.evaluate(([type, id, x, y]) => document.elementFromPoint(x, y).dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 11 })), [type, id, q.x, q.y]);
        await fire('pointerdown', 11, h.both[0]);
        await page.waitForTimeout(120);
        await fire('pointerdown', 12, h.both[1]);
        for (let k = 0; k < 40; k++) {
          await page.waitForTimeout(250);
          if ((await doneCount()) > s.done) break;
        }
        await fire('pointerup', 12, h.both[1]);
        await fire('pointerup', 11, h.both[0]);
        row.steps.push('hold both');
      } else if (h.kind === 'button') {
        // Hold the button down while it works.
        await m.move(h.at.x, h.at.y);
        await m.down();
        for (let k = 0; k < 40; k++) {
          await page.waitForTimeout(250);
          if ((await doneCount()) > s.done) break;
        }
        await m.up();
        row.steps.push('hold button');
      } else {
        await tap(h.at);
        row.steps.push('tap ' + h.kind);
      }
      await page.waitForTimeout(700);
    } else if (h.type === 'tapWire') {
      await page.screenshot({ path: `${out}/tapwire-${mapName}-${s.done}.png` });
      await tap(h.at);
      row.steps.push('tap wire');
      await page.waitForTimeout(700);
    } else {
      row.steps.push(h.type + ':' + h.phrase);
      await page.waitForTimeout(1500);
    }
    if (row.steps.length > 30) {
      row.stuck = true;
      await page.screenshot({ path: `${out}/stuck-${mapName}-${s.done}.png` });
      rows.push(row);
      row = null;
      break;
    }
  }
  if (row) rows.push(row);
  const end = await page.evaluate(() => { const mp = window.__game.map; return mp ? { phase: mp.phase, done: mp.needs.filter((n) => n.done).length, total: mp.needs.length } : null; });
  for (const r of rows) console.log(JSON.stringify({ ...r, sec: Math.round((Date.now() - r.t) / 1000) }));
  console.log(JSON.stringify({ end, errors }));
  await browser.close();
})();
