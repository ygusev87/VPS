// Circuit solver: nodal analysis over two-terminal elements.
//
// Every part terminal is its own node; wires are tiny resistors between
// terminals, so each wire gets its own current (used for the flow animation).
// Batteries and lit LEDs are stamped as Norton equivalents, so the whole
// circuit stays a plain conductance matrix G·V = I.

export type ElementKind = 'battery' | 'bulb' | 'motor' | 'led' | 'switch' | 'buzzer' | 'wire';

export interface CircuitElement {
  id: string;
  kind: ElementKind;
  /** Terminal ids. For batteries a is "+", for LEDs and buzzers a is the anode. */
  a: string;
  b: string;
  /** Switches only. */
  closed?: boolean;
  /** Battery voltage override (a bigger pack). */
  emf?: number;
  /** Resistance override: internal for batteries, body for loads. */
  r?: number;
}

export interface ElementResult {
  /** Current flowing a → b through the element, amperes. */
  current: number;
  /** V(a) − V(b), volts. */
  voltage: number;
  /** 0..1 (and a bit above when overdriven): how hard the part is working. */
  level: number;
  /** LED/buzzer is wired backwards inside a live loop. */
  reversed: boolean;
}

export interface CircuitResult {
  elements: Map<string, ElementResult>;
  nodeVoltage: Map<string, number>;
  /** Battery ids whose terminals are shorted (huge current, nothing useful lit). */
  shorted: Set<string>;
}

export const PARAMS = {
  battery: { emf: 3, rInt: 0.5 },
  bulb: { r: 10 },
  motor: { r: 8 },
  led: { vf: 1.8, r: 60 },
  buzzer: { vf: 1.2, r: 40 },
  switch: { rClosed: 0.005 },
  wire: { r: 0.01 },
  /** Battery current above this counts as a short circuit. */
  shortCurrent: 1.5,
} as const;

// Nominal currents/powers with one fresh battery, for normalising `level`.
const NOMINAL = {
  bulbPower: (PARAMS.battery.emf / (PARAMS.bulb.r + PARAMS.battery.rInt)) ** 2 * PARAMS.bulb.r,
  motorCurrent: PARAMS.battery.emf / (PARAMS.motor.r + PARAMS.battery.rInt),
  ledCurrent: (PARAMS.battery.emf - PARAMS.led.vf) / (PARAMS.led.r + PARAMS.battery.rInt),
  buzzerCurrent: (PARAMS.battery.emf - PARAMS.buzzer.vf) / (PARAMS.buzzer.r + PARAMS.battery.rInt),
};

const GMIN = 1e-9;

type Stamp = { g: number; src: number }; // I(a→b) = g·(Va − Vb) − src

function diodeParams(kind: 'led' | 'buzzer') {
  return kind === 'led' ? PARAMS.led : PARAMS.buzzer;
}

