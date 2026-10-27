// Decides what to suggest next. Problems (short circuit, reversed LED) come
// first, then the next missing connection of the level's loop.
import * as THREE from 'three';
import type { Level } from './levels';
import { PARAMS } from './circuit/solver';
import type { Part, PartKind, Terminal } from './parts/base';
import { ButtonPanel } from './parts/extra';
import { Reverser, SafetyPress, WireBox } from './parts/workshop';
import { Dynamo } from './parts/more';
import { aimFor, Laser, LightSensor, Magnet, WindGen } from './parts/chain';
import { Pole, Solar } from './parts/farm';
import type { PhraseId } from './voice';
import type { Wire } from './wires';
import { activeAt, partIdOf, type World } from './world';

export type Problem = 'short' | 'reversed' | 'bypass' | 'useSwitch' | 'beside' | 'wrong';

export type Hint =
  | { type: 'connect'; from: Terminal; to: Terminal; phrase: PhraseId }
  /** Press this part (a switch, a button, one button of the panel at `local`). */
  | { type: 'tap'; part: Part; phrase: PhraseId; local?: THREE.Vector3 }
  /** The battery is too weak for everything wired to it. */
  | { type: 'weak'; part: Part; phrase: PhraseId }
  /** Take this wire off: it is the newest step that caused the problem. */
  | { type: 'tapWire'; wire: Wire; at: Part | null; problem: Problem; phrase: PhraseId; u: number }
  /** Bring a part here: a new one from the drawers, or `part`, one already on the table (put down off its ring). */
  | { type: 'drag'; kind: PartKind; to: THREE.Vector3; phrase: PhraseId; part?: Part };

export function hintKey(h: Hint | null): string {
  if (!h) return '';
  switch (h.type) {
    case 'connect':
      return `c:${h.from.id}>${h.to.id}`;
    case 'tap':
      return `t:${h.part.id}:${h.local?.x ?? ''}:${h.local?.z ?? ''}`;
    case 'weak':
      return `k:${h.part.id}`;
    case 'tapWire':
      return `w:${h.wire.id}:${h.problem}`;
    case 'drag':
      // Where it goes too: the same part for another ring is a new hint (the camera looks for it again).
      return `d:${h.kind}:${h.part?.id ?? ''}:${h.to.x.toFixed(1)},${h.to.z.toFixed(1)}`;
  }
}

export function isProblem(h: Hint | null): boolean {
  return h?.type === 'tapWire';
}

const LOADS: PartKind[] = ['bulb', 'led', 'fan', 'carousel', 'windmill', 'buzzer', 'musicbox', 'xylophone', 'drum', 'track', 'helicopter', 'firetruck', 'trafficLight', 'disco', 'lift', 'crane', 'floorFan', 'pcFan', 'piano', 'tuba', 'maracas', 'bells', 'marbleRun', 'waterMill', 'conveyor', 'launcher', 'laser', 'bell', 'belt', 'pump', 'heater', 'gate', 'substation', 'magnet', 'barrier', 'ferris', 'carWash', 'drawbridge', 'towerCrane', 'duskLamp', 'neon', 'ladder', 'gearMotor', 'tank', 'paintBooth', 'robotArm', 'packer', 'garland', 'kettle', 'railCart', 'safetyPress', 'shaftMotor', 'gantry'];
const POLAR: PartKind[] = ['led', 'buzzer', 'musicbox'];
export const isPolar = (p: Part) => POLAR.includes(p.kind);
const isBattery = (p: Part) => p.kind === 'battery' || p.kind === 'bigBattery';

