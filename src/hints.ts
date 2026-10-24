// Decides what to suggest next. Problems (short circuit, reversed LED) come
// first, then the next missing connection of the level's loop.
import * as THREE from 'three';
import type { Level } from './levels';
import { PARAMS } from './circuit/solver';
import type { Part, PartKind, Terminal } from './parts/base';
import { ButtonPanel } from './parts/extra';
import { Dynamo } from './parts/more';
import { aimFor, Laser, LightSensor, WindGen } from './parts/chain';
import type { PhraseId } from './voice';
import type { Wire } from './wires';
import { activeAt, partIdOf, type World } from './world';

export type Problem = 'short' | 'reversed' | 'bypass' | 'useSwitch' | 'beside';

export type Hint =
  | { type: 'connect'; from: Terminal; to: Terminal; phrase: PhraseId }
  /** Press this part (a switch, a button, one button of the panel at `local`). */
  | { type: 'tap'; part: Part; phrase: PhraseId; local?: THREE.Vector3 }
  /** The battery is too weak for everything wired to it. */
  | { type: 'weak'; part: Part; phrase: PhraseId }
  /** Take this wire off: it is the newest step that caused the problem. */
  | { type: 'tapWire'; wire: Wire; at: Part | null; problem: Problem; phrase: PhraseId; u: number }
  | { type: 'drag'; kind: PartKind; to: THREE.Vector3; phrase: PhraseId };

export function hintKey(h: Hint | null): string {
  if (!h) return '';
  switch (h.type) {
    case 'connect':
      return `c:${h.from.id}>${h.to.id}`;
    case 'tap':
      return `t:${h.part.id}:${h.local?.x ?? ''}`;
    case 'weak':
      return `k:${h.part.id}`;
    case 'tapWire':
      return `w:${h.wire.id}:${h.problem}`;
    case 'drag':
      return `d:${h.kind}`;
  }
}

export function isProblem(h: Hint | null): boolean {
  return h?.type === 'tapWire';
}

const LOADS: PartKind[] = ['bulb', 'led', 'fan', 'carousel', 'windmill', 'buzzer', 'musicbox', 'xylophone', 'drum', 'track', 'helicopter', 'firetruck', 'trafficLight', 'disco', 'lift', 'crane', 'floorFan', 'pcFan', 'piano', 'tuba', 'maracas', 'bells', 'marbleRun', 'waterMill', 'conveyor', 'launcher', 'laser', 'bell', 'belt'];
const POLAR: PartKind[] = ['led', 'buzzer', 'musicbox'];
const isPolar = (p: Part) => POLAR.includes(p.kind);
const isBattery = (p: Part) => p.kind === 'battery' || p.kind === 'bigBattery';

/** Every place power comes from: a battery's two posts, or a clip pair of the panel. */
interface Source {
  part: Part;
  plus: Terminal;
  minus: Terminal;
}
function sources(world: World): Source[] {
  return world.parts.flatMap((p): Source[] => {
    if (isBattery(p) || p instanceof Dynamo || p instanceof WindGen) return [{ part: p, plus: p.terminal('a'), minus: p.terminal('b') }];
    if (p instanceof ButtonPanel) return p.outputs().map(([plus, minus]) => ({ part: p, plus, minus }));
    return [];
  });
}
const reversedPhrase = (p: Part): PhraseId => (p.kind === 'led' ? 'reversed' : p.kind === 'musicbox' ? 'musicReversed' : 'buzzerReversed');

/**
 * Things that are actually wrong, in any mode. Each points at the newest wire
 * whose removal fixes it, so the fix reads as "undo that step"; once it is
 * off, the regular hints show where that end should go instead.
 */