export function solveCircuit(elements: CircuitElement[]): CircuitResult {
  const nodeIndex = new Map<string, number>();
  const idx = (t: string) => {
    let i = nodeIndex.get(t);
    if (i === undefined) {
      i = nodeIndex.size;
      nodeIndex.set(t, i);
    }
    return i;
  };
  for (const e of elements) {
    idx(e.a);
    idx(e.b);
  }
  const n = nodeIndex.size;

  // Diodes start off; iterate until their on/off states are consistent.
  const diodeOn = new Map<string, boolean>();
  for (const e of elements) if (e.kind === 'led' || e.kind === 'buzzer') diodeOn.set(e.id, false);

  const stampFor = (e: CircuitElement): Stamp | null => {
    switch (e.kind) {
      case 'battery': {
        const r = e.r ?? PARAMS.battery.rInt;
        return { g: 1 / r, src: (e.emf ?? PARAMS.battery.emf) / r };
      }
      case 'bulb':
        return { g: 1 / (e.r ?? PARAMS.bulb.r), src: 0 };
      case 'motor':
        return { g: 1 / (e.r ?? PARAMS.motor.r), src: 0 };
      case 'wire':
        return { g: 1 / PARAMS.wire.r, src: 0 };
      case 'switch':
        return e.closed ? { g: 1 / PARAMS.switch.rClosed, src: 0 } : null;
      case 'led':
      case 'buzzer': {
        if (!diodeOn.get(e.id)) return null;
        const p = diodeParams(e.kind);
        return { g: 1 / p.r, src: p.vf / p.r };
      }
    }
  };

  let v: Float64Array = new Float64Array(n);
  for (let iter = 0; iter < 12; iter++) {
    const G = Array.from({ length: n }, () => new Float64Array(n));
    const I = new Float64Array(n);
    for (let i = 0; i < n; i++) G[i][i] += GMIN;
    for (const e of elements) {
      const s = stampFor(e);
      if (!s) continue;
      const a = nodeIndex.get(e.a)!;
      const b = nodeIndex.get(e.b)!;
      if (a === b) continue;
      G[a][a] += s.g;
      G[b][b] += s.g;
      G[a][b] -= s.g;
      G[b][a] -= s.g;
      // Current leaving a through the element is g(Va−Vb) − src, so src
      // moves to the right-hand side as an injection into a.
      I[a] += s.src;
      I[b] -= s.src;
    }
    v = gaussSolve(G, I);

    let changed = false;
    for (const e of elements) {
      if (e.kind !== 'led' && e.kind !== 'buzzer') continue;
      const p = diodeParams(e.kind);
      const vd = v[nodeIndex.get(e.a)!] - v[nodeIndex.get(e.b)!];
      const on = diodeOn.get(e.id)!;
      if (!on && vd > p.vf + 1e-6) {
        diodeOn.set(e.id, true);
        changed = true;
      } else if (on && vd < p.vf - 1e-6) {
        diodeOn.set(e.id, false);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const results = new Map<string, ElementResult>();
  const shorted = new Set<string>();
  const nodeVoltage = new Map<string, number>();
  for (const [t, i] of nodeIndex) nodeVoltage.set(t, v[i]);

  for (const e of elements) {
    const va = v[nodeIndex.get(e.a)!];
    const vb = v[nodeIndex.get(e.b)!];
    const s = stampFor(e);
    const current = s ? s.g * (va - vb) - s.src : 0;
    const voltage = va - vb;
    let level = 0;
    let reversed = false;
    switch (e.kind) {
      case 'bulb':
        level = (current * current * (e.r ?? PARAMS.bulb.r)) / NOMINAL.bulbPower;
        break;
      case 'motor':
        level = current / NOMINAL.motorCurrent; // signed: negative spins backwards
        break;
      case 'led':
        level = Math.max(0, current) / NOMINAL.ledCurrent;
        reversed = -voltage > PARAMS.led.vf;
        break;
      case 'buzzer':
        level = Math.max(0, current) / NOMINAL.buzzerCurrent;
        reversed = -voltage > PARAMS.buzzer.vf;
        break;
      case 'battery':
        // Battery current flows out of "+" externally, i.e. b → a inside.
        level = -current / PARAMS.shortCurrent;
        if (-current > PARAMS.shortCurrent) shorted.add(e.id);
        break;
    }
    results.set(e.id, { current, voltage, level, reversed });
  }

  return { elements: results, nodeVoltage, shorted };
}

/** Gaussian elimination with partial pivoting; A and b are consumed. */
function gaussSolve(A: Float64Array[], b: Float64Array): Float64Array {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (piv !== col) {
      [A[col], A[piv]] = [A[piv], A[col]];
      [b[col], b[piv]] = [b[piv], b[col]];
    }
    const d = A[col][col];
    if (Math.abs(d) < 1e-300) continue;
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = Math.abs(A[r][r]) < 1e-300 ? 0 : s / A[r][r];
  }
  return x;
}
