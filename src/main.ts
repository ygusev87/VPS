import * as THREE from 'three';
import './style.css';
import { Sfx } from './audio';
import { freeSpot, hintKey, partsOnScreen, isProblem, levelHint, problemHint, sandboxHint, type Hint } from './hints';
import { Fx } from './fx';
import { CITY_MODELS, CITY_TRAY, CityMap } from './city';
import { FACTORY_MODELS, FACTORY_TRAY, FactoryMap } from './factory';
import { keepMachinePicture, machinePictures, MACHINES } from './machines';
import { FARM_MODELS, FARM_TRAY, FARM_TRAY_TWO, FarmMap } from './farm';
import type { MapHooks, MapProgress, StoryMap } from './storymap';
import { loadGround } from './ground';
import { Hud } from './hud';
import { Input } from './input';
import { chainWorks, FREE_PLAY, LEVELS, type Level } from './levels';
import { Part, type PartKind, type PartSound, type Terminal } from './parts/base';
import type { BandVoice } from './audio';
import { Bells, Maracas, Piano, Tuba } from './parts/band';
import { Drum, MusicBox } from './parts/extra';
import { WaterMill } from './parts/mech';
import { fitGear, fitPipe, runPipes, turnGears } from './parts/factory';
import { blowWind, Pinwheel } from './parts/wind';
import { Belt, interact, Laser, Launcher, Magnet, Mirror, tracePath } from './parts/chain';
import { Album, type Sticker } from './album';
import { Shelf } from './shelf';
import { capture, deleteInvention, keepPlace, loadInventions, placeKept, restore, saveInvention, snapshot, type Invention } from './saves';
import { FireTruck, Helicopter, RaceTrack, TrafficLight } from './parts/fun';
import { Dynamo } from './parts/more';
import { loadModels, releaseUnused } from './parts/assets';
import { ALL_ITEMS, createPart, GROUPS, itemKey, itemOf, MODEL_NAMES } from './parts/catalog';
import { PerfMeter } from './perf';
import { Stage } from './stage';
import { loadProgress, saveProgress } from './storage';
import { renderThumbs } from './thumbs';
import { drawTraces } from './traces';
import { Voice, type PhraseId } from './voice';
import { Wire } from './wires';
import { LIGHT } from './parts/models';
import { C } from './theme';
import { isActive, World } from './world';

const loaderFill = document.querySelector<HTMLElement>('.loader-fill')!;
const setLoad = (f: number) => (loaderFill.style.transform = `scaleX(${f})`);

// Part labels are drawn with the UI face, so wait for it (but never for long).
await Promise.race([
  Promise.all([document.fonts.load('700 20px "Fira Sans Condensed"'), document.fonts.load('600 20px "Fira Sans Condensed"')]),
  new Promise((r) => setTimeout(r, 1500)),
]).catch(() => {});

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const stage = new Stage(canvas);
const world = new World(stage);
const sfx = new Sfx();
const fx = new Fx();
stage.scene.add(fx.group);
const voice = new Voice();
sfx.onReady = (ctx, out) => voice.attach(ctx, out);
const progress = loadProgress();
sfx.setMuted(!progress.sound);
voice.enabled = progress.sound;
setLoad(0.35);

await loadModels(MODEL_NAMES);
setLoad(0.55);
renderThumbs(ALL_ITEMS);
setLoad(0.75);
// One of each part, lit and dark, so every shader variant is ready before play.
stage.warmUp(
  ALL_ITEMS.flatMap((it) => {
    const on = createPart(it.kind, it.color);
    on.state = { level: 1, current: 0.3, voltage: 2, reversed: false, shorted: false };
    on.closed = true;
    on.update(0.1);
    const off = createPart(it.kind, it.color);
    off.update(0.1);
    return [on.root, off.root];
  }),
);

const traces = document.getElementById('traces') as unknown as SVGSVGElement;
drawTraces(traces);
window.addEventListener('resize', () => drawTraces(traces));
// After the iPad turns, wait for the real new size, then lay out again and fit the parts to the new shape.
let lastWide = innerWidth > innerHeight;
window.addEventListener('resize', () => {
  const wide = innerWidth > innerHeight;
  if (wide !== lastWide) setTimeout(() => frameParts(), 350);
  lastWide = wide;
});

let level: Level = LEVELS[0];
/** The map open now (null on the workbench), and which one it is. */
let map: StoryMap | null = null;
let mapName: MapName | null = null;
/** On a map the view comes in closer than on the workbench. */
const MAP_PPU = 62;
/** A close-up the map asked for, shown once the finger is off the table. */
let mapFocus: THREE.Vector3[] | null = null;
let snapSaid = 0;
let mapScore = '';

