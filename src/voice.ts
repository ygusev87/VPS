// Spoken hints through the browser's built-in speech synthesis (Russian).
// Quality depends on the device: iPads ship a good ru-RU voice ("Milena").
// Later this can be swapped for recorded clips keyed by the same phrase ids.

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
  winBulb: 'Ура! Лампочка горит!',
  winFan: 'Ура! Вентилятор крутится!',
  winLed: 'Ура! Светодиод светится!',
  winBuzz: 'Ура! Пищалка пищит!',
  win: 'Молодец! Всё получилось!',
  next: 'Нажми на стрелку, чтобы играть дальше!',
} as const;

export type PhraseId = keyof typeof PHRASES;

export class Voice {
  enabled = true;
  private voice: SpeechSynthesisVoice | null = null;
  private last: { id: PhraseId; at: number } | null = null;

  constructor() {
    if (!('speechSynthesis' in window)) {
      this.enabled = false;
      return;
    }
    const pick = () => {
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ru'));
      // Prefer the nicer local voices where present.
      this.voice = voices.find((v) => /milena|katya|алёна|alena|premium|enhanced/i.test(v.name)) ?? voices[0] ?? null;
    };
    pick();
    speechSynthesis.addEventListener?.('voiceschanged', pick);
  }

  get available() {
    return 'speechSynthesis' in window;
  }

  /** Say a phrase; the same phrase is not repeated within `cooldown` ms. */
  say(id: PhraseId, cooldown = 6000) {
    if (!this.enabled || !this.available) return;
    const now = performance.now();
    if (this.last && this.last.id === id && now - this.last.at < cooldown) return;
    this.last = { id, at: now };
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(PHRASES[id]);
    u.lang = 'ru-RU';
    if (this.voice) u.voice = this.voice;
    u.rate = 0.95;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  }

  stop() {
    if (this.available) speechSynthesis.cancel();
  }
}