export function problemHint(world: World): Hint | null {
  const r = world.result;
  if (!r) return null;
  const touching = (p: Part) => world.wires.filter((w) => p.terminals.some((t) => w.touches(t)));

  // 1. Short circuit: "+" and "−" of a battery joined with nothing in between.
  if (r.shorted.size) {
    const battery = world.parts.find((p) => [...r.shorted].some((id) => partIdOf(id) === p.id)) ?? null;
    const wire =
      world.latestCulprit((res) => res.shorted.size === 0) ??
      (battery ? touching(battery).at(-1) : undefined) ??
      null;
    if (wire) return { type: 'tapWire', wire, at: battery, problem: 'short', phrase: batteriesFight(world) ? 'batteryFight' : 'short', u: clearSpot(world, wire) };
  }

  // 2. LED or buzzer the wrong way round inside a working loop.
  for (const p of world.parts) {
    if (!isPolar(p) || !p.state.reversed) continue;
    const wire = world.latestCulprit((res) => !res.elements.get(p.id)?.reversed, touching(p)) ?? touching(p).at(-1);
    if (wire) return { type: 'tapWire', wire, at: p, problem: 'reversed', phrase: reversedPhrase(p), u: clearSpot(world, wire) };
  }

  // 3. Both legs of a part joined by wires: current goes round it, it stays dark.
  // The mistake is on the leg that was wired last — or, for an LED or buzzer,
  // the leg that sits on the wrong pole — so point at that leg's newest wire.
  for (let i = world.parts.length - 1; i >= 0; i--) {
    const p = world.parts[i];
    if (!LOADS.includes(p.kind)) continue;
    const a = p.terminal('a');
    const b = p.terminal('b');
    if (!world.wired(a, b)) continue;
    const newest = (t: Terminal) => Math.max(-1, ...world.wiresAt(t).map((w) => world.wires.indexOf(w)));
    let wrong = newest(a) > newest(b) ? a : b;
    if (isPolar(p)) {
      const src = sources(world);
      if (src.some((q) => world.wired(a, q.plus))) wrong = b;
      else if (src.some((q) => world.wired(a, q.minus))) wrong = a;
    }
    const wire = world.wiresAt(wrong).at(-1);
    if (wire) return { type: 'tapWire', wire, at: p, problem: 'bypass', phrase: 'bypass', u: clearSpot(world, wire) };
  }

  // 3b. A switch (sensor, target, dominoes, button) wired beside a gadget instead of
  // on the way to it: the gadget runs anyway, and closing the switch would short
  // the battery. Point at the switch's newest wire.
  if (!r.shorted.size) {
    for (let i = world.parts.length - 1; i >= 0; i--) {
      const sw = world.parts[i];
      if (sw instanceof ButtonPanel) continue;
      const el = sw.elements()[0];
      if (!el || el.kind !== 'switch' || el.closed) continue;
      if (!world.wiresAt(sw.terminal('a')).length || !world.wiresAt(sw.terminal('b')).length) continue;
      const shut = world.trial((e) => (e.id === el.id ? { ...e, closed: true } : e));
      if (!shut.shorted.size) continue;
      const newest = (t: Terminal) => Math.max(-1, ...world.wiresAt(t).map((w) => world.wires.indexOf(w)));
      const t = newest(sw.terminal('a')) > newest(sw.terminal('b')) ? sw.terminal('a') : sw.terminal('b');
      const wire = world.wiresAt(t).at(-1);
      if (wire) return { type: 'tapWire', wire, at: sw, problem: 'beside', phrase: 'switchBeside', u: clearSpot(world, wire) };
    }
  }

  // 4. Wired right but too little power: with twice the battery it would work.
  const idle = world.parts.filter((p) => LOADS.includes(p.kind) && !activeAt(p.kind, p.state.level));
  if (idle.length) {
    const strong = world.trial((e) => (e.kind === 'battery' ? { ...e, emf: (e.emf ?? PARAMS.battery.emf) * 2 } : e));
    if (idle.some((p) => activeAt(p.kind, strong.elements.get(p.id)?.level ?? 0))) {
      // The battery working hardest is the one to point at.
      let best: string | null = null;
      let bestI = 0;
      for (const [id, e] of strong.elements) {
        const el = world.elements().find((x) => x.id === id);
        if (el?.kind === 'battery' && Math.abs(e.current) > bestI) {
          best = partIdOf(id);
          bestI = Math.abs(e.current);
        }
      }
      const busiest = world.parts.find((q) => q.id === best);
      // A hand generator is "weak" because it is turned too slowly (or not at all).
      if (busiest instanceof Dynamo) return { type: 'tap', part: busiest, phrase: 'crank', local: busiest.knobPoint() };
      if (busiest instanceof WindGen) return { type: 'tap', part: busiest, phrase: 'windTip' };
      if (busiest) return { type: 'weak', part: busiest, phrase: 'weak' };
    }
  }
  return null;
}

