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
import { drawTraces } from './traces';
import { Voice } from './voice';
import { Wire } from './wires';
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
const voice = new Voice();
const progress = loadProgress();
sfx.setMuted(!progress.sound);
voice.enabled = progress.sound;
setLoad(0.35);

renderThumbs(PART_KINDS);
setLoad(0.75);

const traces = document.getElementById('traces') as unknown as SVGSVGElement;
drawTraces(traces);
window.addEventListener('resize', () => drawTraces(traces));

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
    const part = world.addPart(p.kind, x, z, { locked: true, closed: p.closed, appear: false });
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
  if (!currentHint || input.busy) return false;
  const problem = currentHint.type === 'tapWire' || currentHint.type === 'polarity';
  return problem || performance.now() - lastTouch > 1200;
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
  for (const p of world.parts) {
    if (p.kind === 'fan') fan += Math.abs(p.state.level);
    if (p.kind === 'buzzer' && isActive(p)) buzz = true;
  }
  sfx.setFan(fan);
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

// Boot straight into the first unfinished mission.
startLevel(LEVELS.find((l) => !progress.done.has(l.id)) ?? FREE_PLAY, true);
voice.stop();
requestAnimationFrame((t) => {
  last = t;
  frame(t);
  setLoad(1);
  setTimeout(() => document.getElementById('loader')!.classList.add('is-done'), 350);
});

// Debug/test handle (used by the Playwright smoke tests).
(window as unknown as { __game: unknown }).__game = { world, stage, startLevel, LEVELS, FREE_PLAY, input, hud };
