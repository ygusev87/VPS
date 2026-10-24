import * as THREE from 'three';
import './style.css';
import { Sfx } from './audio';
import { freeSpot, hintKey, partsOnScreen, isProblem, levelHint, problemHint, sandboxHint, type Hint } from './hints';
import { Fx } from './fx';
import { Hud } from './hud';
import { Input } from './input';
import { FREE_PLAY, LEVELS, type Level } from './levels';
import { Part, type PartKind, type PartSound, type Terminal } from './parts/base';
import type { BandVoice } from './audio';
import { Bells, Maracas, Piano, Tuba } from './parts/band';
import { Drum, MusicBox } from './parts/extra';
import { WaterMill } from './parts/mech';
import { blowWind, Pinwheel } from './parts/wind';
import { FireTruck, Helicopter, RaceTrack, TrafficLight } from './parts/fun';
import { Dynamo } from './parts/more';
import { loadModels } from './parts/assets';
import { ALL_ITEMS, createPart, MODEL_NAMES } from './parts/catalog';
import { Stage } from './stage';
import { loadProgress, saveProgress } from './storage';
import { renderThumbs } from './thumbs';
import { drawTraces } from './traces';
import { Voice } from './voice';
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
let won = false;
let goalHeld = 0;
let lastTouch = performance.now();
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
    startLevel(level);
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
    voice.say(level.intro, 0);
  },
  onPickLevel: (l) => {
    sfx.unlock();
    sfx.pop();
    startLevel(l);
  },
  onNext: () => {
    sfx.unlock();
    sfx.pop();
    const i = LEVELS.indexOf(level);
    startLevel(i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : FREE_PLAY);
  },
  bodiesOnScreen: () => partsOnScreen(world),
  wiresOnScreen: () => world.wires.flatMap((w) => w.samples(12).map((p) => stage.project(p))),
  onSpawn: (item, e) => {
    input.spawnFromTray(item.kind, e, item.color);
    voice.say(item.say, 3000);
  },
});
hud.setSound(progress.sound);
hud.setNight(progress.night);
hud.setNeat(progress.neat);
Wire.neat = progress.neat;
stage.setNight(progress.night);
Part.night = progress.night;
Wire.glow = progress.night ? 0.7 : 1.4;

const input = new Input(stage, world, {
  overTray: (x, y) => hud.overTray(x, y),
  onTrayHover: (on) => hud.setTrash(on),
  onTouch: () => {
    sfx.unlock();
    lastTouch = performance.now();
  },
  preferredWire: () => hintedWire(),
  // A tap on a drawer item (no drag) puts the part in a free spot.
  onSpawnTap: (part) => {
    const at = freeSpot(world);
    part.root.position.set(at.x, 0, at.z);
    world.separate(part);
    part.appear();
  },
});

stage.onResize = (flipped) => {
  drawTraces(traces);
  hud.layout();
  if (flipped) frameParts();
};

function frameParts(instant = false) {
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

function startLevel(l: Level, instant = false) {
  level = l;
  won = false;
  goalHeld = 0;
  hintShownOnce = false;
  world.clear();
  hud.showNext(false);
  hud.setLevel(l, progress.done);
  l.parts.forEach((p, i) => {
    // Layouts are drawn for landscape; on a tall screen lay them top-to-bottom.
    const [x, z] = stage.portrait ? [p.fz * 5.5, p.fx * 6.5] : [p.fx * 6.5, p.fz * 4.4];
    const part = world.addPart(p.kind, x, z, { locked: l !== FREE_PLAY, closed: p.closed, appear: false });
    part.appear(0.12 + i * 0.14);
  });
  refreshTray();
  frameParts(instant);
  levelStart = performance.now();
  lastTouch = levelStart;
  setHint(null);
  voice.say(l.intro, 0);
}

function win() {
  won = true;
  progress.done.add(level.id);
  saveProgress(progress);
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
function updateHint(dt: number) {
  hintTimer -= dt;
  if (hintTimer > 0) return;
  hintTimer = 0.25;
  const problem = problemHint(world);
  if (problem) return setHint(problem);
  if (won) return setHint(null);
  const idle = performance.now() - lastTouch;
  // Free play is the child's own experiment: nudge later than in missions.
  const wait = level === FREE_PLAY ? (hintShownOnce ? 9000 : 4000) : hintShownOnce ? 6000 : 1600;
  const h = level === FREE_PLAY ? sandboxHint(world) : levelHint(world, level, trayLeft);
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
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  stage.update(dt);
  world.update(dt);

  if (!won && level !== FREE_PLAY) {
    goalHeld = level.goal(world) ? goalHeld + dt : 0;
    if (goalHeld > 0.5) win();
  }

  updateHint(dt);
  const vis = hintVisible();
  hud.updateHints(dt, vis);
  hud.updateTag(input.carried);
  if (vis && currentHint && spokenKey !== currentKey) {
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
  for (const p of world.parts) {
    for (const snd of p.sounds.splice(0)) playPartSound(snd, p);
    for (const e of p.effects.splice(0)) {
      if (e.kind === 'sparks') fx.burst(e.at, e.n ?? 12, e.color);
      else if (e.kind === 'dust') fx.dust(e.at, e.radius);
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
  sfx.setFan(fan);
  sfx.tickBand(band, music ? song : bandSong);
  sfx.setWater(water);
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
  fx.night = progress.night;
  fx.shine(world.parts.flatMap((p) => p.glowLight() ?? []));
  fx.resize(stage.renderer.domElement.height, stage.camera.fov);
  fx.update(dt);
  hud.updateFx(dt);
  stage.render();
  requestAnimationFrame(frame);
}

// Free play is the main mode; missions wait in the drop-down.
startLevel(FREE_PLAY, true);
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
  startLevel,
  LEVELS,
  FREE_PLAY,
  input,
  hud,
  voice,
  hints: { problemHint, sandboxHint, levelHint },
  /** Wire two terminals directly, skipping the gesture. */
  connect(a: Terminal, b: Terminal) {
    const w = new Wire(a);
    stage.world.add(w.group);
    world.attachWire(w, b);
  },
};
