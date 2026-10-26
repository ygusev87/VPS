// The tile puzzle of the factory (a wiring box, a pipe junction): a small
// grid of square tiles, each with a piece of wire or pipe on it; a tap turns
// a tile a quarter turn clockwise, and the way is open when the pieces join
// from the entrance on one edge to the exit on another. Pure functions, so
// the hints and the tests share them with the part.

/** The sides of a tile: north (−z), east (+x), south (+z), west (−x). */
export type Side = 0 | 1 | 2 | 3;
export type TileShape = 'straight' | 'corner' | 'tee' | 'cross' | 'blank';

/** Which sides each piece opens as drawn, before turning. */
const OPEN: Record<TileShape, Side[]> = {
  straight: [0, 2],
  corner: [0, 1],
  tee: [0, 1, 3],
  cross: [0, 1, 2, 3],
  blank: [],
};

export interface Tile {
  shape: TileShape;
  /** Quarter turns clockwise (seen from above), 0..3. */
  turns: number;
}

export interface TileGrid {
  w: number;
  h: number;
  /** Row by row from the north-west corner. */
  tiles: Tile[];
  /** Where the way comes in and where it must come out: a cell on the edge and the edge's side. */
  in: { cell: number; side: Side };
  out: { cell: number; side: Side };
}

/** Does a tile open towards this side? */
export function opens(t: Tile, side: Side): boolean {
  return OPEN[t.shape].includes((((side - t.turns) % 4) + 4) % 4 as Side);
}

const STEP: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

function neighbour(g: TileGrid, cell: number, side: Side): number | null {
  const x = (cell % g.w) + STEP[side][0];
  const y = Math.floor(cell / g.w) + STEP[side][1];
  return x < 0 || y < 0 || x >= g.w || y >= g.h ? null : y * g.w + x;
}

/** The tiles the way reaches from the entrance, and whether it gets out at the exit. */
export function flow(g: TileGrid): { lit: boolean[]; done: boolean } {
  const lit = g.tiles.map(() => false);
  if (!opens(g.tiles[g.in.cell], g.in.side)) return { lit, done: false };
  const todo = [g.in.cell];
  lit[g.in.cell] = true;
  while (todo.length) {
    const c = todo.pop()!;
    for (const side of [0, 1, 2, 3] as Side[]) {
      if (!opens(g.tiles[c], side)) continue;
      const n = neighbour(g, c, side);
      if (n === null || lit[n] || !opens(g.tiles[n], ((side + 2) % 4) as Side)) continue;
      lit[n] = true;
      todo.push(n);
    }
  }
  return { lit, done: lit[g.out.cell] && opens(g.tiles[g.out.cell], g.out.side) };
}

/** Turn one tile a quarter turn clockwise (a new grid; the old one is left as it was). */
export function turn(g: TileGrid, cell: number): TileGrid {
  return { ...g, tiles: g.tiles.map((t, i) => (i === cell ? { ...t, turns: (t.turns + 1) % 4 } : t)) };
}

/**
 * The fewest taps that open the way, as the turns each tile needs, or null if
 * no turning can. Tries every way of turning the tiles the path can use,
 * walking out from the entrance, so a 3×3 grid stays quick.
 */
export function solve(g: TileGrid): { turns: number[]; taps: number } | null {
  let best: { turns: number[]; taps: number } | null = null;
  const turns = g.tiles.map((t) => t.turns);
  const cost = (i: number, to: number) => (to - g.tiles[i].turns + 4) % 4;
  const fixed = g.tiles.map(() => false);
  const tryAll = (taps: number) => {
    if (best && taps >= best.taps) return;
    const grid: TileGrid = { ...g, tiles: g.tiles.map((t, i) => ({ ...t, turns: turns[i] })) };
    const { lit, done } = flow(grid);
    if (done) {
      best = { turns: [...turns], taps };
      return;
    }
    // Turn the next tile the way could reach: a lit cell's unfixed neighbour, or the entrance itself.
    const frontier = fixed[g.in.cell] ? lit.flatMap((on, c) => (on ? ([0, 1, 2, 3] as Side[]).map((s) => neighbour(g, c, s)) : [])).find((n) => n !== null && !fixed[n]) : g.in.cell;
    if (frontier === undefined || frontier === null) return;
    fixed[frontier] = true;
    const was = turns[frontier];
    for (let k = 0; k < 4; k++) {
      turns[frontier] = (g.tiles[frontier].turns + k) % 4;
      tryAll(taps - cost(frontier, was) + cost(frontier, turns[frontier]));
    }
    turns[frontier] = was;
    fixed[frontier] = false;
  };
  tryAll(0);
  return best;
}

/** The tile to tap next on the way to the nearest solution (null when solved or unsolvable). */
export function hintTile(g: TileGrid): number | null {
  if (flow(g).done) return null;
  const s = solve(g);
  if (!s) return null;
  const i = s.turns.findIndex((t, c) => t !== g.tiles[c].turns);
  return i < 0 ? null : i;
}

/**
 * A new puzzle: a wandering way from the entrance on the west edge to the exit
 * on the east, drawn with the right pieces, the other cells filled with
 * spare pieces, then every tile turned at random (never already solved).
 */
export function makePuzzle(w: number, h: number, rnd: () => number = Math.random): TileGrid {
  const inRow = Math.floor(rnd() * h);
  const outRow = Math.floor(rnd() * h);
  // The way: along each column, moving up or down to the next row's chosen height first.
  const path: number[] = [];
  let y = inRow;
  for (let x = 0; x < w; x++) {
    const target = x === w - 1 ? outRow : Math.floor(rnd() * h);
    path.push(y * w + x);
    while (y !== target) {
      y += target > y ? 1 : -1;
      path.push(y * w + x);
    }
  }
  const tiles: Tile[] = Array.from({ length: w * h }, () => ({ shape: (['straight', 'corner', 'corner', 'tee'] as TileShape[])[Math.floor(rnd() * 4)], turns: 0 }));
  const sideTo = (a: number, b: number): Side => (b === a - w ? 0 : b === a + 1 ? 1 : b === a + w ? 2 : 3);
  path.forEach((c, i) => {
    const sides = [i === 0 ? 3 : sideTo(c, path[i - 1]), i === path.length - 1 ? 1 : sideTo(c, path[i + 1])] as Side[];
    const straight = (sides[0] + 2) % 4 === sides[1];
    const shape: TileShape = straight ? 'straight' : 'corner';
    // Find the turn that opens exactly these two sides.
    const t = [0, 1, 2, 3].find((k) => sides.every((s) => opens({ shape, turns: k }, s)))!;
    tiles[c] = { shape, turns: t };
  });
  const g: TileGrid = { w, h, tiles, in: { cell: inRow * w, side: 3 }, out: { cell: outRow * w + w - 1, side: 1 } };
  for (let tries = 0; tries < 20; tries++) {
    const mixed: TileGrid = { ...g, tiles: g.tiles.map((t) => ({ ...t, turns: Math.floor(rnd() * 4) })) };
    if (!flow(mixed).done) return mixed;
  }
  return turn(g, path[0]);
}