/**
 * Two different batteries joined plus to plus and minus to minus: the bigger
 * one pushes current straight into the smaller. (Equal ones side by side are
 * fine and never show up as a short.)
 */
function batteriesFight(world: World): boolean {
  const src = world.parts.filter((p) => isBattery(p) || p instanceof Dynamo);
  const volts = (p: Part) => p.elements()[0].emf ?? PARAMS.battery.emf;
  for (let i = 0; i < src.length; i++) {
    for (let j = i + 1; j < src.length; j++) {
      const [p, q] = [src[i], src[j]];
      const side = world.wired(p.terminal('a'), q.terminal('a')) && world.wired(p.terminal('b'), q.terminal('b'));
      if (side && Math.abs(volts(p) - volts(q)) > 0.5) return true;
    }
  }
  return false;
}

/**
 * A switch, button or panel button that would get an idle gadget going.
 * Panel buttons are tried one by one so the hint points at the right one.
 */
function switchHint(world: World): Hint | null {
  const idle = world.parts.filter((p) => LOADS.includes(p.kind) && !activeAt(p.kind, p.state.level));
  if (!idle.length) return null;
  for (const sw of world.parts) {
    for (const el of sw.elements()) {
      if (el.kind !== 'switch' || el.closed) continue;
      const r = world.trial((e) => (e.id === el.id ? { ...e, closed: true } : e));
      if (r.shorted.size || !idle.some((p) => activeAt(p.kind, r.elements.get(p.id)?.level ?? 0))) continue;
      if (sw instanceof ButtonPanel) {
        const i = Number(el.id.split('#')[1]);
        return { type: 'tap', part: sw, phrase: 'tapPanel', local: sw.buttonPoint(i) };
      }
      return { type: 'tap', part: sw, phrase: SWITCH_PHRASE[sw.kind] ?? 'tapSwitch' };
    }
  }
  return null;
}

/** What to say about a switch-like part that would get things going. */
const SWITCH_PHRASE: Partial<Record<PartKind, PhraseId>> = {
  button: 'holdButton',
  lightSensor: 'lightTip',
  target: 'targetTip',
  domino: 'dominoTip',
};

/**
 * Free play: gentle next-step nudges once the child pauses. Only for a part
 * that is half connected to a battery, so the hint finishes what they started.
 */
export function sandboxHint(world: World): Hint | null {
  const srcs = sources(world);
  const loads = world.parts.filter((p) => LOADS.includes(p.kind));
  if (!srcs.length) {
    return loads.length ? { type: 'drag', kind: 'battery', to: freeSpot(world), phrase: 'needBattery' } : null;
  }
  for (let i = loads.length - 1; i >= 0; i--) {
    const p = loads[i];
    if (p.state.level !== 0 && Math.abs(p.state.level) > 0.05) continue;
    for (const { part: src, plus, minus } of srcs) {
      for (const [on, off] of [
        [p.terminal('a'), p.terminal('b')],
        [p.terminal('b'), p.terminal('a')],
      ] as const) {
        if (world.wiresAt(off).length) continue;
        const toPlus = world.wired(on, plus);
        const toMinus = world.wired(on, minus);
        if (toPlus === toMinus) continue;
        // A polar part already started the wrong way: undo that wire first.
        if (isPolar(p) && (on.key === 'a') !== toPlus) {
          const wire = world.wiresAt(on).at(-1);
          if (wire) return { type: 'tapWire', wire, at: p, problem: 'reversed', phrase: reversedPhrase(p), u: clearSpot(world, wire) };
        }
        const phrase: PhraseId = src instanceof ButtonPanel ? 'toPair' : toPlus ? 'toMinus' : 'toPlus';
        return { type: 'connect', from: off, to: toPlus ? minus : plus, phrase };
      }
    }
  }
  return crankHint(world) ?? beamHint(world) ?? switchHint(world);
}