/** The maps to play on: the farm and the city. */
type MapName = 'farm' | 'city' | 'factory';
const mapLevel = (id: MapName, title: string, task: string, icon: PartKind, intro: PhraseId, winPhrase: PhraseId): Level => ({
  id,
  title,
  task,
  icon,
  parts: [],
  tray: [],
  chain: [],
  sandbox: true,
  intro,
  winPhrase,
  goal: () => false,
});
const MAPS: Record<MapName, { level: Level; models: string[]; tray(): Level['tray']; make(hooks: MapHooks): StoryMap; move: PhraseId }> = {
  farm: {
    level: mapLevel('farm', 'Ферма', 'Помоги животным', 'pump', 'farmIntro', 'morning'),
    models: FARM_MODELS,
    // The second day's parts come into the drawers with it (and one more LED for the geese).
    tray: () => [...FARM_TRAY.map((t) => (t.kind === 'led' ? { ...t, count: t.count + 1 } : t)), ...FARM_TRAY_TWO],
    make: (hooks) => new FarmMap(stage, world, hooks),
    move: 'farmMove',
  },
  city: {
    level: mapLevel('city', 'Город', 'Помоги жителям', 'trafficLight', 'cityIntro', 'cityDone'),
    models: CITY_MODELS,
    tray: () => CITY_TRAY,
    make: (hooks) => new CityMap(stage, world, hooks),
    move: 'cityMove',
  },
  factory: {
    level: mapLevel('factory', 'Завод', 'Запусти фабрику игрушек', 'gearMotor', 'factoryIntro', 'factoryDone'),
    models: FACTORY_MODELS,
    tray: () => FACTORY_TRAY,
    make: (hooks) => new FactoryMap(stage, world, hooks),
    move: 'cityMove',
  },
};
let won = false;
let goalHeld = 0;
let lastTouch = performance.now();
/** The hint whose hand the camera last went to find. */
let hintLook = '';
let levelStart = performance.now();
let hintShownOnce = false;
let currentHint: Hint | null = null;
let currentKey = '';
let spokenKey = '';
let buzzerOn = false;
let buzzerRefresh = 0;

const hud = new Hud(stage, {
  onRestart: () => {
    sfx.unlock();
    sfx.pop();
    if (mapName) void startMap(mapName, true);
    else startLevel(level);
  },
  onSound: (on) => {
    sfx.unlock();
    progress.sound = on;
    sfx.setMuted(!on);
    voice.enabled = on;
    if (!on) voice.stop();
    saveProgress(progress);
  },
  onFlow: (on) => {
    Wire.showFlow = on;
  },
  onNeat: (on) => {
    sfx.unlock();
    sfx.click();
    progress.neat = on;
    Wire.neat = on;
    saveProgress(progress);
  },
  onNight: (on) => {
    progress.night = on;
    stage.setNight(on);
    Part.night = on;
    Wire.glow = on ? 0.7 : 1.4;
    saveProgress(progress);
  },
  onZoom: (f) => stage.zoomBy(f),
  onResetView: () => frameParts(),
  onReplay: () => {
    sfx.unlock();
    if (map) map.replay();
    else voice.say(level.intro, 0);
  },
  onPickLevel: (l) => {
    sfx.unlock();
    sfx.pop();
    startLevel(l);
  },
  onNext: () => {
    sfx.unlock();
    sfx.pop();
    if (level.machine) {
      const k = MACHINES.indexOf(level);
      return startLevel(MACHINES[k + 1] ?? FREE_PLAY);
    }
    const i = LEVELS.indexOf(level);
    startLevel(i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : FREE_PLAY);
  },
  bodiesOnScreen: () => partsOnScreen(world),
  wiresOnScreen: () => world.wires.flatMap((w) => w.samples(12).map((p) => stage.project(p))),
  onPickMap: (id) => {
    sfx.unlock();
    if (id === 'open') return voice.say('mapPick', 0);
    sfx.pop();
    if (id === 'farm' || id === 'city' || id === 'factory') void startMap(id);
    else if (id === 'lab') startLevel(FREE_PLAY);
    else voice.say('soon', 0);
  },
  onSpawn: (item, e) => {
    input.spawnFromTray(item.kind, e, item.color);
    voice.say(item.say, 3000);
  },
});
const album = new Album();
const shelf = new Shelf(album, {
  onSticker: (st, got) => {
    sfx.unlock();
    sfx.pop();
    voice.say(got ? st.say : 'stickerLocked', 0);
  },
  onAlbum: () => {
    sfx.unlock();
    sfx.pop();
    voice.say(album.count === album.total ? 'albumFull' : album.count ? 'album' : 'albumIntro', 0);
  },
  onInventions: (empty) => {
    sfx.unlock();
    sfx.pop();
    voice.say(empty ? 'inventionsEmpty' : 'inventions', 0);
  },
  onSave: () => {
    sfx.unlock();
    const inv = capture(world, tablePicture());
    if (!inv || !saveInvention(inv)) {
      sfx.noPower();
      voice.say('inventionsEmpty', 0);
      return false;
    }
    sfx.star();
    voice.say('saved', 0);
    return true;
  },
  onLoad: (inv) => {
    sfx.unlock();
    sfx.pop();
    startLevel(FREE_PLAY, false, false);
    world.clear();
    restore(world, inv);
    frameParts();
    voice.say('loaded', 0);
  },
  onDelete: (inv, sure) => {
    sfx.unlock();
    if (!sure) return voice.say('deleteAgain', 0);
    sfx.pop();
    deleteInvention(inv.id);
  },
  inventions: () => loadInventions(),
  onMachines: () => {
    sfx.unlock();
    sfx.pop();
    voice.say('machinesIntro', 0);
  },
  onMachine: (m) => {
    sfx.unlock();
    sfx.pop();
    startLevel(m);
  },
  machines: () => {
    const pics = machinePictures();
    return MACHINES.map((m) => ({ level: m, done: progress.done.has(m.id), pic: pics[m.id] }));
  },
});

/** A small picture of the parts on the table, as they are on screen now. */
function tablePicture(): string {
  stage.render();
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const c of partsOnScreen(world)) {
    box.x0 = Math.min(box.x0, c.x - c.r);
    box.y0 = Math.min(box.y0, c.y - c.r * 1.5);
    box.x1 = Math.max(box.x1, c.x + c.r);
    box.y1 = Math.max(box.y1, c.y + c.r);
  }
  return snapshot(stage.renderer.domElement, Number.isFinite(box.x0) ? box : undefined);
}

