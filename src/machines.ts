// "Machines": ready-made chains laid out on the table, every part in its
// place and aimed (the gears meshed, the pipes end to end), only the wires
// missing. The child wires a machine up, it comes to life, and it is his:
// a sticker, and the machine kept in "My inventions" to play on with. They
// go from a lamp lighting a sensor to a whole wind-driven factory, so he
// sees what parts can do to each other.
import type { Level, LevelPart } from './levels';
import { active, feeding, through } from './levels';
import type { PartKind } from './parts/base';
import type { Drawbridge, FerrisWheel } from './parts/city';
import type { PaintBooth, Press } from './parts/factory';
import type { FireTruck } from './parts/fun';
import type { World } from './world';
import type { PhraseId } from './voice';

/** A part at a place on the table (world units; levels store them as fractions of the mat). */
const at = (kind: PartKind, x: number, z: number, more: Partial<LevelPart> = {}): LevelPart => ({ kind, fx: x / 6.5, fz: z / 4.4, ...more });

const find = <T>(w: World, kind: PartKind) => w.parts.find((p) => p.kind === kind) as T | undefined;

const machine = (m: Omit<Level, 'tray' | 'chain' | 'fixed' | 'machine' | 'winPhrase'> & { winPhrase?: PhraseId }): Level => ({
  tray: [],
  chain: [],
  fixed: true,
  machine: true,
  winPhrase: 'machineWorks',
  ...m,
});

/** The gear train of a motor at (x, z): small gear, big gear, then a press, each meshing the one before. */
function gearTrain(x: number, z: number): LevelPart[] {
  const g = z - 0.1;
  return [at('gearMotor', x, z), at('gear', x + 1.2, g), at('bigGear', x + 2.8, g), at('press', x + 4.4 + 0.75, g + 0.2)];
}

/** A paint tank at (x, z), three pipes from its spout and the booth at their end. */
function paintLine(x: number, z: number): LevelPart[] {
  const sx = x + 0.9;
  const sz = z - 0.15;
  return [at('tank', x, z), at('pipe', sx + 1, sz), at('pipe', sx + 3, sz), at('pipe', sx + 5, sz), at('paintBooth', sx + 6 + 1, sz + 0.15)];
}