/**
 * A shining laser and a dark light sensor that would get a gadget going:
 * point at what to turn — the laser itself or the first mirror to flip.
 */
function beamHint(world: World): Hint | null {
  const idle = world.parts.filter((p) => LOADS.includes(p.kind) && !activeAt(p.kind, p.state.level));
  if (!idle.length) return null;
  for (const sensor of world.parts) {
    if (!(sensor instanceof LightSensor) || sensor.closed) continue;
    const r = world.trial((e) => (e.id === sensor.id ? { ...e, closed: true } : e));
    if (r.shorted.size || !idle.some((p) => activeAt(p.kind, r.elements.get(p.id)?.level ?? 0))) continue;
    for (const laser of world.parts) {
      if (!(laser instanceof Laser) || !laser.powered) continue;
      const plan = aimFor(world.parts, laser, sensor);
      if (!plan) continue;
      if (plan.aim !== laser.aim) return { type: 'tap', part: laser, phrase: 'laserTip' };
      if (plan.flip.length) return { type: 'tap', part: plan.flip[0], phrase: 'mirrorTip' };
    }
  }
  return null;
}

/** A still generator that would run an idle gadget if turned: point at its knob. */
function crankHint(world: World): Hint | null {
  const idle = world.parts.filter((p) => LOADS.includes(p.kind) && !activeAt(p.kind, p.state.level));
  if (!idle.length) return null;
  for (const d of world.parts) {
    if (!(d instanceof Dynamo || d instanceof WindGen) || d.volts > 1) continue;
    const r = world.trial((e) => (e.id === d.id ? { ...e, emf: 4 } : e));
    if (!r.shorted.size && idle.some((p) => activeAt(p.kind, r.elements.get(p.id)?.level ?? 0))) {
      if (d instanceof WindGen) return { type: 'tap', part: d, phrase: 'windTip' };
      return { type: 'tap', part: d, phrase: 'crank', local: d.knobPoint() };
    }
  }
  return null;
}

export function levelHint(world: World, level: Level, trayLeft: (k: PartKind) => number): Hint | null {
  if (level.goal(world)) return null;
  const loops = level.loops ?? (level.chain.length ? [['battery' as PartKind, ...level.chain]] : []);
  if (!loops.length) return null;

  // Every part of every loop on the table first (sources may serve several loops).
  const used = new Set<Part>();
  const plans: { src: Part; chain: Part[] }[] = [];
  for (const [srcKind, ...kinds] of loops) {
    const src = world.parts.find((q) => q.kind === srcKind);
    if (!src) return trayLeft(srcKind) > 0 ? { type: 'drag', kind: srcKind, to: freeSpot(world), phrase: 'drag' } : null;
    const chain: Part[] = [];
    for (const kind of kinds) {
      const p = world.parts.find((q) => q.kind === kind && !used.has(q));
      if (!p) return trayLeft(kind) > 0 ? { type: 'drag', kind, to: freeSpot(world), phrase: 'drag' } : null;
      used.add(p);
      chain.push(p);
    }
    plans.push({ src, chain });
  }

  // A switch task where the lamp was wired straight to the battery: that wire goes.
  for (const { src, chain } of plans) {
    const sw = chain.find((p) => p.kind === 'switch');
    if (!sw || (sw.closed && Math.abs(sw.state.current) > 0.01)) continue;
    const lit = chain.find((p) => p !== sw && activeAt(p.kind, p.state.level));
    if (!lit) continue;
    const touching = world.wires.filter((w) => lit.terminals.some((t) => w.touches(t)));
    const direct = touching.find((w) => src.terminals.some((t) => w.touches(t))) ?? touching.at(-1);
    if (direct) return { type: 'tapWire', wire: direct, at: lit, problem: 'useSwitch', phrase: 'useSwitch', u: clearSpot(world, direct) };
  }

  for (const { src, chain } of plans) {
    const missing = loopPlan(world, src, chain).find(([a, b]) => !world.wired(a, b));
    if (missing) return { type: 'connect', from: missing[0], to: missing[1], phrase: 'connect' };
  }
  return crankHint(world) ?? beamHint(world) ?? switchHint(world);
}

