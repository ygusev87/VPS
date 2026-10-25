// Everything the child can take from the parts panel, grouped like drawers
// in a kit box. A variant is a part kind plus, for lights, a colour.
import { Tester } from './tester';
import type { LightColor, Part, PartKind } from './base';
import { ButtonPanel, Carousel, Drum, MusicBox, PushButton, Windmill, Xylophone } from './extra';
import { DiscoBall, FireTruck, Helicopter, RaceTrack, TrafficLight } from './fun';
import { Battery, Bulb, Buzzer, Fan, Led, Switch } from './models';
import { Crane, Dynamo, Lift } from './more';
import { Bells, Maracas, Piano, Tuba } from './band';
import { Conveyor, MarbleRun, WaterMill } from './mech';
import { FloorFan, PcFan, Pinwheel } from './wind';
import { Bell, Belt, Domino, Laser, Launcher, LightSensor, Magnet, Mirror, Target, WindGen } from './chain';
import { Gate, Heater, Pole, Pump, Solar } from './farm';
import { Barrier, CarWash, Drawbridge, DuskLamp, FerrisWheel, FireLadder, NeonSign, Substation, TowerCrane } from './city';
import type { PhraseId } from '../voice';

export interface CatalogItem {
  kind: PartKind;
  color?: LightColor;
  name: string;
  /** Spoken when the child takes it, so names are learnt by ear. */
  say: PhraseId;
}

export interface CatalogGroup {
  id: string;
  name: string;
  items: CatalogItem[];
}

export const GROUPS: CatalogGroup[] = [
  {
    id: 'power',
    name: 'Питание',
    items: [
      { kind: 'battery', name: 'Батарейки 3 В', say: 'battery' },
      { kind: 'bigBattery', name: 'Большая батарея 6 В', say: 'bigBattery' },
      { kind: 'dynamo', name: 'Динамо-машина', say: 'dynamo' },
      { kind: 'tester', name: 'Тестер', say: 'tester' },
    ],
  },
  {
    id: 'light',
    name: 'Свет',
    items: [
      { kind: 'bulb', color: 'warm', name: 'Лампочка', say: 'bulb' },
      { kind: 'bulb', color: 'red', name: 'Красная лампочка', say: 'bulbRed' },
      { kind: 'bulb', color: 'green', name: 'Зелёная лампочка', say: 'bulbGreen' },
      { kind: 'bulb', color: 'blue', name: 'Синяя лампочка', say: 'bulbBlue' },
      { kind: 'led', color: 'red', name: 'Красный светодиод', say: 'ledRed' },
      { kind: 'led', color: 'green', name: 'Зелёный светодиод', say: 'ledGreen' },
      { kind: 'led', color: 'blue', name: 'Синий светодиод', say: 'ledBlue' },
      { kind: 'led', color: 'yellow', name: 'Жёлтый светодиод', say: 'ledYellow' },
      { kind: 'trafficLight', name: 'Светофор', say: 'trafficLight' },
      { kind: 'disco', name: 'Диско-шар', say: 'disco' },
    ],
  },
  {
    id: 'wind',
    name: 'Ветер',
    items: [
      { kind: 'fan', name: 'Вентилятор', say: 'fan' },
      { kind: 'floorFan', name: 'Напольный вентилятор', say: 'floorFan' },
      { kind: 'pcFan', name: 'Компьютерный вентилятор', say: 'pcFan' },
      { kind: 'pinwheel', name: 'Вертушка', say: 'pinwheel' },
      { kind: 'windmill', name: 'Мельница', say: 'windmill' },
    ],
  },
  {
    id: 'motion',
    name: 'Движение',
    items: [
      { kind: 'carousel', name: 'Карусель', say: 'carousel' },
      { kind: 'lift', name: 'Лифт', say: 'lift' },
      { kind: 'crane', name: 'Подъёмный кран', say: 'crane' },
    ],
  },
  {
    id: 'mech',
    name: 'Механизмы',
    items: [
      { kind: 'marbleRun', name: 'Шариковая горка', say: 'marbleRun' },
      { kind: 'waterMill', name: 'Водяная мельница', say: 'waterMill' },
      { kind: 'conveyor', name: 'Конвейер', say: 'conveyor' },
    ],
  },
  {
    id: 'chain',
    name: 'Цепочки',
    items: [
      { kind: 'launcher', name: 'Пушка с шариком', say: 'launcher' },
      { kind: 'target', name: 'Мишень', say: 'target' },
      { kind: 'domino', name: 'Домино', say: 'domino' },
      { kind: 'windGen', name: 'Ветряк', say: 'windGen' },
      { kind: 'lightSensor', name: 'Фотодатчик', say: 'lightSensor' },
      { kind: 'laser', name: 'Лазер', say: 'laser' },
      { kind: 'mirror', name: 'Зеркало', say: 'mirror' },
      { kind: 'belt', name: 'Транспортёр', say: 'belt' },
      { kind: 'bell', name: 'Звонок', say: 'bell' },
      { kind: 'magnet', name: 'Электромагнит', say: 'magnet' },
    ],
  },
  {
    id: 'farm',
    name: 'Ферма',
    items: [
      { kind: 'pump', name: 'Насос', say: 'pump' },
      { kind: 'heater', name: 'Обогреватель', say: 'heater' },
    ],
  },
  {
    id: 'city',
    name: 'Город',
    items: [
      { kind: 'barrier', name: 'Шлагбаум', say: 'barrier' },
      { kind: 'ferris', name: 'Колесо обозрения', say: 'ferris' },
      { kind: 'carWash', name: 'Автомойка', say: 'carWash' },
      { kind: 'drawbridge', name: 'Разводной мост', say: 'drawbridge' },
      { kind: 'towerCrane', name: 'Башенный кран', say: 'towerCrane' },
      { kind: 'duskLamp', name: 'Уличный фонарь', say: 'duskLamp' },
      { kind: 'neon', name: 'Неоновая вывеска', say: 'neon' },
      { kind: 'ladder', name: 'Пожарная лестница', say: 'ladder' },
    ],
  },
  {
    id: 'vehicles',
    name: 'Машины',
    items: [
      { kind: 'track', name: 'Гоночная трасса', say: 'track' },
      { kind: 'firetruck', name: 'Пожарная машина', say: 'firetruck' },
      { kind: 'helicopter', name: 'Вертолёт', say: 'helicopter' },
    ],
  },
  {
    id: 'sound',
    name: 'Звук',
    items: [
      { kind: 'buzzer', name: 'Пищалка', say: 'buzzer' },
      { kind: 'musicbox', name: 'Музыкальная шкатулка', say: 'musicbox' },
      { kind: 'xylophone', name: 'Ксилофон', say: 'xylophone' },
      { kind: 'drum', name: 'Барабан', say: 'drum' },
      { kind: 'piano', name: 'Пианино', say: 'piano' },
      { kind: 'tuba', name: 'Туба', say: 'tuba' },
      { kind: 'maracas', name: 'Маракасы', say: 'maracas' },
      { kind: 'bells', name: 'Колокольчики', say: 'bells' },
    ],
  },
  {
    id: 'switches',
    name: 'Кнопки',
    items: [
      { kind: 'switch', name: 'Рубильник', say: 'switch' },
      { kind: 'button', name: 'Кнопка', say: 'button' },
      { kind: 'panel', name: 'Пульт с кнопками', say: 'panel' },
    ],
  },
];

