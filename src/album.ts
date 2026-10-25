// The sticker album: one sticker for every part the child has got working,
// and a few for the farm and for chain reactions. Kept on the device only.
import type { PhraseId } from './voice';
import { ALL_ITEMS, itemKey } from './parts/catalog';
import { thumb } from './thumbs';

export interface Sticker {
  id: string;
  /** Said when the sticker is tapped. */
  say: PhraseId;
  img?: string;
  emoji?: string;
}

const KEY = 'electro-table:stickers';

const SPECIAL: Sticker[] = [
  { id: 'chain', say: 'stChain', emoji: '🎳' },
  { id: 'farm:cow', say: 'stCow', emoji: '🐄' },
  { id: 'farm:pig', say: 'stPig', emoji: '🐷' },
  { id: 'farm:tractor', say: 'stTractor', emoji: '🚜' },
  { id: 'farm:sheep', say: 'stSheep', emoji: '🐑' },
  { id: 'farm:hen', say: 'stHen', emoji: '🐔' },
  { id: 'farm:rabbit', say: 'stRabbit', emoji: '🐰' },
  { id: 'farm:fox', say: 'stFox', emoji: '🦊' },
  { id: 'farm:duck', say: 'stDuck', emoji: '🦆' },
  // The farm's second day.
  { id: 'farm:kitten', say: 'stKitten', emoji: '🐱' },
  { id: 'farm:goat', say: 'stGoat', emoji: '🐐' },
  { id: 'farm:bee', say: 'stBee', emoji: '🐝' },
  { id: 'farm:horse', say: 'stHorse', emoji: '🐴' },
  { id: 'farm:puppy', say: 'stPuppy', emoji: '🐶' },
  { id: 'farm:chick', say: 'stChick', emoji: '🐣' },
  { id: 'farm:goose', say: 'stGoose', emoji: '🪿' },
  { id: 'farm:rooster', say: 'stRooster', emoji: '🐓' },
  // The city.
  { id: 'city:car', say: 'stCar', emoji: '🚗' },
  { id: 'city:tram', say: 'stTram', emoji: '🚋' },
  { id: 'city:baker', say: 'stBaker', emoji: '🥖' },
  { id: 'city:pigeon', say: 'stPigeon', emoji: '🕊️' },
  { id: 'city:grandma', say: 'stGrandma', emoji: '👵' },
  { id: 'city:kitten', say: 'stKitten', emoji: '🐱' },
  { id: 'city:kid', say: 'stKid', emoji: '🪩' },
  { id: 'city:firefighter', say: 'stFirefighter', emoji: '🚒' },
  { id: 'city:raccoon', say: 'stRaccoon', emoji: '🦝' },
  { id: 'city:school', say: 'stSchool', emoji: '🏫' },
];

export class Album {
  readonly stickers: Sticker[];
  private got: Set<string>;

  constructor() {
    this.stickers = [...ALL_ITEMS.map((i) => ({ id: itemKey(i), say: i.say })), ...SPECIAL];
    this.got = new Set(load());
  }

  /** The picture for a sticker (part thumbnails are rendered after start-up). */
  picture(s: Sticker) {
    return s.emoji ? null : (s.img ?? thumb(s.id, true));
  }

  has(id: string) {
    return this.got.has(id);
  }

  /** Give a sticker; true if it is new. Unknown ids are ignored. */
  earn(id: string): Sticker | null {
    if (this.got.has(id)) return null;
    const s = this.stickers.find((x) => x.id === id);
    if (!s) return null;
    this.got.add(id);
    save([...this.got]);
    return s;
  }

  get count() {
    return this.stickers.filter((s) => this.got.has(s.id)).length;
  }

  get total() {
    return this.stickers.length;
  }
}

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}
