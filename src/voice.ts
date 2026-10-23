// Spoken hints and names, in Russian. Each phrase id has a recorded clip
// (Higgsfield text2speech_v2, ElevenLabs voice "Elena"); the text below is
// what was recorded and what speech synthesis falls back to.

export const PHRASES = {
  hello: 'Привет! Давай собирать схемы!',
  l1: 'Зажги лампочку! Соедини батарейку и лампочку проводами.',
  l2: 'Включи вентилятор! Соедини его с батарейкой.',
  l3: 'Собери схему с выключателем, а потом нажми на него!',
  l4: 'Зажги светодиод! Красный плюс соединяй с красным плюсом.',
  l5: 'Сделай так, чтобы пищалка запищала!',
  l6: 'Перетащи две лампочки на стол и зажги их обе!',
  l7: 'Включи и лампочку, и вентилятор!',
  free: 'Свободная игра! Бери детали и пробуй что хочешь.',
  connect: 'Проведи пальчиком от кружочка к кружочку.',
  drag: 'Перетащи деталь на стол.',
  tapSwitch: 'Нажми на выключатель!',
  short: 'Ой-ой! Плюс и минус батарейки соединились напрямую. Батарейка греется! Нажми на этот провод, чтобы убрать его.',
  reversed: 'Светодиод подключён наоборот. Убери этот провод, а потом соедини красный плюс с красным плюсом!',
  buzzerReversed: 'Пищалка подключена наоборот. Убери этот провод, а потом соедини красный плюс с красным плюсом!',
  bypass: 'Обе ножки подключены к одному и тому же месту, поэтому ток бежит мимо. Убери этот провод.',
  toPlus: 'Теперь подключи вторую ножку к плюсу батарейки.',
  toMinus: 'Теперь подключи вторую ножку к минусу батарейки.',
  needBattery: 'Чтобы всё заработало, нужна батарейка. Перетащи её на стол.',
  weak: 'Батарейке не хватает сил на всё сразу. Поставь ещё одну батарейку или возьми большую батарею.',
  musicReversed: 'Шкатулка подключена наоборот. Убери этот провод, а потом соедини красный плюс с красным плюсом!',
  holdButton: 'Нажми на кнопку и держи!',
  tapPanel: 'Нажми на цветную кнопку на пульте!',
  battery: 'Батарейка',
  bigBattery: 'Большая батарея',
  bulb: 'Лампочка',
  bulbRed: 'Красная лампочка',
  bulbGreen: 'Зелёная лампочка',
  bulbBlue: 'Синяя лампочка',
  ledRed: 'Красный светодиод',
  ledGreen: 'Зелёный светодиод',
  ledBlue: 'Синий светодиод',
  ledYellow: 'Жёлтый светодиод',
  fan: 'Вентилятор',
  carousel: 'Карусель',
  windmill: 'Мельница',
  buzzer: 'Пищалка',
  musicbox: 'Музыкальная шкатулка',
  switch: 'Рубильник',
  button: 'Кнопка',
  panel: 'Пульт с кнопками',
  winBulb: 'Ура! Лампочка горит!',
  winFan: 'Ура! Вентилятор крутится!',
  winLed: 'Ура! Светодиод светится!',
  winBuzz: 'Ура! Пищалка пищит!',
  win: 'Молодец! Всё получилось!',
  next: 'Нажми на стрелку, чтобы играть дальше!',
} as const;

export type PhraseId = keyof typeof PHRASES;

/**
 * Recorded clips (public/voice/<id>.mp3, a natural Russian voice) played
 * through WebAudio; the browser's speech synthesis stands in for any clip
 * that is missing or not loaded yet.
 */
export class Voice {
  enabled = true;
  private voice: SpeechSynthesisVoice | null = null;
  private last: { id: PhraseId; at: number } | null = null;
  private ctx: AudioContext | null = null;
  private out: AudioNode | null = null;
  private raw = new Map<PhraseId, Promise<ArrayBuffer | null>>();
  private clips = new Map<PhraseId, AudioBuffer>();
  private playing: AudioBufferSourceNode | null = null;

  constructor() {
    // Fetch every clip up front (about 1 MB) so they also work offline later.
    for (const id of Object.keys(PHRASES) as PhraseId[]) this.raw.set(id, fetchClip(id));
    if (!('speechSynthesis' in window)) return;
    const pick = () => {
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ru'));
      // Prefer the nicer local voices where present.
      this.voice = voices.find((v) => /milena|katya|алёна|alena|premium|enhanced/i.test(v.name)) ?? voices[0] ?? null;
    };
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
  }

  /** Hook up to the game's audio graph once it exists (after a first touch). */
  attach(ctx: AudioContext, out: AudioNode) {
    if (this.ctx) return;
    this.ctx = ctx;
    this.out = out;
    for (const [id, p] of this.raw) {
      void p.then(async (buf) => {
        if (!buf) return;
        try {
          this.clips.set(id, await ctx.decodeAudioData(buf.slice(0)));
        } catch {
          // Undecodable clip: synthesis covers it.
        }
      });
    }
  }

  /** Say a phrase; the same phrase is not repeated within `cooldown` ms. */
  say(id: PhraseId, cooldown = 6000) {
    if (!this.enabled) return;
    const now = performance.now();
    if (this.last && this.last.id === id && now - this.last.at < cooldown) return;
    this.last = { id, at: now };
    this.stop();
    const clip = this.clips.get(id);
    if (clip && this.ctx && this.out) {
      const src = this.ctx.createBufferSource();
      src.buffer = clip;
      src.connect(this.out);
      src.start();
      this.playing = src;
      return;
    }
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(PHRASES[id]);
    u.lang = 'ru-RU';
    if (this.voice) u.voice = this.voice;
    u.rate = 0.95;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  }

  stop() {
    try {
      this.playing?.stop();
    } catch {
      // Already finished.
    }
    this.playing = null;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}

async function fetchClip(id: PhraseId): Promise<ArrayBuffer | null> {
  try {
    if (import.meta.env.VITE_MODELS_AS_JS) {
      // Preview host: clips ship as JS modules holding base64.
      const mod = (await import(/* @vite-ignore */ `${import.meta.env.BASE_URL}voice/${id}.js`)) as { default: string };
      return Uint8Array.from(atob(mod.default), (c) => c.charCodeAt(0)).buffer;
    }
    const r = await fetch(`${import.meta.env.BASE_URL}voice/${id}.mp3`);
    return r.ok ? await r.arrayBuffer() : null;
  } catch {
    return null;
  }
}