export const ALL_ITEMS: CatalogItem[] = GROUPS.flatMap((g) => g.items);
export const ALL_KINDS: PartKind[] = [...new Set(ALL_ITEMS.map((i) => i.kind))];

export function itemKey(item: { kind: PartKind; color?: LightColor }) {
  return item.color ? `${item.kind}:${item.color}` : item.kind;
}

/** The catalog entry a part on the table came from (for its name tag). */
export function itemOf(p: { kind: PartKind; color: LightColor }): CatalogItem {
  return ALL_ITEMS.find((i) => i.kind === p.kind && (!i.color || i.color === p.color)) ?? ALL_ITEMS.find((i) => i.kind === p.kind)!;
}

export function createPart(kind: PartKind, color?: LightColor): Part {
  const p = make(kind);
  if (color) p.setColor(color);
  return p;
}

function make(kind: PartKind): Part {
  switch (kind) {
    case 'battery':
      return new Battery();
    case 'bigBattery':
      return new Battery(true);
    case 'bulb':
      return new Bulb();
    case 'led':
      return new Led();
    case 'fan':
      return new Fan();
    case 'floorFan':
      return new FloorFan();
    case 'pcFan':
      return new PcFan();
    case 'pinwheel':
      return new Pinwheel();
    case 'piano':
      return new Piano();
    case 'tuba':
      return new Tuba();
    case 'maracas':
      return new Maracas();
    case 'bells':
      return new Bells();
    case 'marbleRun':
      return new MarbleRun();
    case 'waterMill':
      return new WaterMill();
    case 'conveyor':
      return new Conveyor();
    case 'windGen':
      return new WindGen();
    case 'lightSensor':
      return new LightSensor();
    case 'launcher':
      return new Launcher();
    case 'target':
      return new Target();
    case 'domino':
      return new Domino();
    case 'laser':
      return new Laser();
    case 'bell':
      return new Bell();
    case 'pole':
      return new Pole();
    case 'solar':
      return new Solar();
    case 'pump':
      return new Pump();
    case 'heater':
      return new Heater();
    case 'gate':
      return new Gate();
    case 'substation':
      return new Substation();
    case 'barrier':
      return new Barrier();
    case 'ferris':
      return new FerrisWheel();
    case 'carWash':
      return new CarWash();
    case 'drawbridge':
      return new Drawbridge();
    case 'towerCrane':
      return new TowerCrane();
    case 'duskLamp':
      return new DuskLamp();
    case 'neon':
      return new NeonSign();
    case 'ladder':
      return new FireLadder();
    case 'belt':
      return new Belt();
    case 'mirror':
      return new Mirror();
    case 'carousel':
      return new Carousel();
    case 'windmill':
      return new Windmill();
    case 'buzzer':
      return new Buzzer();
    case 'musicbox':
      return new MusicBox();
    case 'xylophone':
      return new Xylophone();
    case 'drum':
      return new Drum();
    case 'track':
      return new RaceTrack();
    case 'helicopter':
      return new Helicopter();
    case 'firetruck':
      return new FireTruck();
    case 'trafficLight':
      return new TrafficLight();
    case 'disco':
      return new DiscoBall();
    case 'dynamo':
      return new Dynamo();
    case 'lift':
      return new Lift();
    case 'crane':
      return new Crane();
    case 'switch':
      return new Switch();
    case 'button':
      return new PushButton();
    case 'panel':
      return new ButtonPanel();
    case 'tester':
      return new Tester();
    case 'magnet':
      return new Magnet();
  }
}

/** Model files the game loads at start. */
export const MODEL_NAMES = ['battery', 'socket', 'motor', 'propeller', 'knife', 'led', 'buzzer', 'carousel', 'windmill', 'sails', 'musicbox', 'button', 'panel', 'drum', 'racecar', 'helicopter', 'firetruck', 'dynamo', 'tuba', 'floorfan', 'windgen', 'mirror', 'heater', 'pump', 'tester', 'magnet', 'bell', 'cannon', 'target', 'trafficlight', 'laser'];