export const MACHINES: Level[] = [
  machine({
    id: 'm-nightlight',
    title: 'Ночная карусель',
    task: 'Лампа светит на датчик, и колесо крутится',
    icon: 'ferris',
    parts: [at('battery', -4, 1.8), at('bulb', -2.5, -1.2), at('lightSensor', -0.6, -1.2), at('ferris', 2.6, -0.8)],
    loops: [
      ['battery', 'bulb'],
      ['battery', 'lightSensor', 'ferris'],
    ],
    intro: 'mNightlight',
    goal: (w) => Math.abs(find<FerrisWheel>(w, 'ferris')?.spin ?? 0) > 0.4 && through(w, 'lightSensor'),
  }),
  machine({
    id: 'm-shooting',
    title: 'Тир',
    task: 'Пушка попадает в мишень, и звенит звонок',
    icon: 'target',
    parts: [at('battery', -4.5, 1.7), at('launcher', -3.6, -1.5), at('target', 2.9, -1.5), at('bell', 3.6, 1.8)],
    loops: [
      ['battery', 'launcher'],
      ['battery', 'target', 'bell'],
    ],
    intro: 'mShooting',
    goal: (w) => active(w, 'bell').length > 0 && through(w, 'target'),
  }),
  machine({
    id: 'm-windsign',
    title: 'Ветряная вывеска',
    task: 'Ветер крутит ветряк, и вывеска светится',
    icon: 'neon',
    parts: [at('battery', -4.7, -1.3), at('fan', -1.4, -1.4), at('windGen', -1.4, 1.3), at('neon', 2.8, 1.3)],
    loops: [
      ['battery', 'fan'],
      ['windGen', 'neon'],
    ],
    intro: 'mWindsign',
    goal: (w) => active(w, 'neon').length > 0 && feeding(w, 'windGen'),
  }),
  machine({
    id: 'm-press',
    title: 'Пресс на шестерёнках',
    task: 'Мотор крутит шестерёнки, шестерёнки — пресс',
    icon: 'press',
    parts: [at('bigBattery', -4.5, 1.8), ...gearTrain(-3.4, -1)],
    loops: [['bigBattery', 'gearMotor']],
    intro: 'mPress',
    goal: (w) => (find<Press>(w, 'press')?.stamps ?? 0) >= 2,
  }),
  machine({
    id: 'm-paint',
    title: 'Покрасочный цех',
    task: 'Насос гонит краску по трубам в камеру',
    icon: 'paintBooth',
    parts: [at('bigBattery', -1.2, 2.2), ...paintLine(-4.6, -0.85)],
    loops: [
      ['bigBattery', 'tank'],
      ['bigBattery', 'paintBooth'],
    ],
    intro: 'mPaint',
    goal: (w) => !!find<PaintBooth>(w, 'paintBooth')?.painting,
  }),
  machine({
    id: 'm-alarm',
    title: 'Домино-будильник',
    task: 'Шарик роняет домино, и пищалка будит',
    icon: 'domino',
    parts: [at('battery', -4.7, 1.7), at('launcher', -4, -1.5), at('domino', 1.6, -1.5), at('buzzer', 3.6, 1.7)],
    loops: [
      ['battery', 'launcher'],
      ['battery', 'domino', 'buzzer'],
    ],
    intro: 'mAlarm',
    goal: (w) => active(w, 'buzzer').length > 0 && through(w, 'domino'),
  }),
  machine({
    id: 'm-laser',
    title: 'Лазерная сигнализация',
    task: 'Луч через зеркало на датчик — и сирена!',
    icon: 'laser',
    parts: [at('battery', -5.8, 1.85), at('laser', -3.6, -1.4, { aim: 0 }), at('mirror', 2.3, -1.4, { side: 0 }), at('lightSensor', 2.3, 2), at('firetruck', 5.4, 0.6)],
    loops: [
      ['battery', 'laser'],
      ['battery', 'lightSensor', 'firetruck'],
    ],
    intro: 'mLaser',
    goal: (w) => through(w, 'lightSensor') && !!find<FireTruck>(w, 'firetruck')?.powered,
  }),
  machine({
    id: 'm-carwash',
    title: 'Автомойка',
    task: 'Щётки крутятся, и насос брызгает',
    icon: 'carWash',
    parts: [at('bigBattery', -3.5, 1.6), at('carWash', -1, -1), at('pump', 3, -1)],
    loops: [
      ['bigBattery', 'carWash'],
      ['bigBattery', 'pump'],
    ],
    intro: 'mCarwash',
    goal: (w) => active(w, 'carWash').length > 0 && active(w, 'pump').length > 0,
  }),
  machine({
    id: 'm-bridge',
    title: 'Разводной мост',
    task: 'Держи кнопку — мост поднимается',
    icon: 'drawbridge',
    parts: [at('bigBattery', -4.6, 1.8), at('button', -1, 2.3), at('drawbridge', 3.2, -0.9)],
    loops: [['bigBattery', 'button', 'drawbridge']],
    intro: 'mBridge',
    goal: (w) => (find<Drawbridge>(w, 'drawbridge')?.up ?? 0) > 0.85,
  }),
  machine({
    id: 'm-factory',
    title: 'Большой завод',
    task: 'Ветер, шестерёнки, пресс и покраска — всё вместе',
    icon: 'gearMotor',
    parts: [at('battery', -9, -2.2), at('fan', -6.8, -2.3), at('windGen', -6.8, 0.6), ...gearTrain(-4.6, 0.6), at('bigBattery', 6.5, 1.4), ...paintLine(2.6, -2.05)],
    loops: [
      ['battery', 'fan'],
      ['windGen', 'gearMotor'],
      ['bigBattery', 'tank'],
      ['bigBattery', 'paintBooth'],
    ],
    intro: 'mFactory',
    goal: (w) => (find<Press>(w, 'press')?.stamps ?? 0) >= 2 && !!find<PaintBooth>(w, 'paintBooth')?.painting && feeding(w, 'windGen'),
  }),
];

const KEY = 'electro-table:machines';

/** Pictures of the machines the child has got working (one each, the newest). */
export function machinePictures(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function keepMachinePicture(id: string, pic: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...machinePictures(), [id]: pic }));
  } catch {
    // Storage full: the card keeps its drawing.
  }
}
