import { describe, expect, it } from 'vitest';
import { CHORDS, SONG_CHORDS, SONG_BEATS, SONG_WINDOW } from './audio';

const names = (i: number) => SONG_CHORDS[i].map((c) => CHORDS[c].name);

describe('band chords', () => {
  it('cover every window of every song', () => {
    SONG_CHORDS.forEach((ch, i) => expect(ch.length).toBe(Math.ceil(SONG_BEATS[i] / SONG_WINDOW[i])));
  });

  it('harmonise Twinkle Twinkle like the classic accompaniment', () => {
    // C C G G | A A G — F F E E | D D C
    expect(names(0).slice(0, 8)).toEqual(['C', 'C', 'F', 'C', 'F', 'C', 'G', 'C']);
  });

  it('end every song on C', () => {
    for (const ch of SONG_CHORDS) expect(ch.at(-1)).toBe(0);
  });
});