/** Give a sticker (once): it flies from the spot into the album. */
function earnSticker(id: string, at: THREE.Vector3) {
  const st: Sticker | null = album.earn(id);
  if (!st) return;
  const p = stage.project(at);
  shelf.fly(st, p);
  setTimeout(() => sfx.star(), 250);
  if (!voice.busy) voice.say('newSticker', 0);
}

/** Is this part doing its job right now (for its sticker)? */
function working(p: Part): boolean {
  if (isActive(p) || p.triggered) return true;
  if (p instanceof Mirror) return world.parts.some((l) => l instanceof Laser && isActive(l) && tracePath(world.parts, l).via.includes(p.id));
  if (p instanceof Pinwheel) return p.wind > 0.3;
  if (p.kind === 'tester') return Math.abs(p.state.voltage) > 0.5;
  return Math.abs(p.state.current) > 0.02;
}

let stickerT = 0;
function watchStickers(dt: number) {
  stickerT -= dt;
  if (stickerT > 0) return;
  stickerT = 0.5;
  for (const p of world.parts) {
    if (p.pinned) continue;
    const key = itemKey(itemOf(p));
    if (!album.has(key) && working(p)) earnSticker(key, p.root.localToWorld(new THREE.Vector3(0, 1, 0)));
  }
}

/** The camera operator glances at things that happen off screen, unless a finger is busy. */
function glance(at: THREE.Vector3) {
  if (performance.now() - lastTouch < 2500 || input.busy) return;
  stage.glance(at);
}

hud.setSound(progress.sound);
hud.setNight(progress.night);
hud.setNeat(progress.neat);
Wire.neat = progress.neat;
stage.setNight(progress.night);
Part.night = progress.night;
Wire.glow = progress.night ? 0.7 : 1.4;
const perf = new PerfMeter(stage, document.querySelector('.brand')!);
// Which version this is, small in a corner, so a test on the tablet knows what it is looking at.
const buildTag = document.createElement('div');
buildTag.className = 'build-tag';
buildTag.textContent = `версия ${__BUILD__}`;
document.body.append(buildTag);

const input = new Input(stage, world, {
  overTray: (x, y) => hud.overTray(x, y),
  onTrayHover: (on) => hud.setTrash(on),
  onTouch: () => {
    sfx.unlock();
    lastTouch = performance.now();
  },
  preferredWire: () => hintedWire(),
  grabTap: (x, y) => !!map?.grabTap(x, y),
  onTableTap: (x, y) => {
    map?.tapAt(x, y);
  },
  // A tap on a drawer item (no drag) puts the part in a free spot.
  onSpawnTap: (part) => {
    const at = map?.spotFor(part) ?? freeSpot(world);
    part.root.position.set(at.x, 0, at.z);
    world.separate(part);
    part.appear();
  },
});

stage.onResize = (flipped) => {
  drawTraces(traces);
  hud.layout();
  if (flipped) {
    if (map) map.refocus(true);
    else frameParts();
  }
};

function frameParts(instant = false) {
  if (map) return stage.frame(map.bounds(), instant);
  const pts: THREE.Vector3[] = [];
  for (const p of world.parts) {
    const c = p.root.position;
    pts.push(c.clone().add(new THREE.Vector3(-p.radius, 0, -p.radius * 0.8)), c.clone().add(new THREE.Vector3(p.radius, 0, p.radius * 0.8)));
  }
  // Leave room for parts that will come from the panel.
  if (level.tray.length && level !== FREE_PLAY) pts.push(new THREE.Vector3(4, 0, -2), new THREE.Vector3(4, 0, 2));
  if (!pts.length) pts.push(new THREE.Vector3(-5, 0, -3), new THREE.Vector3(5, 0, 3));
  stage.frame(pts, instant);
}

function preplaced(kind: PartKind) {
  return level.parts.filter((p) => p.kind === kind).length;
}

function trayLeft(kind: PartKind): number {
  const offer = level.tray.find((t) => t.kind === kind);
  if (!offer) return 0;
  if (!Number.isFinite(offer.count)) return Infinity;
  const placed = world.parts.filter((p) => p.kind === kind).length - preplaced(kind);
  return offer.count - placed;
}

function refreshTray() {
  const left: Partial<Record<PartKind, number>> = {};
  for (const t of level.tray) left[t.kind] = trayLeft(t.kind);
  hud.updateTray(left);
}

function leaveMap() {
  if (!map) return;
  map.dispose();
  map = null;
  mapName = null;
  hud.setMapMode(null);
  stage.setNight(progress.night);
  applyNight(progress.night);
}

/** Night look of glows, wires and effects (the stage's own light is set separately). */
function applyNight(on: boolean) {
  Part.night = on;
  Wire.glow = on ? 0.7 : 1.4;
}