/**
 * The wires that close a loop source "+" → chain → source "−". Every
 * orientation of the non-polar parts is tried and the one that agrees most
 * with what the child has already wired wins.
 */
function loopPlan(world: World, src: Part, chain: Part[]): [Terminal, Terminal][] {
  const flexible = chain.map((p) => !isPolar(p));
  const n = chain.length;
  let best: [Terminal, Terminal][] = [];
  let bestScore = -1;
  for (let mask = 0; mask < 1 << n; mask++) {
    let ok = true;
    const pairs: [Terminal, Terminal][] = [];
    let prev = src.terminal('a');
    for (let i = 0; i < n; i++) {
      const flip = (mask >> i) & 1;
      if (flip && !flexible[i]) {
        ok = false;
        break;
      }
      pairs.push([prev, chain[i].terminal(flip ? 'b' : 'a')]);
      prev = chain[i].terminal(flip ? 'a' : 'b');
    }
    if (!ok) continue;
    pairs.push([prev, src.terminal('b')]);
    const score = pairs.filter(([a, b]) => world.wired(a, b)).length;
    if (score > bestScore) {
      bestScore = score;
      best = pairs;
    }
  }
  return best;
}

/**
 * Where along a wire to point so the finger lands on it and not on a
 * neighbour: the stretch farthest (on screen) from every other wire.
 */
function clearSpot(world: World, wire: Wire): number {
  const others = world.wires.filter((w) => w !== wire && w.b).flatMap((w) => w.samples(20).map((p) => world.stage.project(p)));
  const bodies = partsOnScreen(world);
  let best = 0.5;
  let bestScore = -Infinity;
  for (let i = 3; i <= 17; i++) {
    const u = i / 20;
    const p = world.stage.project(wire.pointAt(u));
    let d = Infinity;
    for (const o of others) d = Math.min(d, Math.hypot(o.x - p.x, o.y - p.y));
    // Away from other wires and off the parts themselves, so the finger lands on table.
    let e = Infinity;
    for (const b of bodies) e = Math.min(e, Math.hypot(b.x - p.x, b.y - p.y) - b.r);
    const score = Math.min(d, 60) + Math.min(e, 50) * 1.2 - Math.abs(u - 0.5) * 20;
    if (score > bestScore) {
      bestScore = score;
      best = u;
    }
  }
  return best;
}

/** Each part as a circle on screen (centre and radius in pixels). */
export function partsOnScreen(world: World): { x: number; y: number; r: number }[] {
  return world.parts.map((p) => {
    const c = world.stage.project(p.root.position);
    return { x: c.x, y: c.y, r: p.radius * 0.85 * world.stage.pixelsPerUnit(p.root.position) };
  });
}

/** An empty-looking place near the middle of the view for a new part. */
export function freeSpot(world: World): THREE.Vector3 {
  const c = world.stage.viewCenter();
  let best = c.clone();
  let bestD = -Infinity;
  for (let i = -3; i <= 3; i++) {
    for (let j = -2; j <= 2; j++) {
      const x = c.x + i * 1.5;
      const z = c.z + j * 1.4;
      let d = Infinity;
      for (const p of world.parts) d = Math.min(d, Math.hypot(p.root.position.x - x, p.root.position.z - z) - p.radius);
      // Prefer spots near the middle when several are free.
      const score = Math.min(d, 2.5) - Math.hypot(i * 1.5, j * 1.4) * 0.15;
      if (score > bestD) {
        bestD = score;
        best = new THREE.Vector3(x, 0, z);
      }
    }
  }
  return best;
}
