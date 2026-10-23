// Missions. Positions are fractions of the mat half-size, so they fit any
// screen shape. `chain` describes the loop the hints steer towards:
// battery "+" → chain[0] → chain[1] → … → battery "−".
import type { Part, PartKind } from './parts/base';
import { isActive, type World } from './world';
import type { PhraseId } from './voice';

export interface LevelPart {
  kind: PartKind;
  fx: number;
  fz: number;
  closed?: boolean;
}

export interface Level {
  id: string;
  /** Part shown on the mission card and level picker. */
  icon: PartKind;
  parts: LevelPart[];
  /** Parts offered in the tray; Infinity for free play. */
  tray: { kind: PartKind; count: number }[];
  chain: PartKind[];
  intro: PhraseId;
  winPhrase: PhraseId;
  goal(world: World): boolean;
}

const active = (w: World, kind: PartKind) => w.parts.filter((p) => p.kind === kind && isActive(p));
const carries = (p: Part) => p.closed && Math.abs(p.state.current) > 0.05;
const switchInLoop = (w: World) => w.parts.some((p) => p.kind === 'switch' && carries(p));

export const LEVELS: Level[] = [
  {
    id: 'bulb',
    icon: 'bulb',
    parts: [
      { kind: 'battery', fx: -0.45, fz: 0.15 },
      { kind: 'bulb', fx: 0.45, fz: -0.1 },
    ],
    tray: [],
    chain: ['bulb'],
    intro: 'l1',
    winPhrase: 'winBulb',
    goal: (w) => active(w, 'bulb').length > 0,
  },
  {
    id: 'fan',
    icon: 'fan',
    parts: [
      { kind: 'battery', fx: -0.45, fz: 0.2 },
      { kind: 'fan', fx: 0.45, fz: -0.1 },
    ],
    tray: [],
    chain: ['fan'],
    intro: 'l2',
    winPhrase: 'winFan',
    goal: (w) => active(w, 'fan').length > 0,
  },
  {
    id: 'switch',
    icon: 'switch',
    parts: [
      { kind: 'battery', fx: -0.5, fz: 0.35 },
      { kind: 'switch', fx: 0.0, fz: -0.35 },
      { kind: 'bulb', fx: 0.55, fz: 0.25 },
    ],
    tray: [],
    chain: ['switch', 'bulb'],
    intro: 'l3',
    winPhrase: 'winBulb',
    goal: (w) => active(w, 'bulb').length > 0 && switchInLoop(w),
  },
  {
    id: 'led',
    icon: 'led',
    parts: [
      { kind: 'battery', fx: -0.45, fz: 0.2 },
      { kind: 'led', fx: 0.45, fz: -0.15 },
    ],
    tray: [],
    chain: ['led'],
    intro: 'l4',
    winPhrase: 'winLed',
    goal: (w) => active(w, 'led').length > 0,
  },
  {
    id: 'buzzer',
    icon: 'buzzer',
    parts: [
      { kind: 'battery', fx: -0.5, fz: 0.35 },
      { kind: 'switch', fx: 0.05, fz: -0.4 },
      { kind: 'buzzer', fx: 0.55, fz: 0.2 },
    ],
    tray: [],
    chain: ['switch', 'buzzer'],
    intro: 'l5',
    winPhrase: 'winBuzz',
    goal: (w) => active(w, 'buzzer').length > 0 && switchInLoop(w),
  },
  {
    id: 'two-bulbs',
    icon: 'bulb',
    parts: [{ kind: 'battery', fx: -0.5, fz: 0.25 }],
    tray: [{ kind: 'bulb', count: 2 }],
    chain: ['bulb', 'bulb'],
    intro: 'l6',
    winPhrase: 'winBulb',
    goal: (w) => active(w, 'bulb').length >= 2,
  },
  {
    id: 'fan-bulb',
    icon: 'fan',
    parts: [
      { kind: 'battery', fx: -0.55, fz: 0.35 },
      { kind: 'switch', fx: -0.05, fz: -0.45 },
    ],
    tray: [
      { kind: 'bulb', count: 1 },
      { kind: 'fan', count: 1 },
    ],
    chain: ['switch', 'bulb', 'fan'],
    intro: 'l7',
    winPhrase: 'win',
    goal: (w) => active(w, 'bulb').length > 0 && active(w, 'fan').length > 0 && switchInLoop(w),
  },
];

export const FREE_PLAY: Level = {
  id: 'free',
  icon: 'battery',
  parts: [],
  tray: (['battery', 'bulb', 'fan', 'switch', 'led', 'buzzer'] as PartKind[]).map((kind) => ({ kind, count: Infinity })),
  chain: [],
  intro: 'free',
  winPhrase: 'win',
  goal: () => false,
};
