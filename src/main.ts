import * as THREE from 'three';
import './style.css';
import { Sfx } from './audio';
import { hintKey, levelHint, problemHint, type Hint } from './hints';
import { Hud } from './hud';
import { Input } from './input';
import { FREE_PLAY, LEVELS, type Level } from './levels';
import type { PartKind } from './parts/base';
import { PART_KINDS } from './parts/models';
import { Stage } from './stage';
import { loadProgress, saveProgress } from './storage';
import { renderThumbs } from './thumbs';
import { Voice } from './voice';
import { isActive, World } from './world';

const loaderFill = document.querySelector<HTMLElement>('.loader-fill')!;
const setLoad = (f: number) => (loaderFill.style.transform = `scaleX(${f})`);

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const stage = new Stage(canvas);
const world = new World(stage);
const sfx = new Sfx();
const voice = new Voice();
const progress = loadProgress();
sfx.setMuted(!progress.sound);
voice.enabled = progress.sound;
setLoad(0.35);

renderThumbs(PART_KINDS);
setLoad(0.75);

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
  onHome: () => {
    sfx.unlock();
    sfx.pop();
    hud.showHome(progress.done);
  },
  onReset: () => {
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
  onPickLevel: (l) => {
    sfx.unlock();
    sfx.pop();
    hud.hideHome();
    startLevel(l);
  },
  onNext: () => {
    sfx.unlock();
    sfx.pop();
    const i = LEVELS.indexOf(level);
    if (i >= 0 && i < LEVELS.length - 1) startLevel(LEVELS[i + 1]);
    else {
      hud.showNext(false);
      hud.showHome(progress.done);
    }
  },
  onSpawn: (kind, e) => input.spawnFromTray(kind, e),
});
hud.setSound(progress.sound);

const input = new Input(stage, world, {
  overTray: (x, y) => hud.overTray(x, y),
  onTrayHover: (on) => hud.setTrash(on),
  onTouch: () => {
    sfx.unlock();
    lastTouch = performance.now();
  },
});

stage.onBoundsChange = () => {
  for (const p of world.parts) world.clamp(p);
};

function preplaced(kind: PartKind) {
  return level.parts.filter((p) => p.kind === kind).length;
}

function trayLeft(kind: PartKind): number {
  const offer = level.tray.find((t) => t.kind === kind);
  if (!offer) return 0;
  const placed = world.parts.filter((p) => p.kind === kind).length - preplaced(kind);
  return offer.count - placed;
}

function refreshTray() {
  const left: Partial<Record<PartKind, number>> = {};
  for (const t of level.tray) left[t.kind] = trayLeft(t.kind);
  hud.updateTray(left);
}

function startLevel(l: Level) {
  level = l;
  won = false;
  goalHeld = 0;
  hintShownOnce = false;
  world.clear();
  hud.showNext(false);
  hud.setLevel(l, progress.done);
  const { hx, hz } = stage.bounds;
  l.parts.forEach((p, i) => {
    // Layouts are drawn for landscape; on a tall screen swap the axes.
    const [x, z] = stage.portrait ? [p.fz * hx * 1.4, p.fx * hz * 0.9] : [p.fx * hx, p.fz * hz];
    const part = world.addPart(p.kind, x, z, { locked: true, closed: p.closed, appear: false });
    world.clamp(part);
    part.appear(0.12 + i * 0.14);
  });
  refreshTray();
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
  hud.setLevel(level, progress.done);
  refreshTray();
  setTimeout(() => {
    if (won) {
      hud.showNext(true);
      setTimeout(() => won && voice.say('next', 20000), 1800);
    }
  }, 1700);
}

function setHint(h: Hint | null) {
  const key = hintKey(h);
  if (key === currentKey) return;
  currentKey = key;
  currentHint = h;
  hud.setHint(h);
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
      if (e.wire.b) hud.sparks(stage.project(e.wire.b.attachPoint(tmp)));
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
      sfx.click();
      break;
    case 'activated':
      if (e.part.kind === 'bulb' || e.part.kind === 'led') sfx.ting();
      if (e.part.kind === 'fan') sfx.whir();
      break;
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
  if (hud.homeOpen) return setHint(null);
  const problem = problemHint(world);
  if (problem) return setHint(problem);
  if (won) return setHint(null);
  const idle = performance.now() - lastTouch;
  const wait = hintShownOnce ? 6000 : 1600;
  const h = levelHint(world, level, trayLeft);
  if (!h) return setHint(null);
  // Keep showing a hint that is already up; new ones wait for the child to pause.
  if (currentHint && hintKey(currentHint) === hintKey(h)) return;
  if (idle > wait && performance.now() - levelStart > 1200) {
    hintShownOnce = true;
    setHint(h);
  } else setHint(null);
}

function hintVisible() {
  if (!currentHint || input.busy || hud.homeOpen) return false;
  const problem = currentHint.type === 'tapWire' || currentHint.type === 'polarity';
  return problem || performance.now() - lastTouch > 1200;
}

// ───────── Main loop ─────────

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  world.update(dt);

  if (!won && level !== FREE_PLAY && !hud.homeOpen) {
    goalHeld = level.goal(world) ? goalHeld + dt : 0;
    if (goalHeld > 0.5) win();
  }

  updateHint(dt);
  const vis = hintVisible();
  hud.updateHints(dt, vis);
  if (vis && currentHint && spokenKey !== currentKey) {
    spokenKey = currentKey;
    voice.say(currentHint.phrase, 9000);
  }

  let fan = 0;
  let buzz = false;
  for (const p of world.parts) {
    if (p.kind === 'fan') fan += Math.abs(p.state.level);
    if (p.kind === 'buzzer' && isActive(p)) buzz = true;
  }
  sfx.setFan(hud.homeOpen ? 0 : fan);
  if (hud.homeOpen) buzz = false;
  buzzerRefresh -= dt;
  if (buzz !== buzzerOn || (buzz && buzzerRefresh <= 0)) {
    buzzerOn = buzz;
    buzzerRefresh = 5;
    sfx.setBuzzer(buzz);
  }

  hud.updateFx(dt);
  stage.render();
  requestAnimationFrame(frame);
}

// Boot: level 1 sits behind the picker so the table is alive from the start.
startLevel(LEVELS[0]);
voice.stop();
hud.showHome(progress.done);
requestAnimationFrame((t) => {
  last = t;
  frame(t);
  setLoad(1);
  setTimeout(() => document.getElementById('loader')!.classList.add('is-done'), 350);
});

// Debug/test handle (used by the Playwright smoke test).
(window as unknown as { __game: unknown }).__game = { world, stage, startLevel, LEVELS, FREE_PLAY, input, hud };
