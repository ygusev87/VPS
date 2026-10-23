import { describe, expect, it } from 'vitest';
import { solveCircuit, type CircuitElement } from './solver';

const battery = (id = 'bat'): CircuitElement => ({ id, kind: 'battery', a: `${id}+`, b: `${id}-` });
const two = (kind: CircuitElement['kind'], id: string, extra: Partial<CircuitElement> = {}): CircuitElement => ({
  id,
  kind,
  a: `${id}.a`,
  b: `${id}.b`,
  ...extra,
});
let wid = 0;
const wire = (a: string, b: string): CircuitElement => ({ id: `w${wid++}`, kind: 'wire', a, b });

describe('solveCircuit', () => {
  it('lights a bulb in a closed loop', () => {
    const r = solveCircuit([battery(), two('bulb', 'L'), wire('bat+', 'L.a'), wire('L.b', 'bat-')]);
    const bulb = r.elements.get('L')!;
    expect(bulb.level).toBeGreaterThan(0.9);
    expect(bulb.current).toBeGreaterThan(0.25);
    expect(r.shorted.size).toBe(0);
  });

  it('keeps a bulb dark with only one wire', () => {
    const r = solveCircuit([battery(), two('bulb', 'L'), wire('bat+', 'L.a')]);
    expect(r.elements.get('L')!.level).toBeLessThan(1e-6);
  });

  it('switch gates the loop', () => {
    const els = (closed: boolean) => [
      battery(),
      two('bulb', 'L'),
      two('switch', 'S', { closed }),
      wire('bat+', 'S.a'),
      wire('S.b', 'L.a'),
      wire('L.b', 'bat-'),
    ];
    expect(solveCircuit(els(false)).elements.get('L')!.level).toBeLessThan(1e-6);
    expect(solveCircuit(els(true)).elements.get('L')!.level).toBeGreaterThan(0.9);
  });

  it('detects a short circuit', () => {
    const r = solveCircuit([battery(), two('bulb', 'L'), wire('bat+', 'bat-'), wire('bat+', 'L.a'), wire('L.b', 'bat-')]);
    expect(r.shorted.has('bat')).toBe(true);
    expect(r.elements.get('L')!.level).toBeLessThan(0.05);
  });

  it('runs a motor and reverses it with swapped wires', () => {
    const fwd = solveCircuit([battery(), two('motor', 'M'), wire('bat+', 'M.a'), wire('M.b', 'bat-')]);
    const rev = solveCircuit([battery(), two('motor', 'M'), wire('bat+', 'M.b'), wire('M.a', 'bat-')]);
    expect(fwd.elements.get('M')!.level).toBeGreaterThan(0.9);
    expect(rev.elements.get('M')!.level).toBeLessThan(-0.9);
  });

  it('LED lights only the right way round and flags the wrong way', () => {
    const ok = solveCircuit([battery(), two('led', 'D'), wire('bat+', 'D.a'), wire('D.b', 'bat-')]);
    const bad = solveCircuit([battery(), two('led', 'D'), wire('bat+', 'D.b'), wire('D.a', 'bat-')]);
    expect(ok.elements.get('D')!.level).toBeGreaterThan(0.9);
    expect(ok.elements.get('D')!.reversed).toBe(false);
    expect(bad.elements.get('D')!.level).toBe(0);
    expect(bad.elements.get('D')!.reversed).toBe(true);
  });

  it('two bulbs in series are dimmer than one', () => {
    const r = solveCircuit([
      battery(),
      two('bulb', 'L1'),
      two('bulb', 'L2'),
      wire('bat+', 'L1.a'),
      wire('L1.b', 'L2.a'),
      wire('L2.b', 'bat-'),
    ]);
    const l1 = r.elements.get('L1')!.level;
    expect(l1).toBeGreaterThan(0.15);
    expect(l1).toBeLessThan(0.4);
  });

  it('wire currents follow the loop direction', () => {
    const w1 = wire('bat+', 'L.a');
    const r = solveCircuit([battery(), two('bulb', 'L'), w1, wire('L.b', 'bat-')]);
    expect(r.elements.get(w1.id)!.current).toBeGreaterThan(0.25);
  });

  it('two batteries in series make the bulb brighter', () => {
    const r = solveCircuit([
      battery('B1'),
      battery('B2'),
      two('bulb', 'L'),
      wire('B1+', 'B2-'),
      wire('B2+', 'L.a'),
      wire('L.b', 'B1-'),
    ]);
    expect(r.elements.get('L')!.level).toBeGreaterThan(3);
  });
});