/** Open a map (loading its models the first time); `fresh` starts its story over. */
async function startMap(name: MapName, fresh = false) {
  const def = MAPS[name];
  await Promise.all([loadModels(def.models), loadGround()]);
  leaveMap();
  // A view asked for by the map just left is not this one's.
  mapFocus = null;
  level = def.level;
  won = false;
  goalHeld = 0;
  hintShownOnce = false;
  world.clear();
  hud.showNext(false);
  level.tray = def.tray();
  hud.setLevel(level, progress.done);
  const m = (map = def.make({
    say: (id) => voice.say(id, 0),
    chime: () => sfx.star(),
    cheer: (at) => {
      const s = stage.project(at);
      hud.burst(s.x, s.y, 50);
    },
    done: () => {
      sfx.win();
      hud.celebrate();
      progress.done.add(name);
      saveProgress(progress);
    },
    helped: (who, at) => setTimeout(() => earnSticker(`${name}:${who}`, at), 1500),
    look: (at) => setTimeout(() => glance(at), 1200),
    focus: (pts, instant) => {
      if (instant) stage.frame(pts, true, MAP_PPU);
      else mapFocus = pts;
    },
    zap: (at) => {
      sfx.bonk();
      fx.burst(at, 18, '#ffe27a', 3);
      fx.puff(at);
    },
    placed: (at) => {
      sfx.snap();
      fx.ring(at, '#4fd27a', 1.4);
      fx.sparkle(at, '#4fd27a', 12, 0.8);
      if (snapSaid < 2 && !voice.busy) {
        snapSaid++;
        voice.say('snapOk', 0);
      }
    },
  }));
  mapName = name;
  m.start();
  // The workbench's parts are not on the map: give their textures' video memory back for now.
  setTimeout(() => map === m && releaseUnused(stage.scene), 1500);
  mapScore = '';
  // Carry on where the map was left, unless the story was over (then it starts again).
  const kept = fresh ? null : placeKept<MapKept>(name);
  // A save from before the map grew has fewer needs: the new ones start undone.
  const carryOn = !!kept && kept.state.layout === m.layout && kept.state.phase !== 'done' && kept.state.done.length <= m.progress().done.length;
  if (kept && carryOn) {
    if (kept.table) restore(world, kept.table);
    m.resume(kept.state);
  } else keepPlace(name, null);
  progress.place = name;
  saveProgress(progress);
  // Once per visit: tell them the map moves under the finger.
  setTimeout(() => map === m && voice.say(def.move, 0), 9000);
  refreshTray();
  // The first one to help close up (start asked for it); the compass shows the whole map.
  levelStart = performance.now();
  lastTouch = levelStart;
  setHint(null);
  // Back again: who is waiting for help says so; a new visit hears the welcome.
  if (carryOn) m.replay();
  else voice.say(level.intro, 0);
}
/** The farm, as the debug handle and tests call it. */
const startFarm = (fresh = false) => startMap('farm', fresh);

/** A map as it was left: the story so far and the parts and wires the child put down. */
interface MapKept {
  state: MapProgress;
  table: TableKept | null;
}
type TableKept = Pick<Invention, 'parts' | 'wires'>;

/** The table as data for keeping (without the id and time a saved invention has). */
function tableKept(withMap = false): TableKept | null {
  const t = capture(world, '', withMap);
  return t && { parts: t.parts, wires: t.wires };
}

/**
 * Every couple of seconds while playing, and when the game is put away, the
 * free-play table or the map is kept, so the next start carries on from there.
 */
let keptAt = 0;
let keptJson = '';
function keepPlay(force = false) {
  const now = performance.now();
  if (!force && now - keptAt < 2000) return;
  keptAt = now;
  const kept = map && mapName ? { key: mapName, data: { state: map.progress(), table: tableKept(true) } } : level === FREE_PLAY ? { key: 'table' as const, data: tableKept() } : null;
  if (!kept) return;
  const json = kept.key + JSON.stringify(kept.data);
  if (json === keptJson) return;
  keptJson = json;
  keepPlace(kept.key, kept.data);
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') keepPlay(true);
});
window.addEventListener('pagehide', () => keepPlay(true));

function startLevel(l: Level, instant = false, speak = true) {
  leaveMap();
  if (progress.place !== 'lab') {
    progress.place = 'lab';
    saveProgress(progress);
  }
  level = l;
  won = false;
  goalHeld = 0;
  hintShownOnce = false;
  world.clear();
  hud.showNext(false);
  hud.setLevel(l, progress.done);
  l.parts.forEach((p, i) => {
    // Layouts are drawn for landscape; on a tall screen lay them top-to-bottom.
    const [x, z] = stage.portrait && !l.fixed ? [p.fz * 5.5, p.fx * 6.5] : [p.fx * 6.5, p.fz * 4.4];
    const part = world.addPart(p.kind, x, z, { locked: l !== FREE_PLAY && !l.sandbox, closed: p.closed, appear: false });
    if (p.aim !== undefined && 'aim' in part) (part as { aim: number }).aim = p.aim;
    if (p.side !== undefined && 'side' in part) (part as { side: number }).side = p.side;
    part.appear(0.12 + i * 0.14);
  });
  refreshTray();
  frameParts(instant);
  levelStart = performance.now();
  lastTouch = levelStart;
  setHint(null);
  if (speak) voice.say(l.intro, 0);
}

function win() {
  won = true;
  progress.done.add(level.id);
  saveProgress(progress);
  // A machine got working is his: its picture on the card, a sticker, and kept in "My inventions".
  if (level.machine) {
    const pic = tablePicture();
    keepMachinePicture(level.id, pic);
    const inv = capture(world, pic);
    if (inv) saveInvention(inv);
    const mid = world.parts.reduce((s, p) => s.add(p.root.position), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, world.parts.length));
    setTimeout(() => earnSticker(`machine:${level.id}`, mid.setY(1.5)), 1500);
  }
  setHint(null);
  sfx.win();
  voice.say(level.winPhrase, 0);
  hud.celebrate();
  world.parts.forEach((p, i) => p.hop(0.15 * i));
  setTimeout(() => {
    hud.setLevel(level, progress.done);
    refreshTray();
  }, 1300);
  setTimeout(() => {
    if (won && level !== FREE_PLAY) {
      hud.showNext(true);
      setTimeout(() => won && voice.say('next', 20000), 1800);
    }
  }, 1700);
}