/** Every place power comes from: a battery's two posts, or a clip pair of the panel. */
interface Source {
  part: Part;
  plus: Terminal;
  minus: Terminal;
}
function sources(world: World): Source[] {
  return world.parts.flatMap((p): Source[] => {
    if (isBattery(p) || p instanceof Dynamo || p instanceof WindGen || p instanceof Pole || p instanceof Solar) return [{ part: p, plus: p.terminal('a'), minus: p.terminal('b') }];
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
export function problemHint(world: World, keep?: Set<Wire>): Hint | null {
  const r = world.result;
  // Of several wires that would do, one the task does not want (see plannedWires); else the newest.
  const newestOf = (ws: Wire[]) => ws.filter((w) => !keep?.has(w)).at(-1) ?? ws.at(-1);
  if (!r) return null;
  const touching = (p: Part) => world.wires.filter((w) => p.terminals.some((t) => w.touches(t)));

  // 1. Short circuit: "+" and "−" of a battery joined with nothing in between.
  if (r.shorted.size) {
    const battery = world.parts.find((p) => [...r.shorted].some((id) => partIdOf(id) === p.id)) ?? null;
    const wire =
      world.culprit((res) => res.shorted.size === 0, world.wires, keep, 'short') ??
      (battery ? newestOf(touching(battery)) : undefined) ??
      null;
    if (wire) return { type: 'tapWire', wire, at: battery, problem: 'short', phrase: batteriesFight(world) ? 'batteryFight' : 'short', u: clearSpot(world, wire) };
  }

  // 2. LED or buzzer the wrong way round inside a working loop.
  for (const p of world.parts) {
    if (!isPolar(p) || !p.state.reversed) continue;
    const wire = world.culprit((res) => !res.elements.get(p.id)?.reversed, touching(p), keep, `reversed:${p.id}`) ?? newestOf(touching(p));
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
    // A plain gadget: whichever wire on its legs leaves the most working once it is off (see World.culprit).
    const legs = world.wires.filter((w) => w.touches(a) || w.touches(b));
    const wire = (isPolar(p) ? null : world.culprit((_, off) => !world.wired(a, b, off), legs, keep, `bypass:${p.id}`)) ?? newestOf(world.wiresAt(wrong));
    if (wire) return { type: 'tapWire', wire, at: p, problem: 'bypass', phrase: 'bypass', u: clearSpot(world, wire) };
  }

  // 3b. A switch (sensor, target, dominoes, button) wired beside a gadget instead of
  // on the way to it: the gadget runs anyway, and closing the switch would short
  // the battery. Point at the switch's newest wire.
  if (!r.shorted.size) {
    for (let i = world.parts.length - 1; i >= 0; i--) {
      const sw = world.parts[i];
      // Parts with several contacts inside (a panel, a reversing lever, a two-hand press) are not one switch beside a gadget.
      if (sw instanceof ButtonPanel || sw instanceof Reverser || sw instanceof SafetyPress) continue;
      const el = sw.elements()[0];
      if (!el || el.kind !== 'switch' || el.closed) continue;
      if (!world.wiresAt(sw.terminal('a')).length || !world.wiresAt(sw.terminal('b')).length) continue;
      const shut = world.trial((e) => (e.id === el.id ? { ...e, closed: true } : e));
      if (!shut.shorted.size) continue;
      const newest = (t: Terminal) => Math.max(-1, ...world.wiresAt(t).map((w) => world.wires.indexOf(w)));
      const t = newest(sw.terminal('a')) > newest(sw.terminal('b')) ? sw.terminal('a') : sw.terminal('b');
      const wire = newestOf(world.wiresAt(t).filter((w) => !keep?.has(w))) ?? newestOf(world.wiresAt(sw.terminal('a')).concat(world.wiresAt(sw.terminal('b'))));
      if (wire) return { type: 'tapWire', wire, at: sw, problem: 'beside', phrase: 'switchBeside', u: clearSpot(world, wire) };
    }
  }

  // 4. Wired right but too little power: with twice the battery it would work.
  // (Idle by the circuit as it is now: a switch just pressed is not solved into the parts yet.)
  const now = world.trial((e) => e);
  const idle = world.parts.filter((p) => LOADS.includes(p.kind) && !activeAt(p.kind, p.state.level) && !activeAt(p.kind, now.elements.get(p.id)?.level ?? 0));
  if (idle.length) {
    const strong = world.trial((e) => (e.kind === 'battery' ? { ...e, emf: (e.emf ?? PARAMS.battery.emf) * 2 } : e));
    if (idle.some((p) => activeAt(p.kind, strong.elements.get(p.id)?.level ?? 0))) {
      // The one source that, made stronger alone, would get it going (on a map with many poles,
      // not a busy pole elsewhere); failing that, the battery working hardest.
      const batteries = world.elements().filter((e) => e.kind === 'battery');
      let best: string | null = null;
      for (const b of batteries) {
        const one = world.trial((e) => (e.id === b.id ? { ...e, emf: (e.emf ?? PARAMS.battery.emf) * 2 } : e));
        if (idle.some((p) => activeAt(p.kind, one.elements.get(p.id)?.level ?? 0))) {
          best = partIdOf(b.id);
          break;
        }
      }
      let bestI = 0;
      if (!best)
        for (const [id, e] of strong.elements) {
          if (batteries.some((x) => x.id === id) && Math.abs(e.current) > bestI) {
            best = partIdOf(id);
            bestI = Math.abs(e.current);
          }
        }
      const busiest = world.parts.find((q) => q.id === best);
      // A hand generator is "weak" because it is turned too slowly (or not at all).
      if (busiest instanceof Dynamo) return { type: 'tap', part: busiest, phrase: 'crank', local: busiest.knobPoint() };
      if (busiest instanceof WindGen) return { type: 'tap', part: busiest, phrase: 'windTip' };
      if (busiest instanceof Pole) return { type: 'weak', part: busiest, phrase: 'poleWeak' };
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
  // A magnet holding a ball comes first (see magnetHint): no "hit the target" meanwhile.
  if (world.parts.some((p) => p instanceof Magnet && p.caught)) return null;
  const idle = world.parts.filter((p) => LOADS.includes(p.kind) && !activeAt(p.kind, p.state.level));
  if (!idle.length) return null;
  for (const sw of world.parts) {
    // A two-hand press runs only with both buttons held: say so, pointing at one.
    if (sw instanceof SafetyPress) {
      if (idle.includes(sw) && world.wiresAt(sw.terminal('a')).length && world.wiresAt(sw.terminal('b')).length) {
        const r = world.trial((e) => (e.id.startsWith(`${sw.id}#`) ? { ...e, closed: true } : e));
        if (!r.shorted.size && activeAt(sw.kind, r.elements.get(sw.id)?.level ?? 0)) return { type: 'tap', part: sw, phrase: 'twoHands', local: sw.buttonPoint(sw.held[0] ? 1 : 0) };
      }
      continue;
    }
    // A reversing lever closes two contacts at once: try it forward, then back.
    if (sw instanceof Reverser) {
      if (sw.pos !== 0) continue;
      for (const pos of [1, -1] as const) {
        const keys = pos === 1 ? ['f1', 'f2'] : ['r1', 'r2'];
        const r = world.trial((e) => (keys.some((k) => e.id === `${sw.id}#${k}`) ? { ...e, closed: true } : e));
        if (!r.shorted.size && idle.some((p) => activeAt(p.kind, r.elements.get(p.id)?.level ?? 0))) return { type: 'tap', part: sw, phrase: 'tapReverser', local: sw.posPoint(pos) };
      }
      continue;
    }
    for (const el of sw.elements()) {
      if (el.kind !== 'switch' || el.closed) continue;
      const r = world.trial((e) => (e.id === el.id ? { ...e, closed: true } : e));
      if (r.shorted.size || !idle.some((p) => activeAt(p.kind, r.elements.get(p.id)?.level ?? 0))) continue;
      if (sw instanceof ButtonPanel) {
        const i = Number(el.id.split('#')[1]);
        return { type: 'tap', part: sw, phrase: 'tapPanel', local: sw.buttonPoint(i) };
      }
      // A wiring box closes by turning its tiles: point at the next one to turn.
      if (sw instanceof WireBox) {
        const at = sw.hintPoint();
        if (at) return { type: 'tap', part: sw, phrase: 'turnTile', local: at };
        continue;
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
  balloon: 'balloonTip',
  skittles: 'skittlesTip',
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
        // Followed through buttons and switches as if pressed: a lamp wired through a button is started too.
        const near = reach(world, on);
        // Both legs on one side of a switch: pressing it would run current round the gadget, not through it.
        if (near.has(off)) {
          const legs = world.wires.filter((w) => near.has(w.a) && w.b && near.has(w.b));
          const wire = world.culprit((_, cut) => !reach(world, on, cut).has(off), legs, undefined, `round:${p.id}:${on.key}`);
          if (wire) return { type: 'tapWire', wire, at: p, problem: 'bypass', phrase: 'bypass', u: clearSpot(world, wire) };
          continue;
        }
        // Which pole this side leads to: straight (or through a button), else through other gadgets in a row with it.
        const side = poleOf(world, on, p, plus, minus);
        if (!side) continue;
        const toPlus = side === 'plus';
        const far = reach(world, off);
        // The other side already goes somewhere: straight to a pole, or round through gadgets to the other pole.
        const other = poleOf(world, off, p, plus, minus);
        if (far.has(plus) || far.has(minus) || other === (toPlus ? 'minus' : 'plus')) continue;
        // A polar part already started the wrong way: undo that wire first.
        if (isPolar(p) && (on.key === 'a') !== toPlus) {
          const wire = world.wiresAt(on).at(-1);
          if (wire) return { type: 'tapWire', wire, at: p, problem: 'reversed', phrase: reversedPhrase(p), u: clearSpot(world, wire) };
        }
        // Finish from the loose end: the gadget's free leg, or the free post of a button already wired to it.
        const end = looseEnd(world, p, off, far);
        if (!end) {
          // No loose end: a button with both posts on this one side does nothing. Free one of its posts.
          const wire = world.wires.filter((w) => far.has(w.a) && w.b && far.has(w.b) && (passes(w.a.part) || passes(w.b.part))).at(-1);
          if (wire) return { type: 'tapWire', wire, at: p, problem: 'bypass', phrase: 'bypass', u: clearSpot(world, wire) };
          continue;
        }
        const phrase: PhraseId = src instanceof ButtonPanel ? 'toPair' : toPlus ? 'toMinus' : 'toPlus';
        return { type: 'connect', from: end, to: toPlus ? minus : plus, phrase };
      }
    }
  }
  // A gadget with wires on it (straight or through a button) that reach no source yet: on to "+" from its "+" side.
  const { part: src, plus, minus } = srcs[0];
  for (let i = loads.length - 1; i >= 0; i--) {
    const p = loads[i];
    if (Math.abs(p.state.level) > 0.05 || !p.terminals.some((t) => world.wiresAt(t).length)) continue;
    const [a, b] = [p.terminal('a'), p.terminal('b')];
    const near = reach(world, a);
    if (near.has(b) || srcs.some((q) => poleOf(world, a, p, q.plus, q.minus) || poleOf(world, b, p, q.plus, q.minus))) continue;
    const phrase: PhraseId = src instanceof ButtonPanel ? 'toPair' : 'toPlus';
    const fromA = looseEnd(world, p, a, near);
    if (fromA) return { type: 'connect', from: fromA, to: plus, phrase };
    const fromB = looseEnd(world, p, b, reach(world, b));
    if (fromB) return { type: 'connect', from: fromB, to: minus, phrase: src instanceof ButtonPanel ? 'toPair' : 'toMinus' };
  }
  return magnetHint(world) ?? crankHint(world) ?? beamHint(world) ?? switchHint(world);
}

/**
 * Which pole one leg of a gadget leads to: straight by wires (or through a
 * button), else on through other gadgets wired in a row with it. Null when
 * neither or both.
 */
function poleOf(world: World, leg: Terminal, p: Part, plus: Terminal, minus: Terminal): 'plus' | 'minus' | null {
  for (const side of [reach(world, leg), reach(world, leg, undefined, p)]) {
    const toPlus = side.has(plus);
    const toMinus = side.has(minus);
    if (toPlus !== toMinus) return toPlus ? 'plus' : 'minus';
    if (toPlus) return null;
  }
  return null;
}

/** Where a side of a gadget can still take a wire: its own leg if bare, else the free post of a button on that side. */
function looseEnd(world: World, p: Part, leg: Terminal, side: Set<Terminal>): Terminal | undefined {
  return world.wiresAt(leg).length ? [...side].find((t) => t.part !== p && passes(t.part) && !world.wiresAt(t).length) : leg;
}

/** A part that only opens and closes a way (a switch, a button, a sensor): current can pass it. */
const passes = (p: Part) => {
  const els = p.elements();
  return p.terminals.length === 2 && els.length === 1 && els[0].kind === 'switch';
};

/** The posts joined to `t` by wires, or through switch-like parts as if they were pressed (`cut` wires left out). */
function reach(world: World, t: Terminal, cut?: Set<Wire>, besides?: Part): Set<Terminal> {
  const seen = new Set([t]);
  const stack = [t];
  // With `besides`, through the other gadgets too (lamps in a row): which pole a side leads to, not what is joined.
  const through = (q: Part) => passes(q) || (!!besides && q !== besides && q.terminals.length === 2 && LOADS.includes(q.kind));
  while (stack.length) {
    const x = stack.pop()!;
    const next: Terminal[] = through(x.part) ? [...x.part.terminals] : [];
    for (const w of world.wires) {
      if (!w.b || cut?.has(w)) continue;
      if (w.a === x) next.push(w.b);
      else if (w.b === x) next.push(w.a);
    }
    for (const o of next) if (!seen.has(o)) seen.add(o), stack.push(o);
  }
  return seen;
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

/** A magnet has held its ball a while: show the switch that lets it go. */
function magnetHint(world: World): Hint | null {
  const m = world.parts.find((p): p is Magnet => p instanceof Magnet && p.heldFor > 1.5);
  if (!m) return null;
  const sw = world.parts.find((p) => p.kind === 'switch' && p.closed && Math.abs(p.state.current) > 0.01 && Math.abs(Math.abs(p.state.current) - Math.abs(m.state.current)) < 0.02);
  return sw ? { type: 'tap', part: sw, phrase: 'magnetOff' } : null;
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

/**
 * The wires a task's plan wants (each joining two posts of one planned
 * junction): when a problem has several possible culprits, these stay.
 */
export function plannedWires(world: World, level: Level): Set<Wire> {
  const plans = taskPlans(world, level);
  if (!plans || 'drag' in plans) return new Set();
  const pairs = plans.flatMap(({ src, chain }) => loopPlan(world, src, chain));
  const stray = new Set(strayWires(world, pairs));
  const posts = new Set(pairs.flat());
  return new Set(world.wires.filter((w) => w.b && posts.has(w.a) && posts.has(w.b) && !stray.has(w)));
}

/** Each loop of the task with its parts on the table, or what to bring first (null: nothing to plan). */
function taskPlans(world: World, level: Level): { src: Part; chain: Part[] }[] | { drag: PartKind } | null {
  const loops = level.loops ?? (level.chain.length ? [['battery' as PartKind, ...level.chain]] : []);
  if (!loops.length) return null;
  // Every part of every loop on the table first (sources may serve several loops).
  const used = new Set<Part>();
  const plans: { src: Part; chain: Part[] }[] = [];
  for (const [srcKind, ...kinds] of loops) {
    const src = world.parts.find((q) => q.kind === srcKind);
    if (!src) return { drag: srcKind };
    const chain: Part[] = [];
    for (const kind of kinds) {
      const p = world.parts.find((q) => q.kind === kind && !used.has(q));
      if (!p) return { drag: kind };
      used.add(p);
      chain.push(p);
    }
    plans.push({ src, chain });
  }
  return plans;
}

export function levelHint(world: World, level: Level, trayLeft: (k: PartKind) => number): Hint | null {
  if (level.goal(world)) return null;
  const plans = taskPlans(world, level);
  if (!plans) return null;
  if ('drag' in plans) return trayLeft(plans.drag) > 0 ? { type: 'drag', kind: plans.drag, to: freeSpot(world), phrase: 'drag' } : null;

  // A switch task where the lamp was wired straight to the battery: that wire goes.
  for (const { src, chain } of plans) {
    const sw = chain.find((p) => p.kind === 'switch');
    if (!sw || (sw.closed && Math.abs(sw.state.current) > 0.01)) continue;
    const lit = chain.find((p) => p !== sw && activeAt(p.kind, p.state.level));
    if (!lit) continue;
    const touching = world.wires.filter((w) => lit.terminals.some((t) => w.touches(t)));
    // Of its wires straight to the battery, the one the plan has going through the switch instead.
    const keep = plannedWires(world, level);
    const straight = touching.filter((w) => src.terminals.some((t) => w.touches(t)));
    const direct = straight.find((w) => !keep.has(w)) ?? straight[0] ?? touching.at(-1);
    if (direct) return { type: 'tapWire', wire: direct, at: lit, problem: 'useSwitch', phrase: 'useSwitch', u: clearSpot(world, direct) };
  }

  // A wire between posts the plan keeps apart (a leg on the wrong pole, a lamp joined to the wrong lamp):
  // adding the next planned wire would only make a short or a bypass of it, so it goes first.
  const wanted = plans.map(({ src, chain }) => loopPlan(world, src, chain));
  const wrong = strayWires(world, wanted.flat());
  if (wrong.length) {
    const wire = wrong.at(-1)!;
    return { type: 'tapWire', wire, at: wire.a.part, problem: 'wrong', phrase: 'wrongWire', u: clearSpot(world, wire) };
  }

  for (const k of plans.keys()) {
    const missing = wanted[k].find(([a, b]) => !world.wired(a, b));
    if (missing) return { type: 'connect', from: missing[0], to: missing[1], phrase: 'connect' };
  }
  return magnetHint(world) ?? crankHint(world) ?? beamHint(world) ?? switchHint(world);
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
  let bestScore = -Infinity;
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
    // Agreeing with the child's wires counts for it, a wire against it (between posts it keeps apart) against.
    const score = pairs.filter(([a, b]) => world.wired(a, b)).length * 2 - strayWires(world, pairs).length;
    if (score > bestScore) {
      bestScore = score;
      best = pairs;
    }
  }
  return best;
}

/**
 * Wires joining posts of the plan that it keeps apart: each planned pair is
 * one junction, and a wire between two different junctions is in the way.
 * Wires to parts outside the plan are the child's own business.
 */
function strayWires(world: World, pairs: [Terminal, Terminal][]): Wire[] {
  const node = new Map<Terminal, number>();
  const root = (i: number): number => (joins[i] === i ? i : (joins[i] = root(joins[i])));
  const joins: number[] = [];
  const id = (t: Terminal) => {
    let i = node.get(t);
    if (i === undefined) node.set(t, (i = joins.push(joins.length) - 1));
    return i;
  };
  for (const [a, b] of pairs) {
    const [i, j] = [id(a), id(b)];
    joins[root(i)] = root(j);
  }
  return world.wires.filter((w) => w.b && node.has(w.a) && node.has(w.b) && root(node.get(w.a)!) !== root(node.get(w.b)!));
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
