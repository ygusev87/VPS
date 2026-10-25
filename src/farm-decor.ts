// The farm's look, as data only: buildings, trees, props, fences, paths and
// the ground's patches, laid out after the farm-v3 concept
// (assets-src/farm-v3). The farm (src/farm.ts) puts its animals, rings and
// poles on top, and leaves out anything here that would stand in their way.
// Codex keeps this file; this first version is a stub with the main
// buildings and pens, so the new layout plays before the full dressing.
import type { Fit } from './parts/assets';

/** x, z, turn about y (radians), scale on top of the group's fit. */
export type Place = [number, number, number, number];
export interface DecorGroup {
  model: string;
  fit: Fit;
  items: Place[];
}
type Rect = { x0: number; z0: number; x1: number; z1: number };
type Ellipse = { x: number; z: number; rx: number; rz: number };

export const DECOR: DecorGroup[] = [
  { model: 'barn', fit: { width: 10.5, rotateY: -Math.PI / 2 }, items: [[-14.3, -25.5, 0, 1]] },
  { model: 'coop', fit: { width: 4.6, rotateY: -Math.PI / 2 }, items: [[7.7, -22, 0, 1]] },
  { model: 'stable', fit: { width: 9, rotateY: -Math.PI / 2 }, items: [[41, -3, 0, 1]] },
  { model: 'doghouse', fit: { width: 2.6 }, items: [[-38.5, -16.5, -0.4, 1]] },
  { model: 'hutch', fit: { width: 4.5, rotateY: -Math.PI / 2 }, items: [[-44, -14.5, 0, 1]] },
  { model: 'haystack', fit: { width: 2.2 }, items: [[-6.5, -21, 0.3, 1], [-5, -23, 1.2, 0.9], [46, 22, 0.5, 1.1], [48, 24.5, 2, 1], [34, -24, 0.8, 0.9]] },
  // A few of the herd standing about (the ones that ask are the farm's own).
  { model: 'cow', fit: { width: 2.4 }, items: [[19, -2, 2.4, 1], [6, 6.5, 0.6, 0.95]] },
  { model: 'sheep', fit: { width: 1.6, rotateY: -Math.PI / 2 }, items: [[43, -30, 0.4, 1], [50, -29, 2.5, 0.95]] },
  { model: 'pig', fit: { width: 1.6 }, items: [[25, -21, 1.2, 0.9]] },
  { model: 'hen', fit: { height: 1.1 }, items: [[5, -19.5, 2, 1], [11.5, -19.5, 4, 0.9]] },
];

export const PATHS: { points: [number, number][]; width: number }[] = [
  // From the house past the barn to the yard in the middle, on to the stable and up to the sheep's fold.
  { points: [[-38, -19.5], [-14, -18], [-5, -7.5], [12, -7.5], [24, -7.5], [36, -7.5], [40, -13], [42.2, -16.5]], width: 2.6 },
  // Off it to the coop and into the pig pen.
  { points: [[10, -7.5], [9.8, -11.8]], width: 1.8 },
  { points: [[19, -7.5], [19, -17.7], [21, -17.7]], width: 1.8 },
  // Down the middle from the yard to the garden.
  { points: [[-5, -7.5], [-3, 4], [-1, 15]], width: 2.4 },
  // West along the goats' fence to the dog and the rabbits, and down past the pond.
  { points: [[-5, -7.5], [-14, -5.2], [-27, -5.2], [-36, -4], [-47, -4]], width: 2.2 },
  { points: [[-27, -5.2], [-28.5, 1], [-29, 11.5]], width: 1.8 },
  // Along the garden: the geese, the bees, the beds, to the field's gate, the horses and the tractor's shed.
  { points: [[-29, 11.5], [-13, 13], [-1, 15], [21, 14], [30, 13], [40, 17.5], [44, 21]], width: 2.4 },
  { points: [[30, 13], [31.5, 6]], width: 1.8 },
  // The tractor's way through the gate into the field.
  { points: [[30, 11], [30, 21]], width: 2.2 },
];

export const FENCES: [number, number][][] = [
  // The cows' pasture, its gate on the north side.
  [[11, -5.5], [2, -5.5], [2, 9.5], [24, 9.5], [24, -5.5], [13.5, -5.5]],
  // The pig pen, open to the yard on the west.
  [[19.5, -16.2], [19.5, -10], [33.5, -10], [33.5, -27], [19.5, -27], [19.5, -19.2]],
  // The wheat field, its gate on the north (the farm's gate stands in the gap).
  [[29, 17], [23, 17], [23, 34.5], [35, 34.5], [35, 17], [31, 17]],
  // The goats' yard, open on the north.
  [[-16.5, -3.5], [-25, -3.5], [-25, 8.5], [-10, 8.5], [-10, -3.5], [-13.5, -3.5]],
  // The horses' paddock, open on the west.
  [[33, 7.5], [33, 15.5], [50, 15.5], [50, 4], [33, 4], [33, 5]],
  // The sheep's fold on the hill, open on the south.
  [[41, -16.5], [36, -16.5], [36, -34], [53, -34], [53, -16.5], [43.5, -16.5]],
];

export const SOIL: Rect[] = [
  { x0: 23.5, z0: 17.5, x1: 34.5, z1: 34 },
  // The garden's beds, two rows of three.
  { x0: -9, z0: 18, x1: -1.5, z1: 24.5 }, { x0: 0, z0: 18, x1: 7.5, z1: 24.5 }, { x0: 9, z0: 18, x1: 16.5, z1: 24.5 },
  { x0: -9, z0: 26, x1: -1.5, z1: 32.5 }, { x0: 0, z0: 26, x1: 7.5, z1: 32.5 }, { x0: 9, z0: 26, x1: 16.5, z1: 32.5 },
];
export const MUD: Ellipse[] = [{ x: 27, z: -20, rx: 4.5, rz: 3 }];
export const MEADOW: Ellipse[] = [{ x: 44, z: -26, rx: 11, rz: 8 }, { x: 13, z: 2, rx: 12, rz: 7 }];
export const PONDS: Ellipse[] = [{ x: -40, z: 3.5, rx: 7.5, rz: 5 }];