function setHint(h: Hint | null) {
  const key = hintKey(h);
  if (key === currentKey) return;
  if (currentHint?.type === 'tapWire') currentHint.wire.alert = false;
  currentKey = key;
  currentHint = h;
  if (h?.type === 'tapWire') h.wire.alert = true;
  Wire.focus = h?.type === 'tapWire' ? h.wire : null;
  hud.setHint(h);
  // On a map the hand may point somewhere off screen: bring that into view (a hand off screen helps nobody).
  const pts = map ? hintPoints(h) : [];
  if (pts.length && pts.some((p) => !stage.inView(p))) mapFocus = pts.flatMap((p) => [p.clone().add(new THREE.Vector3(-2.5, 0, -2.5)), p.clone().add(new THREE.Vector3(2.5, 0, 2.5))]);
}

/** The places on the table a hint points at. */
function hintPoints(h: Hint | null): THREE.Vector3[] {
  if (!h) return [];
  switch (h.type) {
    case 'drag':
      return [h.to.clone(), ...(h.part ? [h.part.root.position.clone()] : [])];
    case 'connect':
      return [h.from.attachPoint(), h.to.attachPoint()];
    case 'tap':
    case 'weak':
      return [h.part.root.position.clone()];
    case 'tapWire':
      return [h.wire.pointAt(h.u)];
  }
}

/** The wire a hint asks to remove, so a tap near it takes that one. */
function hintedWire() {
  return currentHint?.type === 'tapWire' ? currentHint.wire : null;
}

// ───────── World reactions ─────────

const tmp = new THREE.Vector3();
world.on((e) => {
  switch (e.type) {
    case 'pickup':
      sfx.pickup();
      break;
    case 'drop':
      sfx.drop();
      // Onto a map's ring if it wants it; else a gear or a pipe lines itself up with its neighbour.
      if (!map?.snap(e.part) && (fitGear(e.part, world.parts) || fitPipe(e.part, world.parts))) world.markDirty();
      break;
    case 'wireStart':
      sfx.wireStart();
      break;
    case 'wireCancel':
      sfx.unsnap();
      break;
    case 'wireAdded':
      sfx.snap();
      // The clips holding a laid cable click on one by one.
      for (let i = 0; i < e.wire.clipCount; i++) setTimeout(() => sfx.clipOn(), 120 + i * 80);
      if (e.wire.b) fx.burst(e.wire.b.attachPoint(tmp).clone(), 16);
      break;
    case 'wireRemoved':
      sfx.unsnap();
      break;
    case 'partAdded':
    case 'partRemoved':
      refreshTray();
      if (e.type === 'partRemoved') sfx.pop();
      break;
    case 'switch':
      if (e.part.kind === 'button') sfx.press(e.part.closed);
      else if (e.part.kind !== 'xylophone' && e.part.kind !== 'drum') sfx.click();
      break;
    case 'activated': {
      // A ring of light and a few rising motes: "it's alive".
      const at = e.part.root.position;
      // (Not on a map while a hint leads somewhere: the view would bounce between the two.)
      if (!map || !currentHint) glance(at);
      const c = e.part.kind === 'bulb' || e.part.kind === 'led' ? LIGHT[e.part.color].hex : C.teal;
      fx.ring(at, c, e.part.radius * 1.6);
      e.part.bump(0.18);
      fx.sparkle(at, c, 10, e.part.radius * 0.7);
      if (e.part.kind === 'bulb' || e.part.kind === 'led') sfx.ting();
      if (['fan', 'floorFan', 'pcFan', 'windmill', 'carousel', 'marbleRun', 'waterMill', 'conveyor'].includes(e.part.kind)) sfx.whir();
      // The first time a music box plays, tell how to change the song.
      if (e.part.kind === 'musicbox' && !songHintSaid) {
        songHintSaid = true;
        setTimeout(() => voice.say('tapSong', 0), 4000);
      }
      break;
    }
    case 'short':
      if (e.on) {
        sfx.alarm();
        for (const p of world.parts) if (p.state.shorted) p.shake();
      }
      break;
  }
});

// ───────── Hints ─────────

let hintTimer = 0;
/** `?quickhints`: hints come up at once (for the finger-driven play-throughs in tests). */
const QUICK_HINTS = new URLSearchParams(location.search).has('quickhints');
/** When the voice was last heard talking (hints wait for a pause). */
let voiceBusyAt = 0;
function updateHint(dt: number) {
  hintTimer -= dt;
  if (hintTimer > 0) return;
  hintTimer = 0.25;
  const problem = problemHint(world);
  if (problem) return setHint(problem);
  if (won) return setHint(null);
  const idle = performance.now() - lastTouch;
  // Free play is the child's own experiment: nudge later than in missions.
  const free = level === FREE_PLAY || !!level.sandbox;
  const wait = QUICK_HINTS ? 300 : free ? (hintShownOnce ? 9000 : 4000) : hintShownOnce ? 6000 : 1600;
  const h = map ? map.hint(trayLeft) : free ? sandboxHint(world) : levelHint(world, level, trayLeft);
  if (!h) return setHint(null);
  // Keep showing a hint that is already up; new ones wait for the child to pause.
  if (currentHint && hintKey(currentHint) === hintKey(h)) return;
  if (idle > wait && performance.now() - levelStart > 1200) {
    hintShownOnce = true;
    setHint(h);
  } else setHint(null);
}

function hintVisible() {
  if (!currentHint || input.busy) return false;
  return isProblem(currentHint) || performance.now() - lastTouch > 1200;
}

// ───────── Part sounds ─────────

