// Two buttons under the progress card: the sticker album and "My inventions"
// (saved tables). Both open a sheet over the game like the map picker.
import type { Album, Sticker } from './album';
import type { Level } from './levels';
import type { Invention } from './saves';
import { thumb } from './thumbs';

export interface ShelfHooks {
  onSticker(s: Sticker, got: boolean): void;
  onAlbum(): void;
  onInventions(empty: boolean): void;
  /** Save the table; false if there is nothing on it. */
  onSave(): boolean;
  onLoad(inv: Invention): void;
  onDelete(inv: Invention, sure: boolean): void;
  inventions(): Invention[];
  onMachines(): void;
  onMachine(m: Level): void;
  /** The ready-made machines, which are done, and their pictures once got working. */
  machines(): { level: Level; done: boolean; pic?: string }[];
}

const STICKER_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h14v9.5l-5.5 5.5H5z"/><path d="M13.5 19.5V14H19" class="fill"/><path d="m12 7.4 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z" class="fill"/></svg>';
const FOLDER_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v9.3a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M12 10.2v5.6M9.2 13h5.6"/></svg>';
const GEAR_ICON =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l1.3 2.2 2.5-.5.6 2.5 2.4.9-.8 2.4 1.7 1.9-1.9 1.7.8 2.4-2.4.9-.6 2.5-2.5-.5L12 20.5l-1.3-2.2-2.5.5-.6-2.5-2.4-.9.8-2.4L4.3 12l1.9-1.7-.8-2.4 2.4-.9.6-2.5 2.5.5z"/><circle cx="12" cy="12" r="3" class="fill"/></svg>';
const PLUS = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const CROSS = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';

export class Shelf {
  private bar: HTMLElement;
  private albumBtn: HTMLButtonElement;
  private albumSheet: HTMLElement;
  private invSheet: HTMLElement;
  private machSheet: HTMLElement;
  private armed: string | null = null;

