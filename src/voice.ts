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
  xylophone: 'Ксилофон',
  drum: 'Барабан',
  track: 'Гоночная трасса',
  firetruck: 'Пожарная машина',
  helicopter: 'Вертолёт',
  trafficLight: 'Светофор',
  disco: 'Диско-шар',
  heliMore: 'Вертолёту не хватает сил, чтобы взлететь. Подключи большую батарею или две батарейки друг за другом!',
  heliFly: 'Ура! Вертолёт летит!',
  dynamo: 'Динамо-машина',
  crank: 'Покрути ручку пальчиком, и появится электричество!',
  lift: 'Лифт',
  liftSwap: 'Поменяй провода местами, и лифт поедет вниз!',
  crane: 'Подъёмный кран',
  craneHold: 'Магнит держит шарики! Поверни кран к ведёрку и выключи магнит.',
  craneDone: 'Ура! Все шарики в ведёрке!',
  trafficCar: 'Машинка ждёт зелёный свет!',
  trash: 'Чтобы убрать деталь, отнеси её в корзину.',
  batteryFight: 'Большую и маленькую батарейку так не соединяют: большая гонит ток в маленькую. Убери этот провод и соедини их друг за другом: плюс одной к минусу другой, и сил станет больше!',
  needPower: 'Сначала подключи его к батарейке, и он заиграет!',
  tapSong: 'Нажми на шкатулку, и заиграет другая песенка!',
  toPair: 'Теперь подключи вторую ножку к соседнему кружочку под той же кнопкой.',
  floorFan: 'Напольный вентилятор',
  pcFan: 'Компьютерный вентилятор',
  pinwheel: 'Вертушка',
  pinwheelTip: 'Поставь вертушку перед вентилятором, и она закрутится!',
  piano: 'Пианино',
  tuba: 'Туба',
  maracas: 'Маракасы',
  bells: 'Колокольчики',
  bandTip: 'Подключи ещё инструменты, и они сыграют вместе, как настоящий оркестр!',
  marbleRun: 'Шариковая горка',
  waterMill: 'Водяная мельница',
  conveyor: 'Конвейер',
  windGen: 'Ветряк',
  lightSensor: 'Фотодатчик',
  launcher: 'Пушка с шариком',
  target: 'Мишень',
  domino: 'Домино',
  windTip: 'Поставь вентилятор перед ветряком и включи его. Ветряк сделает электричество из ветра!',
  lightTip: 'Посвети на фотодатчик лампочкой, и он включит свою цепь!',
  targetTip: 'Попади в мишень шариком или нажми на неё пальчиком!',
  dominoTip: 'Толкни домино шариком или пальчиком!',
  aimTip: 'Нажми на пушку, и она повернётся в другую сторону.',
  useSwitch: 'Лампочка горит! А теперь сделай так, чтобы её включал выключатель.',
  winChain: 'Ура! Цепочка сработала!',
  l8: 'Ветряк делает электричество из ветра! Подуй на него вентилятором и зажги светодиод.',
  l9: 'Фотодатчик включается от света. Зажги лампочку рядом с ним, и закрутится вентилятор!',
  l10: 'Пушка стреляет шариком. Попади в мишень, и запищит пищалка!',
  l11: 'Шарик толкнёт домино, а домино включит лампочку!',
  l12: 'Большая цепочка! Вентилятор крутит ветряк, ветряк включает пушку, шарик попадает в мишень, и загорается лампочка!',
  switchBeside: 'Эта деталь стоит сбоку, и ток бежит мимо неё. Убери этот провод и подключи её на пути тока: от батарейки к ней, а от неё к следующей детали.',
  laser: 'Лазер',
  mirror: 'Зеркало',
  mirrorTip: 'Нажми на зеркало, и оно повернётся. Пусть луч попадёт в фотодатчик!',
  laserTip: 'Лазер светит тонким лучом. Нажми на него, и он повернётся. Направь луч на фотодатчик!',
  l13: 'Лазерный луч! Поверни зеркало так, чтобы луч попал в фотодатчик, и зажжётся лампочка.',
  l14: 'Два зеркала! Проведи луч лазера вокруг и попади в фотодатчик.',
  bell: 'Звонок',
  belt: 'Транспортёр',
  beltTip: 'Поставь транспортёр на пути шарика, и он повезёт его дальше!',
  l15: 'Шарик упадёт на транспортёр, и он отвезёт его к мишени. Тогда зазвенит звонок!',
  l16: 'Мастерская цепочек! Собери свою цепочку: пусть одна деталь запускает другую.',
  chainWow: 'Вот это цепочка! Здорово придумал!',
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
  readonly clips = new Map<PhraseId, AudioBuffer>();
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
      // Resolved against the page, not this module (which lives in assets/).
      const mod = (await import(/* @vite-ignore */ new URL(`voice/${id}.js`, document.baseURI).href)) as { default: string };
      return Uint8Array.from(atob(mod.default), (c) => c.charCodeAt(0)).buffer;
    }
    const r = await fetch(`${import.meta.env.BASE_URL}voice/${id}.mp3`);
    return r.ok ? await r.arrayBuffer() : null;
  } catch {
    return null;
  }
}