let songHintSaid = false;
let testerTipSaid = false;
let magnetSaid = false;
function playPartSound(snd: PartSound, from?: Part) {
  switch (snd.kind) {
    case 'xylophone':
      sfx.xylophone(snd.note);
      break;
    case 'drum':
      sfx.drum();
      break;
    case 'noPower':
      sfx.noPower();
      voice.say('needPower', 10000);
      break;
    case 'song':
      sfx.pop();
      break;
    case 'honk':
      sfx.honk();
      break;
    case 'lap':
      sfx.lap();
      break;
    case 'tick':
      sfx.tick();
      break;
    case 'ding':
      sfx.lap();
      break;
    case 'clank':
      sfx.clank();
      break;
    case 'liftTop':
      if (!liftSaid && !troubled()) {
        liftSaid = true;
        setTimeout(() => voice.say('liftSwap', 0), 900);
      }
      break;
    case 'craneHold':
      if (!craneSaid) {
        craneSaid = true;
        voice.say('craneHold', 0);
      }
      break;
    case 'piano':
      sfx.piano(snd.note);
      break;
    case 'tuba':
      sfx.tuba(snd.note);
      break;
    case 'bell':
      sfx.bellTap(snd.note);
      break;
    case 'shake':
      sfx.shake();
      break;
    case 'marble':
      sfx.marble();
      break;
    case 'stamp':
      sfx.stamp();
      break;
    case 'paint':
      sfx.paint();
      break;
    case 'launch':
      sfx.launch();
      break;
    case 'bonk':
      sfx.bonk();
      break;
    case 'clack':
      sfx.clack();
      if (from instanceof Magnet && !magnetSaid && !troubled()) {
        magnetSaid = true;
        setTimeout(() => voice.say('magnetTip', 0), 600);
      }
      break;
    case 'gong':
      sfx.gong();
      break;
    case 'burst':
      sfx.burst();
      break;
    case 'pins':
      sfx.pins();
      break;
    case 'whistle':
      sfx.whistle();
      break;
    case 'volts': {
      const v = Math.round(Math.abs(snd.v));
      if (snd.v < -0.5) voice.say('testerBack', 0);
      else if (v > 12) voice.say('vMany', 0);
      else voice.say(`v${v}` as PhraseId, 0);
      if (!testerTipSaid && Math.abs(snd.v) < 0.1) {
        testerTipSaid = true;
        setTimeout(() => voice.say('testerTip', 0), 1800);
      }
      break;
    }
    case 'missed':
      if (!aimSaid && !troubled()) {
        aimSaid = true;
        voice.say('aimTip', 0);
      }
      break;
    case 'craneDone':
      sfx.win();
      voice.say('craneDone', 0);
      if (from) {
        const p = stage.project(from.root.localToWorld(new THREE.Vector3(0, 1.5, 0)));
        hud.burst(p.x, p.y, 60);
      }
      break;
  }
}
let liftSaid = false;
let aimSaid = false;
let craneSaid = false;

// The band: every instrument moves on the notes the conductor gives it.
const BAND_PARTS: Record<BandVoice, (p: Part) => ((note: number) => void) | null> = {
  drum: (p) => (p instanceof Drum ? () => p.thump() : null),
  piano: (p) => (p instanceof Piano ? (n) => p.cue(n) : null),
  tuba: (p) => (p instanceof Tuba ? (n) => p.cue(n) : null),
  maracas: (p) => (p instanceof Maracas ? (n) => p.cue(n) : null),
  bells: (p) => (p instanceof Bells ? (n) => p.cue(n) : null),
};
sfx.onBand = (who, note) => {
  for (const p of world.parts) if (isActive(p)) BAND_PARTS[who](p)?.(note);
};
/** The song the band follows when no music box plays: the last one chosen. */
let bandSong = 0;
let bandTipSaid = false;
let bandAlone = 0;
/** Once one instrument plays by itself for a while, suggest joining more. */
function watchBand(dt: number, players: number) {
  bandAlone = players === 1 && !troubled() ? bandAlone + dt : 0;
  if (bandAlone > 8 && !bandTipSaid) {
    bandTipSaid = true;
    voice.say('bandTip', 0);
  }
}

/** A pinwheel left without wind: say where it should go, once. */
let pinwheelSaid = false;
function watchPinwheels() {
  if (pinwheelSaid || troubled()) return;
  if (world.parts.some((p) => p instanceof Pinwheel && p.calm > 7)) {
    pinwheelSaid = true;
    voice.say('pinwheelTip', 0);
  }
}

/** A running belt that no ball has reached while a launcher shoots: say where it goes, once. */
let beltSaid = false;
function watchBelts() {
  if (beltSaid || troubled()) return;
  const launching = world.parts.some((p) => p instanceof Launcher && p.powered);
  if (launching && world.parts.some((p) => p instanceof Belt && !p.carried && p.running > 8)) {
    beltSaid = true;
    voice.say('beltTip', 0);
  }
}

/** Free play: a chain the child built works by itself — cheer (not too often). */
let chainHeld = 0;
let chainWas = false;
let chainCheerAt = -1e9;
function watchChains(dt: number) {
  if (!map && !album.has('chain') && chainWorks(world)) {
    const lit = world.parts.find((p) => p.triggered === 'world') ?? world.parts[0];
    if (lit) earnSticker('chain', lit.root.localToWorld(new THREE.Vector3(0, 1, 0)));
  }
  if (level !== FREE_PLAY) return;
  const on = chainWorks(world) && !troubled();
  chainHeld = on ? chainHeld + dt : 0;
  if (chainHeld > 0.6 && !chainWas && performance.now() - chainCheerAt > 30000) {
    chainWas = true;
    chainCheerAt = performance.now();
    sfx.star();
    voice.say('chainWow', 0);
    const lit = world.parts.find((p) => p.kind !== 'launcher' && p.kind !== 'laser' && isActive(p));
    if (lit) {
      const s = stage.project(lit.root.localToWorld(new THREE.Vector3(0, 1.2, 0)));
      hud.burst(s.x, s.y, 40);
    }
  }
  if (!on) chainWas = false;
}

