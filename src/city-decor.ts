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
  { model: 'house-a', fit: { width: 5, rotateY: -Math.PI / 2 }, items: [[-26, -28, 0, 1], [24, -29, 0, 1], [-50, 32.2, Math.PI, 1], [14.5, 21, 0, 1]] },
  // East of STATION_POLE so the near roof cannot hide either terminal.
  { model: 'house-b', fit: { width: 5, rotateY: -Math.PI / 2 }, items: [[-48, -14, 0, 1], [-5.75, -33, 0, 0.9], [29, 21, 0, 1], [-14, 32, 0, 1]] },
  { model: 'house-c', fit: { width: 5, rotateY: -Math.PI / 2 }, items: [[-20, -30, 0, 1], [6, 32, 0, 1], [50, 32.2, 0, 1]] },
  { model: 'tree-oak-lite', fit: { height: 3 }, items: [[-14, -9, 0, 1], [14, -9, 0, 1], [-14, 9, 0, 0.9], [14, 9, 0, 1], [2, -9, 0, 0.9], [-52, -35, 0, 1], [53.8, 35, 0, 1], [-52, 12, 0, 1], [-4, 22, 0, 1], [20, 33, 0, 0.9]] },
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
  { x0: -51.9, z0: -36.2, x1: -48.5, z1: -17.21883 },
  { x0: -51.9, z0: -10.78117, x1: -48.5, z1: -4.35 },
  { x0: -54, z0: 4.35, x1: -48, z1: 23.65 },
  { x0: -48, z0: -36.2, x1: -41.55, z1: -30.77973 },
  { x0: -29.9, z0: -36.2, x1: -24.5, z1: -31.34197 },
  { x0: -35.65, z0: -36.2, x1: -31.55, z1: -30.45 },
  { x0: -35.65, z0: -20.05, x1: -31.55, z1: -16.2 },
  { x0: -40.04999, z0: -22.45, x1: -36.95, z1: -16.2 },
  { x0: -22.1, z0: -36.2, x1: -16.90001, z1: -33.15825 },
  { x0: -14.95, z0: -36.2, x1: -9.4, z1: -30.70838 },
  { x0: 27.9, z0: -36.2, x1: 33.79999, z1: -16.2 },
  { x0: 24.35, z0: -36.2, x1: 26.95, z1: -32.34197 },
  { x0: 5.10001, z0: -36.2, x1: 14.05, z1: -31.6168 },
  { x0: 5.10001, z0: -23.8912, x1: 9.35, z1: -16.35001 },
  { x0: 21.05, z0: -36.2, x1: 24.35, z1: -32.34197 },
  { x0: 16.90001, z0: -36.2, x1: 19.95, z1: -24.95 },
  { x0: 14.05, z0: -36.2, x1: 16.9, z1: -31.6168 },
  { x0: 40.20001, z0: -36.2, x1: 43.25, z1: -14.45 },
  { x0: -42.35, z0: -16.2, x1: -36.35, z1: -12.35001 },
  { x0: -36.34999, z0: -16.2, x1: -29.65, z1: -12.35001 },
  { x0: -48, z0: 4.35, x1: -40.95, z1: 23.65 },
  { x0: -30.55, z0: 4.35, x1: -28.05, z1: 14.05 },
  { x0: -22.5, z0: 16.35001, x1: -4.5, z1: 23.65 },
  { x0: 4.5, z0: 20.45, x1: 7.55, z1: 23.65 },
  { x0: 18.40001, z0: 16.35001, x1: 21.05, z1: 23.65 },
  { x0: 46.95, z0: 11.55, x1: 51.55, z1: 23.65 },
  { x0: 43.35, z0: 16.95, x1: 46.45, z1: 23.65 },
  { x0: -20.55, z0: 30.35, x1: -17.90001, z1: 36.5 },
  { x0: -10.1, z0: 30.35, x1: -4.5, z1: 36.5 },
  { x0: -46.1, z0: 30.35, x1: -33.55, z1: 33.15 },
  { x0: 9.9, z0: 30.35, x1: 46.1, z1: 36.5 },
];
export const MEADOW: Ellipse[] = [];
export const PONDS: Ellipse[] = [];