  constructor(
    private album: Album,
    private hooks: ShelfHooks,
    root = document.getElementById('hud')!,
  ) {
    this.bar = document.createElement('div');
    this.bar.className = 'shelf';
    this.bar.innerHTML = `
      <button class="shelf-btn album-btn" aria-label="Мои наклейки">${STICKER_ICON}<span class="shelf-count"></span></button>
      <button class="shelf-btn inv-btn" aria-label="Мои изобретения">${FOLDER_ICON}</button>
      <button class="shelf-btn mach-btn" aria-label="Машины">${GEAR_ICON}</button>`;
    // Before the level drop-down, so the open list covers the buttons.
    root.insertBefore(this.bar, root.querySelector('.lessons'));
    this.albumBtn = this.bar.querySelector('.album-btn')!;

    this.albumSheet = sheet('album-sheet', 'Мои наклейки');
    this.invSheet = sheet('inv-sheet', 'Мои изобретения');
    this.machSheet = sheet('mach-sheet', 'Машины');
    root.append(this.albumSheet, this.invSheet, this.machSheet);
    this.bar.querySelector('.mach-btn')!.addEventListener('click', () => {
      this.renderMachines();
      this.machSheet.hidden = false;
      this.hooks.onMachines();
    });
    this.machSheet.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === this.machSheet || t.closest('.sheet-close')) {
        this.machSheet.hidden = true;
        return;
      }
      const card = t.closest<HTMLElement>('.mach-card');
      const m = card && this.hooks.machines().find((x) => x.level.id === card.dataset.id);
      if (!m) return;
      this.machSheet.hidden = true;
      this.hooks.onMachine(m.level);
    });

    this.albumBtn.addEventListener('click', () => {
      this.renderAlbum();
      this.albumSheet.hidden = false;
      this.hooks.onAlbum();
    });
    this.bar.querySelector('.inv-btn')!.addEventListener('click', () => {
      this.renderInventions();
      this.invSheet.hidden = false;
      this.hooks.onInventions(this.hooks.inventions().length === 0);
    });
    for (const s of [this.albumSheet, this.invSheet]) {
      s.addEventListener('click', (e) => {
        if (e.target === s || (e.target as HTMLElement).closest('.sheet-close')) s.hidden = true;
      });
    }
    this.albumSheet.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.sticker');
      if (!el) return;
      const s = this.album.stickers.find((x) => x.id === el.dataset.id);
      if (!s) return;
      el.classList.remove('is-wiggle');
      void el.offsetWidth;
      el.classList.add('is-wiggle');
      this.hooks.onSticker(s, this.album.has(s.id));
    });
    this.invSheet.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.inv-new')) {
        if (this.hooks.onSave()) this.renderInventions();
        return;
      }
      const card = t.closest<HTMLElement>('.inv-card');
      if (!card) return;
      const inv = this.hooks.inventions().find((i) => i.id === card.dataset.id);
      if (!inv) return;
      if (t.closest('.inv-del')) {
        const sure = this.armed === inv.id;
        this.armed = sure ? null : inv.id;
        this.hooks.onDelete(inv, sure);
        this.renderInventions();
        return;
      }
      this.invSheet.hidden = true;
      this.hooks.onLoad(inv);
    });
    this.updateCount();
  }

  updateCount() {
    this.bar.querySelector('.shelf-count')!.textContent = this.album.count ? `${this.album.count}` : '';
  }

  /** A new sticker flies from where it was earned into the album button. */
  fly(s: Sticker, from: { x: number; y: number }) {
    const el = document.createElement('div');
    el.className = 'sticker-fly';
    el.innerHTML = stickerFace(this.album, s);
    document.body.append(el);
    const to = this.albumBtn.getBoundingClientRect();
    const tx = to.left + to.width / 2;
    const ty = to.top + to.height / 2;
    el.style.left = `${from.x}px`;
    el.style.top = `${from.y}px`;
    const anim = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.2) rotate(-30deg)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1.25) rotate(8deg)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${tx - from.x}px), calc(-50% + ${ty - from.y}px)) scale(0.35)`, opacity: 0.9 },
      ],
      { duration: 1700, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' },
    );
    anim.onfinish = () => {
      el.remove();
      this.updateCount();
      this.albumBtn.classList.remove('is-bump');
      void this.albumBtn.offsetWidth;
      this.albumBtn.classList.add('is-bump');
    };
  }

  private renderAlbum() {
    const a = this.album;
    this.albumSheet.querySelector('h2')!.innerHTML = `Мои наклейки <span class="sheet-sub">${a.count} из ${a.total}</span>`;
    this.albumSheet.querySelector('.sheet-body')!.innerHTML = `<div class="sticker-grid">${a.stickers
      .map((s) => `<button class="sticker${a.has(s.id) ? ' is-got' : ''}" data-id="${s.id}">${stickerFace(a, s)}</button>`)
      .join('')}</div>`;
  }

  /** A card per machine: its main part until it has been got working, then its own picture with a star. */
  private renderMachines() {
    const list = this.hooks.machines();
    const n = list.filter((m) => m.done).length;
    this.machSheet.querySelector('h2')!.innerHTML = `Машины <span class="sheet-sub">${n} из ${list.length}</span>`;
    this.machSheet.querySelector('.sheet-body')!.innerHTML = `<div class="inv-grid">${list
      .map(
        (m, i) => `<button class="mach-card${m.done ? ' is-done' : ''}" data-id="${m.level.id}" aria-label="${m.level.title}">
          <img alt="" src="${m.pic ?? thumb(m.level.icon, true)}"/>
          <span class="mach-num">${i + 1}</span>
          ${m.done ? '<span class="mach-star">★</span>' : ''}
        </button>`,
      )
      .join('')}</div>`;
  }

  private renderInventions() {
    const list = this.hooks.inventions();
    this.invSheet.querySelector('.sheet-body')!.innerHTML = `<div class="inv-grid">
      <button class="inv-new" aria-label="Сохранить">${PLUS}</button>
      ${list
        .map(
          (i) => `<div class="inv-card${this.armed === i.id ? ' is-armed' : ''}" data-id="${i.id}" role="button">
            <img alt="" src="${i.pic}"/>
            <button class="inv-del" aria-label="Выбросить">${CROSS}</button>
          </div>`,
        )
        .join('')}
    </div>`;
  }
}

function sheet(cls: string, title: string) {
  const s = document.createElement('section');
  s.className = `maps sheet ${cls}`;
  s.hidden = true;
  s.setAttribute('aria-label', title);
  s.innerHTML = `<div class="maps-card"><button class="sheet-close" aria-label="Закрыть">${CROSS}</button><h2>${title}</h2><div class="sheet-body"></div></div>`;
  return s;
}

function stickerFace(a: Album, s: Sticker) {
  const pic = a.picture(s);
  return pic ? `<img alt="" src="${pic}"/>` : `<span class="sticker-emoji">${s.emoji}</span>`;
}