/** A shorted battery spits sparks at its posts and smokes. */
let shortSparks = 0;
let shortSmoke = 0;
function watchShorts(dt: number) {
  const ids = world.result?.shorted;
  if (!ids?.size) return;
  shortSparks -= dt;
  shortSmoke -= dt;
  for (const p of world.parts) {
    if (![...ids].some((id) => id === p.id || id.startsWith(p.id + '#'))) continue;
    if (shortSparks <= 0) for (const t of p.terminals.slice(0, 2)) fx.burst(t.attachPoint(new THREE.Vector3()), 5, '#ffb84a', 1.8);
    if (shortSmoke <= 0) fx.puff(p.root.position.clone().setY(0.9));
  }
  if (shortSparks <= 0) shortSparks = 0.14;
  if (shortSmoke <= 0) shortSmoke = 0.3;
}

/** Something is wrong on the table: cheers wait until it is fixed. */
function troubled() {
  return (world.result?.shorted.size ?? 0) > 0 || isProblem(currentHint);
}

let heliTipSaid = false;
let heliFlySaid = false;
const airborne = new Map<Helicopter, number>();
function watchHelicopters(dt: number) {
  for (const p of world.parts) {
    if (!(p instanceof Helicopter)) continue;
    // Cheer only for a real, steady flight with nothing wrong on the table.
    const t = p.flying && !troubled() ? (airborne.get(p) ?? 0) + dt : 0;
    airborne.set(p, t);
    if (t > 1.2 && !heliFlySaid) {
      heliFlySaid = true;
      voice.say('heliFly', 0);
    }
    // Spinning but stuck on the pad for a while: suggest more power, once.
    if (p.grounded > 3 && !heliTipSaid && !p.flying && !troubled()) {
      heliTipSaid = true;
      voice.say('heliMore', 0);
    }
  }
}

/** A powered traffic light next to a race track stops its car on red. */
let trafficSaid = false;
function linkTraffic() {
  const lights = world.parts.filter((p): p is TrafficLight => p instanceof TrafficLight);
  for (const p of world.parts) {
    if (!(p instanceof RaceTrack)) continue;
    const near = lights.filter((l) => l.root.position.distanceTo(p.root.position) < p.radius + l.radius + 2.5);
    p.redLight = near.some((l) => l.powered) && near.filter((l) => l.powered).every((l) => l.stopsTraffic);
    if (p.waiting && !trafficSaid) {
      trafficSaid = true;
      voice.say('trafficCar', 0);
    }
  }
}

/** The bin shows while a part that may be thrown away is carried. */
let trashSaid = false;
let carriedFor = 0;
function watchCarry(dt: number) {
  const part = input.carried;
  const show = !!part && !part.locked;
  hud.showTrash(show);
  carriedFor = show ? carriedFor + dt : 0;
  // The first long carry of the session: tell where the bin is.
  if (carriedFor > 2.5 && !trashSaid) {
    trashSaid = true;
    voice.say('trash', 0);
  }
}

// ───────── Main loop ─────────

