import { describe, expect, it } from 'vitest';
import { flow, hintTile, makePuzzle, opens, solve, turn, type TileGrid } from './tiles';

/** A seeded random, so puzzles repeat. */
function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('tile puzzle', () => {
  it('turns pieces clockwise', () => {
    expect(opens({ shape: 'corner', turns: 0 }, 0)).toBe(true);
    expect(opens({ shape: 'corner', turns: 0 }, 1)).toBe(true);
    // A quarter turn clockwise: north-east becomes east-south.
    expect(opens({ shape: 'corner', turns: 1 }, 1)).toBe(true);
    expect(opens({ shape: 'corner', turns: 1 }, 2)).toBe(true);
    expect(opens({ shape: 'corner', turns: 1 }, 0)).toBe(false);
  });

  it('opens a straight way across', () => {
    const g: TileGrid = { w: 2, h: 1, tiles: [{ shape: 'straight', turns: 1 }, { shape: 'straight', turns: 1 }], in: { cell: 0, side: 3 }, out: { cell: 1, side: 1 } };
    expect(flow(g).done).toBe(true);
    expect(flow(turn(g, 1)).done).toBe(false);
    expect(flow(turn(g, 1)).lit).toEqual([true, false]);
  });

  it('solves with the fewest taps and hints the first tile to turn', () => {
    const g: TileGrid = { w: 2, h: 1, tiles: [{ shape: 'straight', turns: 0 }, { shape: 'straight', turns: 1 }], in: { cell: 0, side: 3 }, out: { cell: 1, side: 1 } };
    expect(solve(g)?.taps).toBe(1);
    expect(hintTile(g)).toBe(0);
    expect(hintTile(turn(g, 0))).toBe(null);
  });

  it('makes puzzles that start broken and can be solved by tapping the hinted tiles', () => {
    for (let s = 1; s < 40; s++) {
      for (const [w, h] of [[2, 2], [3, 3], [3, 2]]) {
        let g = makePuzzle(w, h, seeded(s));
        expect(flow(g).done).toBe(false);
        const plan = solve(g);
        expect(plan).not.toBeNull();
        let taps = 0;
        for (let hint = hintTile(g); hint !== null; hint = hintTile(g)) {
          g = turn(g, hint);
          taps++;
          expect(taps).toBeLessThanOrEqual(plan!.taps);
        }
        expect(flow(g).done).toBe(true);
      }
    }
  });
});
