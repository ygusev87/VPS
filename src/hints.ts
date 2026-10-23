// Decides what to suggest next. Problems (short circuit, reversed LED) come
// first, then the next missing connection of the level's loop.
import * as THREE from 'three';
import type { Level } from './levels';
import type { Part, PartKind, Terminal } from './parts/base';
import type { PhraseId } from './voice';
import type { Wire } from './wires';
import type { World } from './world';

export type Hint =
  | { type: 'connect'; from: Terminal; to: Terminal; phrase: PhraseId }
  | { type: 'tap'; part: Part; phrase: PhraseId }
  | { type: 'tapWire'; wire: Wire; battery: Part | null; phrase: PhraseId }
  | { type: 'polarity'; part: Part; plus: Terminal; batteryPlus: Terminal; phrase: PhraseId }
  | { type: 'drag'; kind: PartKind; to: THREE.Vector3; phrase: PhraseId };

export function hintKey(h: Hint | null): string {
  if (!h) return '';
  switch (h.type) {
    case 'connect':
      return `c:${h.from.id}>${h.to.id}`;
    case 'tap':
      return `t:${h.part.id}`;
    case 'tapWire':
      return `w:${h.wire.id}`;
    case 'polarity':
      return `p:${h.part.id}`;
    case 'drag':
      return `d:${h.kind}`;
  }
}

/** Problems worth interrupting for, in any mode. */
export function problemHint(world: World): Hint | null {
  const r = world.result;
  if (!r) return null;
  if (r.shorted.size) {
    const battery = world.parts.find((p) => r.shorted.has(p.id)) ?? null;
    const wire = world.shortingWires()[0] ?? (battery ? world.wiresAt(battery.terminal('a'))[0] : undefined);
    if (wire) return { type: 'tapWire', wire, battery, phrase: 'short' };
  }
  const rev = world.parts.find((p) => (p.kind === 'led' || p.kind === 'buzzer') && p.state.reversed);
  const battery = world.parts.find((p) => p.kind === 'battery');
  if (rev && battery) {
    return {
      type: 'polarity',
      part: rev,
      plus: rev.terminal('a'),
      batteryPlus: battery.terminal('a'),
      phrase: rev.kind === 'led' ? 'reversed' : 'buzzerReversed',
    };
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
  const flexible = chain.map((p) => p.kind !== 'led' && p.kind !== 'buzzer');
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

  const sw = chain.find((p) => p.kind === 'switch' && !p.closed);
  if (sw) return { type: 'tap', part: sw, phrase: 'tapSwitch' };
  return null;
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
