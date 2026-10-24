import { describe, expect, it } from 'vitest';
import { reflect, traceBeam, type BeamBox } from './beam';

const box = (id: string, x: number, z: number, h = 0.3, mirror?: 0 | 1): BeamBox => ({ id, x0: x - h, x1: x + h, z0: z - h, z1: z + h, mirror });

describe('laser beam', () => {
  it('mirrors turn the beam a quarter round', () => {
    // "/" seen from above (z grows towards the viewer): right turns away, left turns towards.
    expect(reflect(1, 0, 0)).toEqual([-0, -1]);
    expect(reflect(-1, 0, 0)).toEqual([-0, 1]);
    expect(reflect(1, 0, 1)).toEqual([0, 1]);
    expect(reflect(0, 1, 0)).toEqual([-1, -0]);
  });

  it('stops at the first body in its way', () => {
    const p = traceBeam(0, 0, 1, 0, [box('far', 6, 0), box('near', 3, 0)]);
    expect(p.hit).toBe('near');
    expect(p.pts.at(-1)![0]).toBeCloseTo(2.7, 1);
  });

  it('goes round two mirrors to a sensor', () => {
    const p = traceBeam(0, 0, 1, 0, [box('m1', 4, 0, 0.3, 1), box('m2', 4, 4, 0.3, 0), box('sensor', -2, 4, 0.4)]);
    expect(p.via).toEqual(['m1', 'm2']);
    expect(p.hit).toBe('sensor');
  });

  it('ignores the body it starts in, and a ball blocks it', () => {
    const p = traceBeam(0, 0, 1, 0, [box('self', 0, 0, 0.5), box('t', 5, 0)], [{ id: 'ball', x: 2, z: 0.05, r: 0.14 }]);
    expect(p.hit).toBe('ball');
  });

  it('runs off the table when nothing is there', () => {
    expect(traceBeam(0, 0, 0, 1, [box('t', 5, 0)], [], 10).hit).toBeNull();
  });
});
