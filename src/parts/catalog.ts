// Everything the child can take from the parts panel, grouped like drawers
// in a kit box. A variant is a part kind plus, for lights, a colour.
import type { LightColor, Part, PartKind } from './base';
import { ButtonPanel, Carousel, MusicBox, PushButton, Windmill } from './extra';
import { Battery, Bulb, Buzzer, Fan, Led, Switch } from './models';
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
    ],
  },
  {
    id: 'motion',
    name: 'Движение',
    items: [
      { kind: 'fan', name: 'Вентилятор', say: 'fan' },
      { kind: 'carousel', name: 'Карусель', say: 'carousel' },
      { kind: 'windmill', name: 'Мельница', say: 'windmill' },
    ],
  },
  {
    id: 'sound',
    name: 'Звук',
    items: [
      { kind: 'buzzer', name: 'Пищалка', say: 'buzzer' },
      { kind: 'musicbox', name: 'Музыкальная шкатулка', say: 'musicbox' },
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
    case 'carousel':
      return new Carousel();
    case 'windmill':
      return new Windmill();
    case 'buzzer':
      return new Buzzer();
    case 'musicbox':
      return new MusicBox();
    case 'switch':
      return new Switch();
    case 'button':
      return new PushButton();
    case 'panel':
      return new ButtonPanel();
  }
}

/** Model files the game loads at start. */
export const MODEL_NAMES = ['battery', 'bigbattery', 'socket', 'motor', 'propeller', 'knife', 'led', 'buzzer', 'carousel', 'windmill', 'sails', 'musicbox', 'button', 'panel'];
