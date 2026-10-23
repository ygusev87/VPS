// Everything drawn in HTML over the 3D table, laid out like the reference:
// a parts sidebar on the left, brand and mission card top-left, progress
// top-right, a strip of lesson cards at the bottom and a small view bar.
import * as THREE from 'three';
import type { Hint } from './hints';
import { FREE_PLAY, LEVELS, type Level } from './levels';
import type { Part, PartKind } from './parts/base';
import { PART_KINDS } from './parts/models';
import type { Stage } from './stage';
import { thumb } from './thumbs';

const svg = (inner: string, cls = 'icon', vb = '0 0 24 24') => `<svg class="${cls}" viewBox="${vb}" aria-hidden="true">${inner}</svg>`;

const ICON = {
  out: svg('<path d="M5 12h14"/>'),
  in: svg('<path d="M12 5v14M5 12h14"/>'),
  compass: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 5.2 14.2 12h-4.4z" class="fill"/><path d="M12 18.8 9.8 12h4.4z"/>'),
  flow: svg('<path d="M2.5 15.5c4.2 0 5.3-7 9.5-7s5.3 7 9.5 7"/><circle cx="6.6" cy="13" r="1.7" class="fill"/><circle cx="12" cy="8.5" r="1.7" class="fill"/><circle cx="17.4" cy="13" r="1.7" class="fill"/>'),
  soundOn: svg('<path d="M4 9.5h3.4L12 5.5v13l-4.6-4H4z" class="fill"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>'),
  soundOff: svg('<path d="M4 9.5h3.4L12 5.5v13l-4.6-4H4z" class="fill"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
  restart: svg('<path d="M4.5 10.5A8 8 0 1 1 6 17"/><path d="M4 5v5.8h5.8"/>'),
  speak: svg('<path d="M4 9.5h3.4L12 5.5v13l-4.6-4H4z" class="fill"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6"/>'),
  book: svg('<path d="M20 10.6c-3.3-2.4-8.2-3.2-14-3v21.2c5.8-.2 10.7.6 14 3 3.3-2.4 8.2-3.2 14-3V7.6c-5.8-.2-10.7.6-14 3zM20 10.6v21.2"/><path d="M3 11v21c6.3-.5 12.6.2 17 2.6 4.4-2.4 10.7-3.1 17-2.6V11"/>', 'icon book', '0 0 40 40'),
  bin: svg('<path d="M4.5 7h15M9.5 7V4.8h5V7M7 7l1 13.5h8L17 7M10.5 10.5v6.5M13.5 10.5v6.5"/>'),
  next: svg('<path d="M5 12h13M12.5 6.5 18 12l-5.5 5.5"/>'),
  chevron: svg('<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>', 'icon chevron'),
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-8.5"/></svg>',
  star: '<svg viewBox="0 0 64 64" class="star" aria-hidden="true"><path d="M32 5.5 40.2 22l18.3 2.7-13.2 12.9 3.1 18.2L32 47.2l-16.4 8.6 3.1-18.2L5.5 24.7 23.8 22z" fill="#f0a53a" stroke="#24304a" stroke-width="3" stroke-linejoin="round"/><path d="M24 26.5c2-1 4.5-1.2 6.5-.6" stroke="#fff6d6" stroke-width="3" stroke-linecap="round" fill="none"/></svg>',
  shortBadge: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M18 3 7 18h7l-2 11 13-16h-7.5z" fill="#e5533d" stroke="#24304a" stroke-width="2" stroke-linejoin="round"/></svg>',
  bypassBadge: '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="#e5533d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20h22"/><path d="M9 20c0-7 4-11 7-11s7 4 7 11"/><path d="m20 6 3 3-3 3"/></svg>',
  swapBadge: '<svg viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="#e5533d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11h18M19 6l5 5-5 5M26 21H8M13 16l-5 5 5 5"/></svg>',
  hand: `<svg class="hand" viewBox="0 0 64 80" aria-hidden="true">
    <path d="M26 4c4.4 0 7 3 7 7.5V30l9.3 1.6c6.8 1.2 10.7 5.6 10.2 12.6l-1.2 13.6C50.6 67 44.6 74 34.6 74h-5.2c-6.5 0-11.4-3.3-14.2-9.1L8.1 50.2c-1.7-3.5-.3-7 3.1-8.1 2.9-.9 5.4.4 7 3.1l.8 1.4V11.5C19 7 21.6 4 26 4z" fill="#fffaf2" stroke="#18213d" stroke-width="3" stroke-linejoin="round"/>
    <path d="M33 30v12M41.5 32v11" fill="none" stroke="#18213d" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`,
  logo: '<svg class="brand-logo" viewBox="0 0 64 64" aria-hidden="true"><path d="M36 5 15 36h14l-4 23 23-33H34z"/></svg>',
};

export const PART_NAMES: Record<PartKind, string> = {
  battery: 'Батарейки',
  bulb: 'Лампочка',
  fan: 'Вентилятор',
  switch: 'Выключатель',
  led: 'Светодиод',
  buzzer: 'Пищалка',
};

export interface HudHooks {
  onRestart(): void;
  onSound(on: boolean): void;
  onFlow(on: boolean): void;
  onZoom(factor: number): void;
  onResetView(): void;
  onReplay(): void;
  onPickLevel(level: Level): void;
  onNext(): void;
  onSpawn(kind: PartKind, e: PointerEvent): void;
}

export class Hud {
  private root = document.getElementById('hud')!;
  private sidebar!: HTMLElement;
  private mission!: HTMLElement;
  private lessons!: HTMLElement;
  private progress!: HTMLElement;
  private hints!: HTMLElement;
  private trail!: SVGPathElement;
  private hand!: HTMLElement;
  private haloA!: HTMLElement;
  private haloB!: HTMLElement;
  private badge!: HTMLElement;
  private tag!: HTMLElement;
  private fx!: HTMLCanvasElement;
  private soundBtn!: HTMLButtonElement;
  private flowBtn!: HTMLButtonElement;
  private nextBtn: HTMLElement | null = null;
  private hint: Hint | null = null;
  private hintT = 0;
  private hintScreen: { a: () => { x: number; y: number }; b?: () => { x: number; y: number } } | null = null;
  private confetti: Confetto[] = [];
  private level: Level = LEVELS[0];
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
      <div class="tag"></div>
      <nav class="sidebar" aria-label="Детали">
        <div class="side-parts">
          ${PART_KINDS.map(
            (k) => `<button class="part-btn" data-kind="${k}" aria-label="${PART_NAMES[k]}" title="${PART_NAMES[k]}">
              <img alt="" src="${thumb(k)}"/><span class="count"></span></button>`,
          ).join('')}
        </div>
        <div class="bin">${ICON.bin}</div>
      </nav>
      <header class="brand">
        ${ICON.logo}
        <span class="brand-rule" aria-hidden="true"></span>
        <div class="brand-text"><h1>Электро-стол</h1><p>Собери<i>·</i>Включи<i>·</i>Узнай</p></div>
      </header>
      <article class="mission">
        <img alt=""/>
        <div class="mission-text"><h3></h3><p></p></div>
        <button class="speak" aria-label="Повторить задание">${ICON.speak}</button>
      </article>
      <button class="status" aria-label="Задания" aria-expanded="false">
        ${ICON.book}
        <div class="progress-body">
          <span class="progress-label">Задания</span>
          <div class="progress-row"><span class="progress-track"><span class="progress-fill"></span></span><span class="progress-count"></span></div>
        </div>
        ${ICON.chevron}
      </button>
      <section class="lessons" aria-label="Задания">
        <ol class="lesson-list"></ol>
      </section>
      <div class="viewbar" role="toolbar" aria-label="Вид">
        <button data-v="out" aria-label="Отдалить">${ICON.out}</button>
        <button data-v="in" aria-label="Приблизить">${ICON.in}</button>
        <span class="sep"></span>
        <button data-v="reset" class="compass" aria-label="Показать всё">${ICON.compass}</button>
        <span class="sep"></span>
        <button data-v="flow" class="toggle is-on" aria-label="Показывать ток" aria-pressed="true">${ICON.flow}</button>
        <button data-v="sound" class="toggle is-on" aria-label="Звук" aria-pressed="true">${ICON.soundOn}</button>
        <button data-v="restart" aria-label="Начать заново">${ICON.restart}</button>
      </div>
      <canvas class="fx"></canvas>
    `;
    this.sidebar = r.querySelector('.sidebar')!;
    this.mission = r.querySelector('.mission')!;
    this.lessons = r.querySelector('.lesson-list')!;
    this.progress = r.querySelector('.status')!;
    this.hints = r.querySelector('.hints')!;
    this.trail = r.querySelector('.trail path')!;
    this.hand = r.querySelector('.hand')!;
    this.haloA = r.querySelector('.halo.a')!;
    this.haloB = r.querySelector('.halo.b')!;
    this.badge = r.querySelector('.badge')!;
    this.tag = r.querySelector('.tag')!;
    this.fx = r.querySelector('.fx')!;
    this.soundBtn = r.querySelector('[data-v="sound"]')!;
    this.flowBtn = r.querySelector('[data-v="flow"]')!;
    this.hints.style.opacity = '0';

    r.querySelector('[data-v="out"]')!.addEventListener('click', () => this.hooks.onZoom(1.25));
    r.querySelector('[data-v="in"]')!.addEventListener('click', () => this.hooks.onZoom(0.8));
    r.querySelector('[data-v="reset"]')!.addEventListener('click', () => this.hooks.onResetView());
    r.querySelector('[data-v="restart"]')!.addEventListener('click', () => this.hooks.onRestart());
    this.mission.querySelector('.speak')!.addEventListener('click', () => this.hooks.onReplay());
    // Missions live in a drop-down under the progress card; free play is the main mode.
    this.progress.addEventListener('click', () => this.toggleTasks());
    this.soundBtn.addEventListener('click', () => {
      const on = !this.soundBtn.classList.contains('is-on');
      this.setSound(on);
      this.hooks.onSound(on);
    });
    this.flowBtn.addEventListener('click', () => {
      const on = !this.flowBtn.classList.contains('is-on');
      this.flowBtn.classList.toggle('is-on', on);
      this.flowBtn.setAttribute('aria-pressed', String(on));
      this.hooks.onFlow(on);
    });

    this.sidebar.querySelectorAll<HTMLElement>('.part-btn').forEach((btn) => {
      const kind = btn.dataset.kind as PartKind;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if ((this.trayLeft[kind] ?? 0) <= 0) {
          btn.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], 260);
          return;
        }
        this.hooks.onSpawn(kind, e);
      });
    });

    window.addEventListener('resize', () => this.layout());
    // iOS: block pinch-zoom of the page and double-tap zoom.
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setSound(on: boolean) {
    this.soundBtn.classList.toggle('is-on', on);
    this.soundBtn.setAttribute('aria-pressed', String(on));
    this.soundBtn.innerHTML = on ? ICON.soundOn : ICON.soundOff;
  }

  // ───────── Level, lessons, parts ─────────

  toggleTasks(open = !this.root.querySelector('.lessons')!.classList.contains('is-open')) {
    this.root.querySelector('.lessons')!.classList.toggle('is-open', open);
    this.progress.classList.toggle('is-open', open);
    this.progress.setAttribute('aria-expanded', String(open));
  }

  setLevel(level: Level, done: Set<string>) {
    this.level = level;
    const img = this.mission.querySelector('img')!;
    img.src = thumb(level.icon, true);
    this.mission.querySelector('h3')!.textContent = level.task;
    const i = LEVELS.indexOf(level);
    this.mission.querySelector('p')!.textContent = `Задание ${i + 1} из ${LEVELS.length}`;
    this.mission.classList.toggle('is-hidden', level === FREE_PLAY);

    const n = LEVELS.filter((l) => done.has(l.id)).length;
    this.progress.querySelector<HTMLElement>('.progress-fill')!.style.width = `${(n / LEVELS.length) * 100}%`;
    this.progress.querySelector('.progress-count')!.textContent = `${n}/${LEVELS.length}`;

    const next = LEVELS.find((l) => !done.has(l.id));
    const all = [...LEVELS, FREE_PLAY];
    this.lessons.innerHTML = all
      .map((l, idx) => {
        const free = l === FREE_PLAY;
        const cls = ['lesson', l === level ? 'is-active' : '', done.has(l.id) ? 'is-done' : '', l === next && l !== level ? 'is-next' : ''].join(' ');
        return `<li class="${cls}" role="button" tabindex="0" data-i="${free ? 'free' : idx}" aria-label="${l.title}">
          <img class="lesson-thumb" alt="" src="${thumb(l.icon, !free)}"/>
          <span class="lesson-title">${free ? 'Свободная игра' : `${idx + 1}. ${l.title}`}</span>
          <span class="lesson-done">${ICON.check}</span>
        </li>`;
      })
      .join('');
    this.lessons.querySelectorAll<HTMLElement>('.lesson').forEach((el) =>
      el.addEventListener('click', () => {
        const d = el.dataset.i!;
        this.toggleTasks(false);
        this.hooks.onPickLevel(d === 'free' ? FREE_PLAY : LEVELS[Number(d)]);
      }),
    );
    this.layout();
  }

  updateTray(left: Partial<Record<PartKind, number>>) {
    this.trayLeft = left;
    this.sidebar.querySelectorAll<HTMLElement>('.part-btn').forEach((btn) => {
      const n = left[btn.dataset.kind as PartKind] ?? 0;
      btn.classList.toggle('is-off', n <= 0);
      const c = btn.querySelector<HTMLElement>('.count')!;
      c.hidden = !(Number.isFinite(n) && n > 0);
      c.textContent = String(n);
    });
  }

  private layout() {
    const side = this.sidebar.getBoundingClientRect();
    const brand = this.root.querySelector('.brand')!.getBoundingClientRect();
    const bar = this.root.querySelector('.viewbar')!.getBoundingClientRect();
    this.stage.setInsets({
      left: side.right,
      top: brand.bottom + 8,
      bottom: Math.max(16, window.innerHeight - bar.top + 8),
      right: 12,
    });
  }

  relayout() {
    this.layout();
  }

  overTray(x: number, y: number) {
    const r = this.sidebar.getBoundingClientRect();
    return x <= r.right + 10 && y >= r.top && y <= r.bottom;
  }

  setTrash(on: boolean) {
    this.sidebar.classList.toggle('is-trash', on);
  }

  trayCardCenter(kind: PartKind): { x: number; y: number } | null {
    const c = this.sidebar.querySelector<HTMLElement>(`.part-btn[data-kind="${kind}"]`);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /** Name tag over the part being carried, like the reference's labels. */
  updateTag(part: Part | null) {
    if (!part) {
      this.tag.classList.remove('is-on');
      return;
    }
    const p = this.stage.project(part.root.localToWorld(new THREE.Vector3(0, 1.5, 0)));
    this.tag.textContent = PART_NAMES[part.kind];
    this.tag.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
    this.tag.classList.add('is-on');
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
        this.hintScreen = { a: at((o) => h.wire.pointAt(h.u, o)) };
        this.badge.innerHTML = h.problem === 'short' ? ICON.shortBadge : h.problem === 'reversed' ? ICON.swapBadge : ICON.bypassBadge;
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
    this.sidebar.querySelectorAll('.part-btn').forEach((c) => c.classList.toggle('is-pulse', show && h?.type === 'drag' && (c as HTMLElement).dataset.kind === h.kind));
    if (!h || !this.hintScreen) return;
    this.hintT += dt;
    const A = this.hintScreen.a();
    const B = this.hintScreen.b?.();
    const place = (el: HTMLElement, p: { x: number; y: number } | undefined) => {
      el.style.display = p ? '' : 'none';
      if (p) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
    };
    const red = h.type === 'tapWire';
    this.haloA.classList.toggle('is-red', red);
    this.haloB.classList.toggle('is-red', red);
    place(this.haloA, h.type === 'drag' ? undefined : A);
    place(this.haloB, h.type === 'drag' ? undefined : B);
    this.trail.classList.toggle('is-red', red);

    const bend = (P: { x: number; y: number }, Q: { x: number; y: number }) => ({
      x: (P.x + Q.x) / 2,
      y: Math.min(P.y, Q.y) - Math.abs(P.x - Q.x) * 0.12 - 20,
    });
    if (B) {
      const M = bend(A, B);
      this.trail.setAttribute('d', `M${A.x},${A.y} Q${M.x},${M.y} ${B.x},${B.y}`);
    } else this.trail.setAttribute('d', '');

    if (this.badge.innerHTML) {
      const p = h.type === 'tapWire' && h.at ? this.stage.project(h.at.root.localToWorld(new THREE.Vector3(0, 1.6, 0))) : { ...A };
      // Keep the badge clear of the spot the finger should press.
      const gap = Math.hypot(p.x - A.x, p.y - A.y);
      if (gap < 70) {
        const dir = gap > 1 ? { x: (p.x - A.x) / gap, y: (p.y - A.y) / gap } : { x: 0, y: -1 };
        p.x = A.x + dir.x * 70;
        p.y = A.y + dir.y * 70;
      }
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
    if (B) {
      const cycle = 2.6;
      const t = this.hintT % cycle;
      if (t < 0.35) press = t / 0.35;
      else if (t < 1.75) {
        press = 1;
        const u = easeInOut((t - 0.35) / 1.4);
        const M = bend(A, B);
        hx = (1 - u) * (1 - u) * A.x + 2 * (1 - u) * u * M.x + u * u * B.x;
        hy = (1 - u) * (1 - u) * A.y + 2 * (1 - u) * u * M.y + u * u * B.y;
      } else {
        hx = B.x;
        hy = B.y;
        press = Math.max(0, 1 - (t - 1.75) / 0.25);
        alpha = Math.max(0, 1 - (t - 2.1) / 0.5);
      }
    } else {
      const t = this.hintT % 1.1;
      press = t < 0.5 ? Math.sin((t / 0.5) * Math.PI) : 0;
      hx = A.x + 12;
      hy = A.y + 10;
    }
    this.hand.style.opacity = String(alpha);
    this.hand.style.transform = `translate(${hx}px, ${hy + (1 - press) * -8}px) scale(${1 - press * 0.12}) rotate(-12deg)`;
  }

  // ───────── Celebration ─────────

  celebrate() {
    const win = document.createElement('div');
    win.className = 'win';
    win.innerHTML = ICON.star;
    const card = this.progress.getBoundingClientRect();
    const star = win.querySelector<SVGElement>('.star')!;
    const sx = this.stage.insets.left + (window.innerWidth - this.stage.insets.left) / 2;
    const sy = window.innerHeight * 0.42;
    star.style.left = `${sx}px`;
    star.style.top = `${sy}px`;
    if (card) {
      star.style.setProperty('--fly-x', `${card.left + card.width / 2 - sx}px`);
      star.style.setProperty('--fly-y', `${card.top + card.height / 2 - sy}px`);
    }
    this.root.appendChild(win);
    setTimeout(() => win.remove(), 1700);
    this.burst(sx, sy, 90);
  }

  showNext(show: boolean) {
    if (show && !this.nextBtn) {
      const b = document.createElement('button');
      b.className = 'next';
      b.setAttribute('aria-label', 'Дальше');
      b.innerHTML = `<span>Дальше</span>${ICON.next}`;
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
      const s = 220 + Math.random() * 520;
      this.confetti.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 380,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 14,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        c: colors[i % colors.length],
        life: 1.8 + Math.random() * 1,
      });
    }
  }

  /** Little sparks where a wire clips on. */
  sparks(p: { x: number; y: number }) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 160;
      this.confetti.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, r: 0, vr: 0, w: 4, h: 4, c: i % 2 ? '#ffcf6b' : '#1aa3a1', life: 0.4 + Math.random() * 0.25, round: true });
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
      p.vy += 1200 * dt;
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

  get currentLevel() {
    return this.level;
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
