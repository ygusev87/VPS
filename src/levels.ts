// Missions. Positions are fractions of the mat half-size, so they fit any
// screen shape. `chain` describes the loop the hints steer towards:
// battery "+" → chain[0] → chain[1] → … → battery "−".
import type { Part, PartKind } from './parts/base';
import { ALL_KINDS } from './parts/catalog';
import { isActive, type World } from './world';
import type { PhraseId } from './voice';

export interface LevelPart {
  kind: PartKind;
  fx: number;
  fz: number;
  closed?: boolean;
  /** Launcher or laser: which way it points at the start (0 right, 1 towards the viewer, 2 left, 3 away). */
  aim?: number;
  /** Mirror: 0 "/" or 1 "\\" seen from above. */
  side?: 0 | 1;
}

export interface Level {
  id: string;
  /** Short name on the lesson card (for grown-ups; the child goes by the picture). */
  title: string;
  /** What to do, shown on the mission card. */
  task: string;
  /** Part shown on the mission card and level picker. */
  icon: PartKind;
  parts: LevelPart[];
  /** Parts offered in the tray; Infinity for free play. */
  tray: { kind: PartKind; count: number }[];
  chain: PartKind[];
  /**
   * Several circuits, each from its own source: [source kind, ...series parts].
   * Overrides `chain` (which means one loop from the battery).
   */
  loops?: PartKind[][];
  /** Free building with free-play hints (no fixed plan). */
  sandbox?: boolean;
  /** Keep the layout as drawn on tall screens too (parts that face each other). */
  fixed?: boolean;
  intro: PhraseId;
  winPhrase: PhraseId;
  goal(world: World): boolean;
}

const active = (w: World, kind: PartKind) => w.parts.filter((p) => p.kind === kind && isActive(p));
const carries = (p: Part) => p.closed && Math.abs(p.state.current) > 0.01;
const switchInLoop = (w: World) => w.parts.some((p) => p.kind === 'switch' && carries(p));
/** A part of this kind is closed and current runs through it (a sensor, target, dominoes). */
const through = (w: World, kind: PartKind) => w.parts.some((p) => p.kind === kind && carries(p));
const TRIGGERS: PartKind[] = ['target', 'domino', 'lightSensor', 'button'];
/**
 * A chain works: something switched on by another part (a ball, light, wind),
 * not by a finger, now powers a working gadget.
 */
export function chainWorks(w: World): boolean {
  const fired = w.parts.some((p) => TRIGGERS.includes(p.kind) && p.triggered === 'world' && carries(p)) || feeding(w, 'windGen');
  return fired && w.parts.some((p) => p.kind !== 'launcher' && p.kind !== 'laser' && isActive(p));
}
/** A generator of this kind is delivering current. */
const feeding = (w: World, kind: PartKind) => w.parts.some((p) => p.kind === kind && Math.abs(p.state.current) > 0.01);

