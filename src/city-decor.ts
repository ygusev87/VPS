// The city's look, as data only: buildings, trees, benches, lamps and the
// lawns, laid out round the roads, the canal and the tasks of src/city.ts
// (which leaves out anything small that would stand in their way). Codex
// keeps this file; this first version is a stub with the buildings and a
// little greenery, so the new layout plays before the full dressing.
import type { DecorGroup } from './decor';

export const DECOR: DecorGroup[] = [
  { model: 'bakery', fit: { width: 7, rotateY: -Math.PI / 2 }, items: [[-12, -27, 0, 1]] },
  { model: 'school', fit: { width: 9, rotateY: -Math.PI / 2 }, items: [[11, -27.754, 0, 1]] },
  { model: 'grandma-house', fit: { width: 6.2, rotateY: -Math.PI / 2 }, items: [[-44, -27, 0, 1]] },
  { model: 'club', fit: { width: 7, rotateY: -Math.PI / 2 }, items: [[48.5, -13, 0, 1]] },
  // Kept forward enough that the roof does not hide the bell's ring behind it.
  { model: 'toy-shop', fit: { width: 6, rotateY: -Math.PI / 2 }, items: [[49.75, -22.4, 0, 0.9]] },
  { model: 'fire-station', fit: { width: 7, rotateY: -Math.PI / 2 }, items: [[29, 8, 0, 1]] },
  { model: 'house-a', fit: { width: 5, rotateY: -Math.PI / 2 }, items: [[-26, -28, 0, 1], [24, -29, 0, 1], [-50, 32.2, 0, 1], [14.5, 21, 0, 1]] },
  // East of STATION_POLE so the near roof cannot hide either terminal.
  { model: 'house-b', fit: { width: 5, rotateY: -Math.PI / 2 }, items: [[-48, -14, 0, 1], [-5.75, -33, 0, 0.9], [29, 21, 0, 1], [-14, 32, 0, 1]] },
  { model: 'house-c', fit: { width: 5, rotateY: -Math.PI / 2 }, items: [[-20, -30, 0, 1], [6, 32, 0, 1], [50, 32.2, 0, 1]] },
  { model: 'tree-oak-lite', fit: { height: 3 }, items: [[-14, -9, 0, 1], [14, -9, 0, 1], [-14, 9, 0, 0.9], [14, 9, 0, 1], [2, -9, 0, 0.9], [-52, -35, 0, 1], [52, 35, 0, 1], [-52, 12, 0, 1], [-4, 22, 0, 1], [20, 33, 0, 0.9]] },
  { model: 'bush-lite', fit: { width: 1.8 }, items: [[-10, 8.5, 0, 0.8], [10, 8.5, 0, 0.8], [-3, -8.5, 0, 0.8], [17, -6, 0, 0.8], [-17, -8, 0, 0.8]] },
  // A small planted boundary behind the tram, outside the substation work court.
  { model: 'tree-oak-lite', fit: { height: 3.6 }, items: [[-44.5, 35, 0.4, 1], [-40, 35.1, 1.3, 1], [-35.3, 35.2, -0.6, 1]] },
  { model: 'bush-lite', fit: { width: 1.6 }, items: [[-46, 35.8, 0.2, 1], [-42.5, 36.2, 0.5, 1], [-37.6, 36.1, -0.4, 1], [-33.2, 35.9, 0.3, 1]] },
  { model: 'bench', fit: { width: 1.8 }, items: [[2, -7.5, 0, 1], [-2, 7.5, Math.PI, 1]] },
];

type Rect = { x0: number; z0: number; x1: number; z1: number };
type Ellipse = { x: number; z: number; rx: number; rz: number };
/** More asphalt besides the roads: driveways, the parking lot. */
export const PATHS: { points: [number, number][]; width: number }[] = [
  { points: [[-33, -2], [-33, -9], [-45, -9]], width: 4 },
];
export const FENCES: [number, number][][] = [[[-53, 37], [-32.5, 37]]];
/** Lawns: the park and the green round the houses. */
export const SOIL: Rect[] = [
  { x0: -16.5, z0: -8.5, x1: 16.5, z1: 8.5 },
  { x0: -46.8, z0: 33.7, x1: -32.3, z1: 37.2 },
];
export const MEADOW: Ellipse[] = [];
export const PONDS: Ellipse[] = [];
