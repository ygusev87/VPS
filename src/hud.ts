// Everything drawn in HTML over the 3D table: mission card, buttons, the
// parts tray, the level picker, hint hand and the celebration.
import * as THREE from 'three';
import type { Hint } from './hints';
import { FREE_PLAY, LEVELS, type Level } from './levels';
import type { PartKind } from './parts/base';
import { PART_KINDS } from './parts/models';
import type { Stage } from './stage';
import { thumb } from './thumbs';

const svg = (inner: string, cls = 'icon', vb = '0 0 32 32') => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;

const ICON = {
  home: svg('<rect x="5" y="5" width="9.5" height="9.5" rx="2.4"/><rect x="17.5" y="5" width="9.5" height="9.5" rx="2.4"/><rect x="5" y="17.5" width="9.5" height="9.5" rx="2.4"/><rect x="17.5" y="17.5" width="9.5" height="9.5" rx="2.4" class="fill"/>'),
  soundOn: svg('<path d="M5 12.5h4.5L16 7v18l-6.5-5.5H5z" class="fill"/><path d="M20.5 11.5a6 6 0 0 1 0 9M23.8 8a11 11 0 0 1 0 16"/>'),
  soundOff: svg('<path d="M5 12.5h4.5L16 7v18l-6.5-5.5H5z" class="fill"/><path d="m21 12 7 8M28 12l-7 8"/>'),
  reset: svg('<path d="M7.5 15.5A8.5 8.5 0 1 0 10 9.6"/><path d="M8.6 4.8 9.8 10l5.2-1.2"/>'),
  next: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 16h17M17 8.5 24.5 16 17 23.5"/></svg>',
  bin: svg('<path d="M6.5 9h19M13 9V6.5h6V9M9 9l1.3 17h11.4L23 9M13.5 13v9M18.5 13v9"/>'),
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4.2 4.2 8.8-9"/></svg>',
  star: '<svg viewBox="0 0 64 64" class="star" aria-hidden="true"><path d="M32 5.5 40.2 22l18.3 2.7-13.2 12.9 3.1 18.2L32 47.2l-16.4 8.6 3.1-18.2L5.5 24.7 23.8 22z" fill="#f0a53a" stroke="#24304a" stroke-width="3" stroke-linejoin="round"/><path d="M24 26.5c2-1 4.5-1.2 6.5-.6" stroke="#fff6d6" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
  shortBadge: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18 3 7 18h7l-2 11 13-16h-7.5z" fill="#e5533d" stroke="#24304a" stroke-width="2" stroke-linejoin="round"/></svg>',
  swapBadge: '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="#e5533d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11h18M19 6l5 5-5 5M26 21H8M13 16l-5 5 5 5"/></svg>',
  hand: `<svg class="hand" viewBox="0 0 64 80" aria-hidden="true">
    <path d="M26 4c4.4 0 7 3 7 7.5V30l9.3 1.6c6.8 1.2 10.7 5.6 10.2 12.6l-1.2 13.6C50.6 67 44.6 74 34.6 74h-5.2c-6.5 0-11.4-3.3-14.2-9.1L8.1 50.2c-1.7-3.5-.3-7 3.1-8.1 2.9-.9 5.4.4 7 3.1l.8 1.4V11.5C19 7 21.6 4 26 4z" fill="#fffaf2" stroke="#18213d" stroke-width="3" stroke-linejoin="round"/>
    <path d="M33 30v12M41.5 32v11" fill="none" stroke="#18213d" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`,
};

export interface HudHooks {
  onHome(): void;
  onReset(): void;
  onSound(on: boolean): void;
  onPickLevel(level: Level): void;
  onNext(): void;
  onSpawn(kind: PartKind, e: PointerEvent): void;
}

export class Hud {
  private root = document.getElementById('hud')!;
  private mission!: HTMLElement;
  private tray!: HTMLElement;
  private home!: HTMLElement;
  private hints!: HTMLElement;
  private trail!: SVGPathElement;
  private hand!: HTMLElement;
  private haloA!: HTMLElement;
  private haloB!: HTMLElement;
  private badge!: HTMLElement;
  private fx!: HTMLCanvasElement;
  private soundBtn!: HTMLButtonElement;
  private nextBtn: HTMLElement | null = null;
  private hint: Hint | null = null;
  private hintT = 0;
  private hintScreen: { a: () => { x: number; y: number }; b?: () => { x: number; y: number } } | null = null;
  private confetti: Confetto[] = [];
  trayLeft: Partial<Record<PartKind, number>> = {};

  constructor(
    private stage: Stage,
    private hooks: HudHooks,
  ) {
    this.build();
  }

