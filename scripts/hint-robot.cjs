// Hint robot: a child wires at random (mistakes included), then does only what
// the hint shows. Reports hint loops (the same table twice), "regrets" (a wire
// the hints took off and then ask back) and gadgets left dark with no hint.
//   npm run build && npx vite preview --port 5196 &
//   node scripts/hint-robot.cjs 360 free     (or: levels, machines)
// Chain tasks end in 'chain-action' where the robot cannot blow or roll a ball.
const { chromium } = (() => { try { return require('playwright-core'); } catch { return require(process.env.HOME + '/Documents/Landing/node_modules/playwright-core'); } })();
const RUNS = Number(process.argv[2] || 40);
const MODE = process.argv[3] || 'free';
const URL = process.env.URL || 'http://127.0.0.1:5196/';
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: process.env.HOME + '/Library/Caches/ms-playwright/chromium-1208/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const p = await (await b.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' })).newPage();
  p.on('pageerror', (e) => console.log('PAGEERR', String(e)));
  await p.goto(URL + '?q=0&quickhints');
  await p.waitForFunction(() => document.getElementById('loader')?.classList.contains('is-done'), null, { timeout: 180000 });
  const out = await p.evaluate(async ([RUNS, MODE]) => {
    const g = window.__game, w = g.world, H = g.hints;
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const SETS = [
      ['battery', 'bulb', 'button'], ['battery', 'led', 'button'], ['battery', 'bulb', 'switch'], ['battery', 'buzzer', 'button'],
      ['battery', 'fan', 'button'], ['battery', 'bulb', 'bulb', 'button'], ['battery', 'bulb', 'panel'], ['battery', 'led', 'panel'],
      ['battery', 'bigBattery', 'bulb'], ['battery', 'battery', 'helicopter'], ['battery', 'bulb', 'fan', 'switch'], ['battery', 'led', 'switch', 'button'],
    ];
    const LOADKINDS = ['bulb', 'led', 'fan', 'buzzer', 'helicopter'];
    const sig = () => w.wires.filter((x) => x.b).map((x) => [x.a.id, x.b.id].sort().join('-')).sort().join(',') + '|' + w.parts.map((q) => q.elements().map((e) => (e.closed ? 1 : 0)).join('')).join('');
    const desc = (h) => !h ? null : h.type === 'connect' ? `connect ${h.from.id}>${h.to.id} (${h.phrase})` : h.type === 'tapWire' ? `remove ${h.wire.a.id}-${h.wire.b.id} (${h.problem})` : h.type === 'tap' ? `tap ${h.part.id}${h.local ? '@' + h.local.x.toFixed(1) : ''} (${h.phrase})` : `${h.type} ${h.phrase}`;
    const reports = [];
    const held = new Set();
    for (let run = 0; run < RUNS; run++) {
      held.clear();
      let set, parts, level = null;
      if (MODE === 'free') {
        set = SETS[run % SETS.length];
        g.startLevel(g.FREE_PLAY);
        w.clear();
        parts = set.map((k, i) => w.addPart(k, -6 + i * 4, (i % 2) * 3));
      } else {
        const levels = (MODE === 'machines' ? g.MACHINES : g.LEVELS).filter((l) => !l.sandbox);
        level = levels[run % levels.length];
        g.startLevel(level);
        // Everything from the tray on the table first, as the child drags it out.
        for (const t of level.tray ?? []) for (let k = 0; k < Math.min(t.count, 3); k++) w.addPart(t.kind, -8 + k * 3 + rnd(), 6 + rnd() * 2, { color: t.color });
        parts = w.parts;
        set = [level.id];
      }
      const terms = parts.flatMap((q) => q.terminals);
      // The child's own wiring: 3–6 wires, a third of them near-random, the rest "battery-ish".
      const n = 3 + Math.floor(rnd() * 4);
      const made = [];
      for (let k = 0; k < n; k++) {
        const src = parts.find((q) => q.kind === 'battery' || q.kind === 'bigBattery') ?? parts[0];
        const a = rnd() < 0.5 ? pick(src.terminals) : pick(terms);
        const bb = pick(terms.filter((t) => t !== a));
        if (made.some(([x, y]) => (x === a && y === bb) || (x === bb && y === a))) continue;
        g.connect(a, bb);
        made.push([a, bb]);
      }
      // The child presses what they like: every button held, every switch on, half the time.
      if (rnd() < 0.5) for (const q of parts) { if (q.kind === 'switch' && !q.closed) q.tap(); }
      g.step(4);
      const start = made.map(([x, y]) => `${x.id}-${y.id}`);
      const seen = new Map();
      const log = [];
      const removed = [];
      let verdict = 'stuck';
      for (let s = 0; s < 30; s++) {
        const k = sig();
        if (seen.has(k)) { verdict = /windTip|dominoTip|mirrorTip|laserTip|targetTip|lightTip|aimTip|crank/.test(log.at(-1) ?? '') ? 'chain-action' : 'loop'; break; }
        seen.set(k, s);
        const h = H.problemHint(w, level ? H.plannedWires(w, level) : undefined) ?? (level ? H.levelHint(w, level, () => 1) : H.sandboxHint(w));
        log.push(desc(h));
        if (!h && level) { g.step(60); verdict = g.levelGoal() ? 'ok' : 'nohint'; break; }
        if (h && h.type === 'drag') { const q = w.addPart(h.kind, h.to.x, h.to.z); log.push('  (dragged)'); g.step(4); continue; }
        if (!h) {
          const loads = w.parts.filter((q) => LOADKINDS.includes(q.kind));
          const ok = loads.every((q) => Math.abs(q.state.level) > 0.05);
          // Free play nudges only what was started: a gadget with a wire on it that still sits dark is the child left stuck.
          const started = loads.filter((q) => Math.abs(q.state.level) <= 0.05 && q.terminals.some((t) => w.wiresAt(t).length));
          verdict = ok ? 'ok' : started.length ? 'stuck-dark:' + started.map((q) => q.id + q.kind).join(',') : 'nohint';
          break;
        }
        if (h.type === 'tapWire') { removed.push([h.wire.a.id, h.wire.b.id].sort().join('-')); w.removeWire(h.wire); }
        else if (h.type === 'connect') {
          const key = [h.from.id, h.to.id].sort().join('-');
          if (removed.includes(key)) log.push('  ^^ REGRET: asks back a wire it removed');
          g.connect(h.from, h.to);
        }
        else if (h.type === 'tap') {
          // Held down, as a finger keeps it (the button's cap / the panel's button at the hint's point).
          if (h.part.kind === 'button') { h.part.closed = true; held.add(h.part); }
          else if (h.part.kind === 'panel') { h.part.tap(null, h.part.root.localToWorld(h.local.clone())); }
          else h.part.tap(null, h.local ?? null);
          w.markDirty();
        }
        else { verdict = h.type + ':' + h.phrase; break; }
        g.step(4);
      }
      const regret = log.some((l) => l && l.includes('REGRET'));
      if (verdict !== 'ok' || regret) reports.push({ run, set: set.join('+'), verdict, regret, start, log });
    }
    return reports;
  }, [RUNS, MODE]);
  console.log(JSON.stringify(out, null, 1));
  console.log('BAD', out.length, 'of', RUNS);
  await b.close();
})();
