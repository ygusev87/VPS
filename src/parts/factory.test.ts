import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Part } from './base';
import { fitGear, turnGears, type Geared } from './factory';

/** A stand-in gear: just where its axle is, its size, and (for a motor) its own turning. */
function gear(x: number, z: number, r: number, drive?: number) {
  const root = new THREE.Object3D();
  root.position.set(x, 0, z);
  const g: Geared & { root: THREE.Object3D } = {
    root,
    gearR: r,
    turn: 0,
    gearAt: (out = new THREE.Vector3()) => out.copy(root.position),
    ...(drive !== undefined ? { drive: () => drive } : {}),
  };
  return g as unknown as Part & Geared;
}

describe('gears', () => {
  it('pass the turning on through meshed teeth, each the other way, slower when bigger', () => {
    const motor = gear(0, 0, 0.6, 2);
    const small = gear(1.2, 0, 0.6);
    const big = gear(2.8, 0, 1);
    turnGears([motor, small, big]);
    expect(small.turn).toBeCloseTo(-2);
    expect(big.turn).toBeCloseTo(1.2);
  });

  it('leave a gear alone whose teeth do not reach', () => {
    const motor = gear(0, 0, 0.6, 2);
    const far = gear(2, 0, 0.6);
    turnGears([motor, far]);
    expect(far.turn).toBe(0);
  });

  it('do not turn without a motor going', () => {
    const motor = gear(0, 0, 0.6, 0);
    const small = gear(1.2, 0, 0.6);
    turnGears([motor, small]);
    expect(small.turn).toBe(0);
  });

  it('slide a gear let go nearby into mesh', () => {
    const motor = gear(0, 0, 0.6, 2);
    const loose = gear(1.6, 0.3, 0.6);
    expect(fitGear(loose, [motor, loose])).toBe(true);
    const p = (loose as unknown as { root: THREE.Object3D }).root.position;
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(1.2);
    turnGears([motor, loose]);
    expect(loose.turn).toBeCloseTo(-2);
  });
});