  private build() {
    const r = this.root;
    r.innerHTML = `
      <div class="hints">
        <svg class="trail"><path/></svg>
        <div class="halo a"></div><div class="halo b"></div>
        <div class="badge"></div>
        ${ICON.hand}
      </div>
      <header class="top">
        <div class="mission card" aria-label="Задание"><img alt=""/><div class="dots"></div></div>
        <div class="actions">
          <button class="btn card" data-act="reset" aria-label="Начать заново">${ICON.reset}</button>
          <button class="btn card" data-act="sound" aria-label="Звук">${ICON.soundOn}</button>
          <button class="btn card" data-act="home" aria-label="Все задания">${ICON.home}</button>
        </div>
      </header>
      <nav class="tray is-hidden" aria-label="Детали"><div class="bin">${ICON.bin}</div></nav>
      <canvas class="fx"></canvas>
      <section class="home is-hidden" aria-label="Задания"></section>
    `;
    this.mission = r.querySelector('.mission')!;
    this.tray = r.querySelector('.tray')!;
    this.home = r.querySelector('.home')!;
    this.hints = r.querySelector('.hints')!;
    this.trail = r.querySelector('.trail path')!;
    this.hand = r.querySelector('.hand')!;
    this.haloA = r.querySelector('.halo.a')!;
    this.haloB = r.querySelector('.halo.b')!;
    this.badge = r.querySelector('.badge')!;
    this.fx = r.querySelector('.fx')!;
    this.soundBtn = r.querySelector('[data-act="sound"]')!;
    this.hints.style.opacity = '0';

    r.querySelector('[data-act="home"]')!.addEventListener('click', () => this.hooks.onHome());
    r.querySelector('[data-act="reset"]')!.addEventListener('click', () => this.hooks.onReset());
    this.soundBtn.addEventListener('click', () => {
      const on = this.soundBtn.classList.contains('is-off');
      this.setSound(on);
      this.hooks.onSound(on);
    });
    window.addEventListener('resize', () => this.layout());
    // iOS: block pinch-zoom and double-tap zoom gestures over the HUD.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setSound(on: boolean) {
    this.soundBtn.classList.toggle('is-off', !on);
    this.soundBtn.innerHTML = on ? ICON.soundOn : ICON.soundOff;
  }

  // ───────── Level & tray ─────────

