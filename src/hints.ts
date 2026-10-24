// Decides what to suggest next. Problems (short circuit, reversed LED) come
// first, then the next missing connection of the level's loop.
import * as THREE from 'three';
import type { Level } from './levels';
import { PARAMS } from './circuit/solver';
import type { Part, PartKind, Terminal } from './parts/base';
import { ButtonPanel } from './parts/extra';
import { Dynamo } from './parts/more';
import type { PhraseId } from './voice';
import type { Wire } from './wires';
import { activeAt, partIdOf, type World } from './world';

export type Problem = 'short' | 'reversed' | 'bypass';

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

const LOADS: PartKind[] = ['bulb', 'led', 'fan', 'carousel', 'windmill', 'buzzer', 'musicbox', 'xylophone', 'drum', 'track', 'helicopter', 'firetruck', 'trafficLight', 'disco', 'lift', 'crane'];
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
    if (isBattery(p) || p instanceof Dynamo) return [{ part: p, plus: p.terminal('a'), minus: p.terminal('b') }];
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
    if (wire) return { type: 'tapWire', wire, at: battery, problem: 'short', phrase: 'short', u: clearSpot(world, wire) };
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
      if (busiest) return { type: 'weak', part: busiest, phrase: 'weak' };
    }
  }
  return null;
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
      return { type: 'tap', part: sw, phrase: sw.kind === 'button' ? 'holdButton' : 'tapSwitch' };
    }
  }
  return null;
}

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
  return crankHint(world) ?? switchHint(world);
}

/** A still generator that would run an idle gadget if turned: point at its knob. */
function crankHint(world: World): Hint | null {
  const idle = world.parts.filter((p) => LOADS.includes(p.kind) && !activeAt(p.kind, p.state.level));
  if (!idle.length) return null;
  for (const d of world.parts) {
    if (!(d instanceof Dynamo) || d.volts > 1) continue;
    const r = world.trial((e) => (e.id === d.id ? { ...e, emf: 4 } : e));
    if (!r.shorted.size && idle.some((p) => activeAt(p.kind, r.elements.get(p.id)?.level ?? 0))) {
      return { type: 'tap', part: d, phrase: 'crank', local: d.knobPoint() };
    }
  }
  return null;
}

export function levelHint(world: World, level: Level, trayLeft: (k: PartKind) => number): Hint | null {
  if (!level.chain.length || level.goal(world)) return null;
  const battery = world.parts.find((p) => p.kind === 'battery');
  if (!battery) return null;

  const used = new Set<Part>([battery]);
  const chain: Part[] = [];
  for (const kind of level.chain) {
    const p = world.parts.find((q) => q.kind === kind && !used.has(q));
    if (!p) {
      if (trayLeft(kind) > 0) return { type: 'drag', kind, to: freeSpot(world), phrase: 'drag' };
      return null;
    }
    used.add(p);
    chain.push(p);
  }

  // Try every orientation of the non-polar parts and follow the one that
  // agrees most with what the child has already wired.
  const flexible = chain.map((p) => !isPolar(p));
  const n = chain.length;
  let best: [Terminal, Terminal][] | null = null;
  let bestScore = -1;
  for (let mask = 0; mask < 1 << n; mask++) {
    let ok = true;
    const pairs: [Terminal, Terminal][] = [];
    let prev = battery.terminal('a');
    for (let i = 0; i < n; i++) {
      const flip = (mask >> i) & 1;
      if (flip && !flexible[i]) {
        ok = false;
        break;
      }
      const entry = chain[i].terminal(flip ? 'b' : 'a');
      const exit = chain[i].terminal(flip ? 'a' : 'b');
      pairs.push([prev, entry]);
      prev = exit;
    }
    if (!ok) continue;
    pairs.push([prev, battery.terminal('b')]);
    const score = pairs.filter(([a, b]) => world.wired(a, b)).length;
    if (score > bestScore) {
      bestScore = score;
      best = pairs;
    }
  }
  if (!best) return null;
  const missing = best.find(([a, b]) => !world.wired(a, b));
  if (missing) return { type: 'connect', from: missing[0], to: missing[1], phrase: 'connect' };

  return switchHint(world);
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
