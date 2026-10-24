// A laser beam on the table, traced in 2D (x/z). Beams go along the axes;
// a mirror turns them a quarter round, anything else stops them.

/** A rectangle the beam can meet. `mirror`: 0 is "/" and 1 is "\" seen from above. */
export interface BeamBox {
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  mirror?: 0 | 1;
}

/** A round thing in the way (a rolling ball). */
export interface BeamDisc {
  id: string;
  x: number;
  z: number;
  r: number;
}

export interface BeamPath {
  /** Corners of the beam: start, each mirror, the end. */
  pts: [number, number][];
  /** What stopped it (a box or disc id), or null if it ran out of table. */
  hit: string | null;
  /** Mirrors it bounced off, in order. */
  via: string[];
}

const STEP = 0.04;

/** Bounce a direction off a mirror. */
export function reflect(dx: number, dz: number, mirror: 0 | 1): [number, number] {
  return mirror === 0 ? [-dz, -dx] : [dz, dx];
}

const inside = (b: BeamBox, x: number, z: number) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;

export function traceBeam(ox: number, oz: number, dx: number, dz: number, boxes: BeamBox[], discs: BeamDisc[] = [], maxLen = 32): BeamPath {
  const pts: [number, number][] = [[ox, oz]];
  const via: string[] = [];
  // Boxes the beam is in right now are not "entered" again (its own body, a mirror just used).
  const within = new Set(boxes.filter((b) => inside(b, ox, oz)).map((b) => b.id));
  let x = ox;
  let z = oz;
  for (let travelled = 0; travelled < maxLen; travelled += STEP) {
    x += dx * STEP;
    z += dz * STEP;
    for (const d of discs) {
      if ((x - d.x) ** 2 + (z - d.z) ** 2 < d.r * d.r) {
        pts.push([x, z]);
        return { pts, hit: d.id, via };
      }
    }
    for (const b of boxes) {
      const now = inside(b, x, z);
      if (!now) {
        within.delete(b.id);
        continue;
      }
      if (within.has(b.id)) continue;
      within.add(b.id);
      if (b.mirror === undefined) {
        pts.push([x, z]);
        return { pts, hit: b.id, via };
      }
      // Turn at the middle of the mirror.
      x = (b.x0 + b.x1) / 2;
      z = (b.z0 + b.z1) / 2;
      pts.push([x, z]);
      via.push(b.id);
      [dx, dz] = reflect(dx, dz, b.mirror);
      if (via.length > 12) return { pts, hit: null, via };
    }
  }
  pts.push([x, z]);
  return { pts, hit: null, via };
}