  setLevel(level: Level, done: Set<string>) {
    const img = this.mission.querySelector('img')!;
    img.src = thumb(level.icon, true);
    const dots = this.mission.querySelector('.dots')!;
    if (level === FREE_PLAY) {
      dots.innerHTML = '';
    } else {
      dots.innerHTML = LEVELS.map(
        (l) => `<span class="dot${done.has(l.id) ? ' is-done' : ''}${l === level ? ' is-current' : ''}"></span>`,
      ).join('');
    }

    this.tray.querySelectorAll('.part-card').forEach((c) => c.remove());
    for (const { kind } of level.tray) {
      const card = document.createElement('button');
      card.className = 'part-card';
      card.dataset.kind = kind;
      card.setAttribute('aria-label', kind);
      card.innerHTML = `<img alt="" src="${thumb(kind)}"/><span class="count"></span>`;
      card.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if ((this.trayLeft[kind] ?? 0) <= 0) {
          card.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], 300);
          return;
        }
        this.hooks.onSpawn(kind, e);
      });
      this.tray.appendChild(card);
    }
    this.tray.classList.toggle('is-hidden', level.tray.length === 0);
    this.layout();
  }

  updateTray(left: Partial<Record<PartKind, number>>) {
    this.trayLeft = left;
    this.tray.querySelectorAll<HTMLElement>('.part-card').forEach((card) => {
      const n = left[card.dataset.kind as PartKind] ?? 0;
      card.classList.toggle('is-empty', n <= 0);
      const c = card.querySelector<HTMLElement>('.count')!;
      c.style.display = Number.isFinite(n) && n > 0 ? '' : 'none';
      c.textContent = String(n);
    });
  }

  private layout() {
    const cards = this.tray.querySelectorAll('.part-card').length;
    if (cards) {
      const avail = window.innerWidth - 24 - 16 - (cards - 1) * 8;
      const size = Math.max(44, Math.min(96, Math.floor(avail / cards)));
      this.tray.style.setProperty('--card-size', `${size}px`);
    }
    const top = this.root.querySelector('.top')!.getBoundingClientRect().bottom + 6;
    // offsetHeight, not the rect: the tray may be mid-transition.
    const safeB = parseFloat(getComputedStyle(this.tray).bottom) || 12;
    const bottom = this.tray.classList.contains('is-hidden') ? 16 : this.tray.offsetHeight + safeB + 8;
    this.stage.setInsets({ top, bottom, left: 10, right: 10 });
  }

  overTray(x: number, y: number) {
    if (this.tray.classList.contains('is-hidden')) return false;
    const r = this.tray.getBoundingClientRect();
    return x >= r.left - 20 && x <= r.right + 20 && y >= r.top - 24 && y <= r.bottom + 20;
  }

  setTrash(on: boolean) {
    this.tray.classList.toggle('is-trash', on);
  }

  trayCardCenter(kind: PartKind): { x: number; y: number } | null {
    const c = this.tray.querySelector<HTMLElement>(`.part-card[data-kind="${kind}"]`);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // ───────── Home ─────────

  showHome(done: Set<string>) {
    const next = LEVELS.find((l) => !done.has(l.id));
    this.home.innerHTML = `
      <div class="brand">
        <svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><path class="logo-bolt" d="M36 6 16 36h14l-4 22 22-32H34z"/></svg>
        <span class="brand-rule"></span>
        <div><h1>Электро-стол</h1><p>Собери · Включи · Узнай</p></div>
      </div>
      <div class="levels">
        ${LEVELS.map(
          (l, i) => `<button class="level-card${l === next ? ' is-next' : ''}" data-i="${i}" aria-label="Задание ${i + 1}">
            <img alt="" src="${thumb(l.icon, true)}"/><span class="num">${i + 1}</span>
            ${done.has(l.id) ? `<span class="done">${ICON.check}</span>` : ''}
          </button>`,
        ).join('')}
        <button class="level-card is-free" data-i="free" aria-label="Свободная игра">
          ${PART_KINDS.map((k) => `<img alt="" src="${thumb(k, true)}"/>`).join('')}
        </button>
      </div>`;
    this.home.querySelectorAll<HTMLElement>('.level-card').forEach((el) =>
      el.addEventListener('click', () => {
        const i = el.dataset.i!;
        this.hooks.onPickLevel(i === 'free' ? FREE_PLAY : LEVELS[Number(i)]);
      }),
    );
    this.home.classList.remove('is-hidden');
  }

  hideHome() {
    this.home.classList.add('is-hidden');
  }

  get homeOpen() {
    return !this.home.classList.contains('is-hidden');
  }

  // ───────── Hints ─────────

  setHint(h: Hint | null) {
    if (h === this.hint) return;
    this.hint = h;
    this.hintT = 0;
    this.hintScreen = null;
    this.badge.innerHTML = '';
    if (!h) return;
    const v = new THREE.Vector3();
    const at = (fn: (out: THREE.Vector3) => THREE.Vector3) => () => this.stage.project(fn(v));
    switch (h.type) {
      case 'connect':
        this.hintScreen = { a: at((o) => h.from.attachPoint(o)), b: at((o) => h.to.attachPoint(o)) };
        break;
      case 'tap':
        this.hintScreen = { a: at((o) => h.part.root.localToWorld(o.set(0, 0.6, -0.15))) };
        break;
      case 'tapWire':
        this.hintScreen = { a: at((o) => h.wire.midpoint(o)) };
        this.badge.innerHTML = ICON.shortBadge;
        break;
      case 'polarity':
        this.hintScreen = { a: at((o) => h.plus.attachPoint(o)), b: at((o) => h.batteryPlus.attachPoint(o)) };
        this.badge.innerHTML = ICON.swapBadge;
        break;
      case 'drag': {
        const to = h.to.clone();
        this.hintScreen = {
          a: () => this.trayCardCenter(h.kind) ?? { x: 0, y: 0 },
          b: () => this.stage.project(to),
        };
        break;
      }
    }
  }

  /** Per-frame: move the hand along its little choreography. */
  updateHints(dt: number, visible: boolean) {
    const h = this.hint;
    const show = visible && !!h && !!this.hintScreen;
    const op = Number(this.hints.style.opacity || 0);
    this.hints.style.opacity = String(THREE.MathUtils.damp(op, show ? 1 : 0, 8, dt));
    this.tray.querySelectorAll('.part-card').forEach((c) => c.classList.toggle('is-pulse', show && h?.type === 'drag' && (c as HTMLElement).dataset.kind === h.kind));
    if (!h || !this.hintScreen) return;
    this.hintT += dt;
    const A = this.hintScreen.a();
    const B = this.hintScreen.b?.();
    const place = (el: HTMLElement, p: { x: number; y: number } | undefined) => {
      el.style.display = p ? '' : 'none';
      if (p) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    };
    const red = h.type === 'tapWire' || h.type === 'polarity';
    this.haloA.classList.toggle('is-red', red);
    this.haloB.classList.toggle('is-red', red);
    place(this.haloA, A);
    place(this.haloB, h.type === 'drag' ? undefined : B);
    this.trail.classList.toggle('is-red', red);

    if (B) {
      const mx = (A.x + B.x) / 2;
      const my = Math.min(A.y, B.y) - Math.abs(A.x - B.x) * 0.15 - 30;
      this.trail.setAttribute('d', `M${A.x},${A.y} Q${mx},${my} ${B.x},${B.y}`);
    } else this.trail.setAttribute('d', '');

    // Badge floats above the problem spot.
    if (this.badge.innerHTML) {
      const p = h.type === 'tapWire' && h.battery ? this.stage.project(h.battery.root.localToWorld(new THREE.Vector3(0, 1.6, 0))) : h.type === 'polarity' ? this.stage.project(h.part.root.localToWorld(new THREE.Vector3(0, 1.8, 0))) : A;
      // Positioned with left/top: its bobbing animation owns `transform`.
      this.badge.style.display = '';
      this.badge.style.left = `${p.x}px`;
      this.badge.style.top = `${p.y}px`;
    } else this.badge.style.display = 'none';

    // Hand: press at A, travel to B, lift; or tap-tap at A.
    let hx = A.x;
    let hy = A.y;
    let press = 0;
    let alpha = 1;
    if (B && h.type !== 'polarity') {
      const cycle = 2.6;
      const t = this.hintT % cycle;
      if (t < 0.35) press = t / 0.35;
      else if (t < 1.75) {
        press = 1;
        const u = easeInOut((t - 0.35) / 1.4);
        const mx = (A.x + B.x) / 2;
        const my = Math.min(A.y, B.y) - Math.abs(A.x - B.x) * 0.15 - 30;
        hx = (1 - u) * (1 - u) * A.x + 2 * (1 - u) * u * mx + u * u * B.x;
        hy = (1 - u) * (1 - u) * A.y + 2 * (1 - u) * u * my + u * u * B.y;
      } else {
        hx = B.x;
        hy = B.y;
        press = Math.max(0, 1 - (t - 1.75) / 0.25);
        alpha = Math.max(0, 1 - (t - 2.1) / 0.5);
      }
    } else {
      const t = this.hintT % 1.1;
      press = t < 0.5 ? Math.sin((t / 0.5) * Math.PI) : 0;
      hx = A.x + 18;
      hy = A.y + 14;
    }
    this.hand.style.opacity = String(alpha);
    this.hand.style.transform = `translate(${hx}px, ${hy + (1 - press) * -10}px) scale(${1 - press * 0.12}) rotate(-12deg)`;
  }

  // ───────── Celebration ─────────

  celebrate() {
    const win = document.createElement('div');
    win.className = 'win';
    win.innerHTML = ICON.star;
    const m = this.mission.getBoundingClientRect();
    const star = win.querySelector<SVGElement>('.star')!;
    star.style.setProperty('--fly-x', `${m.left + 32 - window.innerWidth / 2}px`);
    star.style.setProperty('--fly-y', `${m.top + 32 - window.innerHeight / 2}px`);
    this.root.appendChild(win);
    setTimeout(() => {
      win.remove();
      this.mission.classList.remove('is-celebrating');
      void this.mission.offsetWidth;
      this.mission.classList.add('is-celebrating');
    }, 1600);
    this.burst(window.innerWidth / 2, window.innerHeight * 0.45, 140);
  }

  showNext(show: boolean) {
    if (show && !this.nextBtn) {
      const b = document.createElement('button');
      b.className = 'next';
      b.setAttribute('aria-label', 'Дальше');
      b.innerHTML = ICON.next;
      b.addEventListener('click', () => this.hooks.onNext());
      this.root.appendChild(b);
      this.nextBtn = b;
    } else if (!show && this.nextBtn) {
      this.nextBtn.remove();
      this.nextBtn = null;
    }
  }

  burst(x: number, y: number, n: number) {
    const colors = ['#1aa3a1', '#f0a53a', '#e5533d', '#24304a', '#3f8a4f', '#ffcf6b'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 300 + Math.random() * 700;
      this.confetti.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 500,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 14,
        w: 8 + Math.random() * 8,
        h: 5 + Math.random() * 6,
        c: colors[i % colors.length],
        life: 2.2 + Math.random() * 1.2,
      });
    }
  }

  /** Little sparks where a wire clips on. */
  sparks(p: { x: number; y: number }) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 220;
      this.confetti.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, r: 0, vr: 0, w: 5, h: 5, c: i % 2 ? '#ffcf6b' : '#1aa3a1', life: 0.45 + Math.random() * 0.3, round: true });
    }
  }

  updateFx(dt: number) {
    const c = this.fx;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.confetti = this.confetti.filter((p) => (p.life -= dt) > 0);
    for (const p of this.confetti) {
      p.vy += 1400 * dt;
      p.vx *= 1 - 1.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += p.vr * dt;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.scale(1, Math.cos(p.r * 1.7));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
  }

  relayout() {
    this.layout();
  }
}

interface Confetto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  w: number;
  h: number;
  c: string;
  life: number;
  round?: boolean;
}

function easeInOut(t: number) {
  t = Math.min(1, Math.max(0, t));
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