export const LEVELS: Level[] = [
  {
    id: 'bulb',
    title: 'Лампочка',
    task: 'Зажги лампочку',
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
    title: 'Вентилятор',
    task: 'Включи вентилятор',
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
    title: 'Выключатель',
    task: 'Включи свет выключателем',
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
    title: 'Светодиод',
    task: 'Зажги светодиод',
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
    title: 'Пищалка',
    task: 'Запусти пищалку',
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
    // The switch is there to try, but a buzzer that beeps is a buzzer that beeps.
    goal: (w) => active(w, 'buzzer').length > 0,
  },
  {
    id: 'two-bulbs',
    title: 'Две лампы',
    task: 'Зажги две лампочки',
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
    title: 'Лампа и мотор',
    task: 'Включи лампу и вентилятор',
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
  {
    id: 'wind-gen',
    title: 'Ветряк',
    task: 'Ветер от вентилятора зажжёт светодиод',
    icon: 'windGen',
    fixed: true,
    parts: [
      { kind: 'battery', fx: -0.72, fz: -0.3 },
      { kind: 'fan', fx: -0.22, fz: -0.32 },
      { kind: 'windGen', fx: -0.22, fz: 0.3 },
      { kind: 'led', fx: 0.45, fz: 0.3 },
    ],
    tray: [],
    chain: [],
    loops: [
      ['battery', 'fan'],
      ['windGen', 'led'],
    ],
    intro: 'l8',
    winPhrase: 'winChain',
    goal: (w) => active(w, 'led').length > 0 && feeding(w, 'windGen'),
  },
  {
    id: 'light-sensor',
    title: 'Фотодатчик',
    task: 'Свет лампы включит вентилятор',
    icon: 'lightSensor',
    fixed: true,
    parts: [
      { kind: 'battery', fx: -0.68, fz: 0.15 },
      { kind: 'bulb', fx: -0.1, fz: -0.38 },
      { kind: 'lightSensor', fx: 0.25, fz: -0.38 },
      { kind: 'fan', fx: 0.55, fz: 0.32 },
    ],
    tray: [],
    chain: [],
    loops: [
      ['battery', 'bulb'],
      ['battery', 'lightSensor', 'fan'],
    ],
    intro: 'l9',
    winPhrase: 'winChain',
    goal: (w) => active(w, 'fan').length > 0 && through(w, 'lightSensor'),
  },
  {
    id: 'target',
    title: 'Мишень',
    task: 'Попади шариком в мишень',
    icon: 'target',
    fixed: true,
    parts: [
      { kind: 'battery', fx: -0.7, fz: 0.38 },
      { kind: 'launcher', fx: -0.55, fz: -0.35 },
      { kind: 'target', fx: 0.45, fz: -0.35 },
      { kind: 'buzzer', fx: 0.55, fz: 0.4 },
    ],
    tray: [],
    chain: [],
    loops: [
      ['battery', 'launcher'],
      ['battery', 'target', 'buzzer'],
    ],
    intro: 'l10',
    winPhrase: 'winChain',
    goal: (w) => active(w, 'buzzer').length > 0 && through(w, 'target'),
  },
  {
    id: 'domino',
    title: 'Домино',
    task: 'Шарик, домино и лампочка',
    icon: 'domino',
    fixed: true,
    parts: [
      { kind: 'battery', fx: -0.72, fz: 0.38 },
      { kind: 'launcher', fx: -0.62, fz: -0.35 },
      { kind: 'domino', fx: 0.25, fz: -0.35 },
      { kind: 'bulb', fx: 0.55, fz: 0.38 },
    ],
    tray: [],
    chain: [],
    loops: [
      ['battery', 'launcher'],
      ['battery', 'domino', 'bulb'],
    ],
    intro: 'l11',
    winPhrase: 'winChain',
    goal: (w) => active(w, 'bulb').length > 0 && through(w, 'domino'),
  },
  {
    id: 'big-chain',
    title: 'Большая цепочка',
    task: 'Ветер → ветряк → пушка → мишень → лампа',
    icon: 'launcher',
    fixed: true,
    parts: [
      { kind: 'battery', fx: -0.98, fz: -0.45 },
      { kind: 'fan', fx: -0.5, fz: -0.5 },
      { kind: 'windGen', fx: -0.5, fz: 0.2 },
      { kind: 'launcher', fx: -0.1, fz: 0.56 },
      { kind: 'target', fx: 0.75, fz: 0.56 },
      { kind: 'bulb', fx: 0.7, fz: -0.42 },
    ],
    tray: [],
    chain: [],
    loops: [
      ['battery', 'fan'],
      ['windGen', 'launcher'],
      ['battery', 'target', 'bulb'],
    ],
    intro: 'l12',
    winPhrase: 'winChain',
    goal: (w) => active(w, 'bulb').length > 0 && through(w, 'target') && feeding(w, 'windGen'),
  },
  {
    id: 'laser',
    title: 'Лазер и зеркало',
    task: 'Направь луч зеркалом на датчик',
    icon: 'laser',
    fixed: true,
    parts: [
      { kind: 'battery', fx: -0.9, fz: 0.42 },
      { kind: 'laser', fx: -0.55, fz: -0.32, aim: 0 },
      { kind: 'mirror', fx: 0.35, fz: -0.32, side: 0 },
      { kind: 'lightSensor', fx: 0.35, fz: 0.45 },
      { kind: 'bulb', fx: 0.85, fz: 0.15 },
    ],
    tray: [],
    chain: [],
    loops: [
      ['battery', 'laser'],
      ['battery', 'lightSensor', 'bulb'],
    ],
    intro: 'l13',
    winPhrase: 'winChain',
    goal: (w) => active(w, 'bulb').length > 0 && through(w, 'lightSensor'),
  },
  {
    id: 'two-mirrors',
    title: 'Два зеркала',
    task: 'Проведи луч через два зеркала',
    icon: 'mirror',
    fixed: true,
    parts: [
      { kind: 'battery', fx: -0.95, fz: -0.05 },
      { kind: 'laser', fx: -0.55, fz: -0.45, aim: 0 },
      { kind: 'mirror', fx: 0.5, fz: -0.45, side: 0 },
      { kind: 'mirror', fx: 0.5, fz: 0.45, side: 1 },
      { kind: 'lightSensor', fx: -0.3, fz: 0.45 },
      { kind: 'bulb', fx: 0.95, fz: 0.0 },
    ],
    tray: [],
    chain: [],
    loops: [
      ['battery', 'laser'],
      ['battery', 'lightSensor', 'bulb'],
    ],
    intro: 'l14',
    winPhrase: 'winChain',
    goal: (w) => active(w, 'bulb').length > 0 && through(w, 'lightSensor'),
  },
  {
    id: 'belt',
    title: 'Транспортёр',
    task: 'Шарик, транспортёр, мишень и звонок',
    icon: 'belt',
    fixed: true,
    parts: [
      { kind: 'battery', fx: -0.95, fz: -0.45 },
      { kind: 'launcher', fx: -0.45, fz: -0.5, aim: 1 },
      { kind: 'belt', fx: -0.3, fz: 0.12 },
      { kind: 'target', fx: 0.09, fz: 0.12 },
      { kind: 'bell', fx: 0.65, fz: -0.4 },
    ],
    tray: [],
    chain: [],
    loops: [
      ['battery', 'launcher'],
      ['battery', 'belt'],
      ['battery', 'target', 'bell'],
    ],
    intro: 'l15',
    winPhrase: 'winChain',
    goal: (w) => active(w, 'bell').length > 0 && through(w, 'target'),
  },
  {
    id: 'workshop',
    title: 'Мастерская цепочек',
    task: 'Собери свою цепочку',
    icon: 'domino',
    sandbox: true,
    parts: [
      { kind: 'battery', fx: -0.6, fz: 0.3 },
      { kind: 'launcher', fx: -0.55, fz: -0.35 },
      { kind: 'domino', fx: 0.2, fz: -0.35 },
      { kind: 'bell', fx: 0.6, fz: 0.3 },
    ],
    tray: [
      ...(['battery', 'bigBattery', 'switch', 'bulb', 'led', 'fan', 'buzzer', 'windGen', 'lightSensor', 'launcher', 'target', 'domino', 'laser', 'mirror', 'belt', 'bell', 'drum', 'xylophone', 'pinwheel'] as PartKind[]).map((kind) => ({ kind, count: Infinity })),
    ],
    chain: [],
    intro: 'l16',
    winPhrase: 'chainWow',
    goal: chainWorks,
  },
];

export const FREE_PLAY: Level = {
  id: 'free',
  title: 'Свободно',
  task: 'Собирай что хочешь',
  icon: 'battery',
  // A starter pair so the table is never empty; everything can be moved or thrown away.
  parts: [
    { kind: 'battery', fx: -0.4, fz: 0.15 },
    { kind: 'bulb', fx: 0.4, fz: -0.1 },
  ],
  tray: ALL_KINDS.map((kind) => ({ kind, count: Infinity })),
  chain: [],
  intro: 'free',
  winPhrase: 'win',
  goal: () => false,
};