let last = performance.now();
function frame(now: number) {
  const realDt = Math.min(0.5, (now - last) / 1000);
  const dt = Math.min(0.05, realDt);
  last = now;
  stage.update(dt);
  stage.busy = input.busy;
  if (map) {
    map.update(dt);
    // The camera moves on to the next animal once the finger is off the table.
    if (mapFocus && performance.now() - lastTouch > 1200 && !input.busy) {
      stage.frame(mapFocus, false, MAP_PPU);
      mapFocus = null;
    }
    // The hand drifted off screen (the view moved after it appeared) and the child has
    // left the table alone a while: bring it back into view, once for each hint.
    if (!mapFocus && currentHint && hintLook !== currentKey && performance.now() - lastTouch > 5000 && !input.busy) {
      const pts = hintPoints(currentHint);
      if (pts.some((p) => !stage.inView(p))) {
        hintLook = currentKey;
        mapFocus = pts.flatMap((p) => [p.clone().add(new THREE.Vector3(-2.5, 0, -2.5)), p.clone().add(new THREE.Vector3(2.5, 0, 2.5))]);
      }
    }
    const night = map.nightAmount > 0.5;
    if (night !== Part.night) applyNight(night);
    fx.night = night;
    const [n, of] = map.score;
    const score = `Помощь: ${n} из ${of}`;
    if (score !== mapScore) {
      mapScore = score;
      hud.setMapMode(mapName!, level.title, score);
    }
  }
  world.update(dt);

  if (!won && level !== FREE_PLAY) {
    // Real time, not the frame-capped dt: on a busy device a lit LED still counts after half a second.
    goalHeld = level.goal(world) ? goalHeld + realDt : 0;
    if (goalHeld > 0.5) win();
  }

  updateHint(dt);
  const vis = hintVisible();
  hud.updateHints(dt, vis);
  hud.updateTag(input.carried);
  // A hint speaks only once the voice has been quiet a moment: it must not cut
  // off an animal still telling what it needs (or any other phrase).
  if (voice.busy) voiceBusyAt = performance.now();
  if (vis && currentHint && spokenKey !== currentKey && performance.now() - voiceBusyAt > 700) {
    spokenKey = currentKey;
    voice.say(currentHint.phrase, 9000);
  }

  let fan = 0;
  let buzz = false;
  let music = false;
  let song = 0;
  let engine = 0;
  let siren = false;
  let water = 0;
  const band = { melody: false, drum: false, piano: false, tuba: false, maracas: false, bells: false };
  blowWind(world.parts);
  interact(world.parts, dt);
  turnGears(world.parts);
  runPipes(world.parts);
  for (const p of world.parts) {
    for (const snd of p.sounds.splice(0)) playPartSound(snd, p);
    for (const e of p.effects.splice(0)) {
      if (e.kind === 'sparks') fx.burst(e.at, e.n ?? 12, e.color);
      else if (e.kind === 'dust') fx.dust(e.at, e.radius);
      else if (e.kind === 'trail') fx.trail(e.at, e.color);
      else fx.exhaust(e.at, e.dir);
    }
    if (p.kind === 'fan' || p.kind === 'floorFan') fan += Math.abs(p.state.level);
    if (p.kind === 'pcFan') fan += Math.abs(p.state.level) * 0.5;
    if (p.kind === 'marbleRun' || p.kind === 'conveyor') fan += Math.abs(p.state.level) * 0.3;
    if (p instanceof WaterMill) {
      water += p.pour * 8;
      fan += Math.abs(p.state.level) * 0.25;
    }
    if (p.kind === 'windmill' || p.kind === 'carousel' || p.kind === 'disco') fan += Math.abs(p.state.level) * 0.4;
    if (p instanceof Helicopter) fan += p.rotorSpeed * 0.8;
    if (p instanceof Dynamo) fan += Math.min(1, Math.abs(p.omega) / 10) * 0.5;
    if (p instanceof RaceTrack) engine = Math.max(engine, p.carSpeed);
    if (p instanceof FireTruck && p.powered && p.siren > 0) siren = true;
    if (isActive(p)) {
      if (p instanceof Drum) band.drum = true;
      if (p instanceof Piano) band.piano = true;
      if (p instanceof Tuba) band.tuba = true;
      if (p instanceof Maracas) band.maracas = true;
      if (p instanceof Bells) band.bells = true;
    }
    if (p.kind === 'buzzer' && isActive(p)) buzz = true;
    if (p instanceof MusicBox && isActive(p) && !music) {
      music = true;
      song = p.song;
      bandSong = p.song;
    }
  }
  band.melody = music;
  const players = Object.values(band).filter(Boolean).length;
  sfx.watch();
  sfx.setFan(fan);
  sfx.tickBand(band, music ? song : bandSong);
  sfx.setWater(water);
  sfx.tickBell(world.parts.some((p) => p.kind === 'bell' && isActive(p)));
  watchBand(dt, players);
  watchPinwheels();
  sfx.setEngine(engine);
  sfx.setSiren(siren);
  watchHelicopters(dt);
  linkTraffic();
  watchCarry(dt);
  buzzerRefresh -= dt;
  if (buzz !== buzzerOn || (buzz && buzzerRefresh <= 0)) {
    buzzerOn = buzz;
    buzzerRefresh = 5;
    sfx.setBuzzer(buzz);
  }

  watchShorts(dt);
  watchChains(dt);
  keepPlay();
  watchStickers(dt);
  watchBelts();
  if (!map) fx.night = progress.night;
  fx.shine(world.parts.flatMap((p) => p.glowLight() ?? []));
  fx.resize(stage.renderer.domElement.height, stage.camera.fov);
  fx.update(dt);
  hud.updateFx(dt);
  stage.render();
  perf.tick(now);
  requestAnimationFrame(frame);
}

// Free play is the main mode; missions wait in the drop-down. Play carries on
// where it was left: on a map, or with the table as the child left it.
if (progress.place === 'farm' || progress.place === 'city' || progress.place === 'factory') await startMap(progress.place);
else {
  startLevel(FREE_PLAY, true);
  const table = placeKept<TableKept>('table');
  if (table?.parts.length) {
    world.clear();
    restore(world, table);
    refreshTray();
    frameParts(true);
  }
}
voice.stop();
requestAnimationFrame((t) => {
  last = t;
  frame(t);
  setLoad(1);
  setTimeout(() => document.getElementById('loader')!.classList.add('is-done'), 350);
});

// Offline: the published game saves itself on the device (see scripts/sw-template.js).
// Not in dev, and not in the claude.ai preview build, which cannot host a worker.
if (import.meta.env.PROD && !import.meta.env.VITE_MODELS_AS_JS && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Debug/test handle (used by the Playwright smoke tests).
(window as unknown as { __game: unknown }).__game = {
  world,
  stage,
  sfx,
  startFarm,
  startMap,
  album,
  shelf,
  /** The open map (the farm or the city), under its old name too. */
  get farm() {
    return map;
  },
  get map() {
    return map;
  },
  get won() {
    return won;
  },
  startLevel,
  LEVELS,
  MACHINES,
  FREE_PLAY,
  input,
  hud,
  voice,
  hints: { problemHint, sandboxHint, levelHint },
  /** The hint on screen now (the hand), for tests that follow it with a real finger. */
  get hint() {
    return hintVisible() ? currentHint : null;
  },
  GROUPS,
  /** Run the table (wind, light, balls, circuits) n steps of 50 ms without drawing — for tests. */
  step(n: number) {
    for (let i = 0; i < n; i++) {
      blowWind(world.parts);
      interact(world.parts, 0.05);
      turnGears(world.parts);
      runPipes(world.parts);
      world.update(0.05);
      for (const p of world.parts) {
        p.sounds.length = 0;
        p.effects.length = 0;
      }
    }
  },
  levelGoal: () => level.goal(world),
  /** Wire two terminals directly, skipping the gesture. */
  connect(a: Terminal, b: Terminal) {
    const w = new Wire(a);
    stage.world.add(w.group);
    world.attachWire(w, b);
  },
};
