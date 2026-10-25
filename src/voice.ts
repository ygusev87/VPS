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
  farm: 'Ферма',
  farmIntro: 'Добро пожаловать на ферму! Животным нужна твоя помощь. Нажми на того, кто зовёт, и он расскажет, что ему нужно.',
  cowHot: 'Му-у! Мне так жарко! Поставь рядом со мной вентилятор и включи его!',
  cowHappy: 'Му-у! Какой приятный ветерок! Спасибо!',
  pigThirsty: 'Хрю-хрю! Я хочу пить! Поставь насос у корыта, пусть он нальёт воды!',
  pigHappy: 'Хрю! Вкусная водичка! Спасибо!',
  gateStuck: 'Трактору нужно в поле, а ворота закрыты! Подключи мотор у ворот, и они откроются.',
  gateHappy: 'Ворота открылись! Трактор поехал в поле!',
  evening: 'Наступает вечер. Солнце садится, и солнечная батарея засыпает до утра.',
  henDark: 'Ко-ко-ко! Темно! Мы не видим зёрнышки! Зажги нам свет!',
  henHappy: 'Ко-ко! Светло! Спасибо!',
  rabbitCold: 'Брр, нам холодно! Поставь к нам обогреватель!',
  rabbitHappy: 'Тепло! Спасибо!',
  foxComes: 'Гав! Гав! Ночью к кроликам крадётся лиса!',
  foxTip: 'Поставь на дорожке кнопку и подключи к ней звонок. Лиса наступит на кнопку, звонок зазвенит, и она убежит!',
  foxScared: 'Ура! Лиса испугалась звонка и убежала!',
  morning: 'Наступило утро! Ты помог всем на ферме! Ты настоящий электрик!',
  pump: 'Насос',
  heater: 'Обогреватель',
  pole: 'Электрический столб',
  solar: 'Солнечная батарея',
  gate: 'Ворота',
  mapPick: 'Куда отправимся?',
  lab: 'Лаборатория',
  poleWeak: 'Столбу не хватает сил на всё сразу. Подключи что-нибудь к солнечной батарее или к ветряку!',
  placeHere: 'Поставь его на кружок рядом!',
  soon: 'Эта карта скоро откроется!',
  snapOk: 'Отлично, на месте! Теперь подключи провода к столбу.',
  farmMove: 'Ферма большая! Двигай её пальчиком, чтобы посмотреть, кто ещё зовёт на помощь.',
  sheepMill: 'Бе-е! Хочу хлебушка, а муки нет! Поставь мельницу на кружок и подключи её к солнечной батарее.',
  sheepHappy: 'Бе-е! Мельница мелет муку! Спасибо!',
  cowSleepy: 'Му-у… Нам не спится. Включи нам музыку, пожалуйста!',
  cowSleep: 'Му-у… Какая красивая песенка. Спокойной ночи!',
  ducksAsk: 'Кря-кря! Доброе утро! Сделай нам фонтан: поставь насос у пруда и подключи его к ветряку!',
  ducksHappy: 'Кря-кря! Фонтан! Ура, как весело!',
  stSheep: 'Овечка',
  stDuck: 'Утята',
  album: 'Мои наклейки',
  newSticker: 'Новая наклейка!',
  albumIntro: 'Это твой альбом. Когда новая деталь заработает, ты получишь наклейку!',
  stickerLocked: 'Эту наклейку ещё нужно заработать. Подключи такую деталь, и она заработает!',
  albumFull: 'Ты собрал все наклейки! Ура!',
  inventions: 'Мои изобретения',
  saved: 'Сохранено! Твоё изобретение лежит в папке.',
  loaded: 'Вот твоё изобретение!',
  inventionsEmpty: 'Здесь пока пусто. Собери что-нибудь на столе и нажми на плюс, чтобы сохранить.',
  deleteAgain: 'Нажми ещё раз, чтобы выбросить.',
  tester: 'Тестер',
  testerTip: 'Тестер показывает, сколько вольт. Подключи его к батарейке: плюс к плюсу, минус к минусу. Потом нажми на него!',
  testerBack: 'Стрелка ушла назад: провода наоборот. Поменяй их местами!',
  v0: 'Ноль вольт. Тока нет.',
  v1: 'Один вольт',
  v2: 'Два вольта',
  v3: 'Три вольта',
  v4: 'Четыре вольта',
  v5: 'Пять вольт',
  v6: 'Шесть вольт',
  v7: 'Семь вольт',
  v8: 'Восемь вольт',
  v9: 'Девять вольт',
  v10: 'Десять вольт',
  v11: 'Одиннадцать вольт',
  v12: 'Двенадцать вольт',
  vMany: 'Очень много вольт!',
  stCow: 'Корова',
  stPig: 'Свинка',
  stHen: 'Курочки',
  stRabbit: 'Кролики',
  stTractor: 'Трактор',
  stFox: 'Лиса',
  stChain: 'Цепочка',
  magnet: 'Электромагнит',
  magnetTip: 'Магнит поймал шарик! Выключи магнит, и шарик покатится дальше.',
  magnetOff: 'Выключи рубильник, и магнит отпустит шарик!',
  l17: 'Магнит поймает шарик на лету. Подключи всё, а потом выключи магнит рубильником, и шарик полетит в мишень!',
  winBulb: 'Ура! Лампочка горит!',
  winFan: 'Ура! Вентилятор крутится!',
  winLed: 'Ура! Светодиод светится!',
  winBuzz: 'Ура! Пищалка пищит!',
  win: 'Молодец! Всё получилось!',
  next: 'Нажми на стрелку, чтобы играть дальше!',
  // The farm's second day.
  dayTwo: 'Наступил новый день! На ферме проснулись новые друзья, и им тоже нужна твоя помощь!',
  kittenStuck: 'Мяу! Я залез на сеновал и не могу слезть! Поставь рядом лифт и подними его ко мне!',
  kittenRide: 'Мяу! Я в лифте! Теперь поменяй провода местами, и лифт поедет вниз!',
  kittenHappy: 'Мур-мур! Я на земле! Спасибо!',
  liftUp: 'Лифт едет вниз, а котёнок наверху. Поменяй провода местами, и лифт поедет вверх!',
  goatsAsk: 'Ме-е! Козлятам скучно! Поставь у загона карусель и включи её!',
  goatsHappy: 'Ме-е-е! Как весело кататься! Спасибо!',
  beesAsk: 'Жу-жу! Цветы не распускаются без воды, и пчёлкам нечего собирать! Полей клумбу насосом!',
  beesHappy: 'Жу-жу! Цветы распустились! Пчёлки летят за мёдом!',
  horseHot: 'И-го-го! В конюшне так жарко! Поставь мне вентилятор!',
  horseHappy: 'И-го-го! Свежий ветерок! Спасибо!',
  puppyAsk: 'Гав! Я хочу играть в мячик! Поставь пушку, пусть она бросает мне мячики!',
  puppyHappy: 'Гав-гав! Поймал! Какая весёлая игра!',
  eggsCold: 'Яйцам в гнезде холодно! Поставь рядом лампу или обогреватель, чтобы им было тепло!',
  chicksHatched: 'Пи-пи-пи! Вылупились цыплята! Ура!',
  geeseDark: 'Га-га-га! У пруда темно, мы не видим дорожку! Зажги нам фонарик!',
  geeseHappy: 'Га-га! Светло! Спасибо!',
  roosterAsk: 'Утро, а петушок охрип и не может разбудить ферму! Поставь рядом звонок и включи его!',
  roosterHappy: 'Ку-ка-ре-ку! Все проснулись! Доброе утро!',
  stKitten: 'Котёнок',
  stGoat: 'Козлята',
  stBee: 'Пчёлки',
  stHorse: 'Лошадка',
  stPuppy: 'Щенок',
  stChick: 'Цыплята',
  stGoose: 'Гуси',
  stRooster: 'Петушок',
  // The city.
  city: 'Город',
  cityIntro: 'Добро пожаловать в город! Жителям нужна твоя помощь. Нажми на того, кто зовёт, и он расскажет, что случилось.',
  cityMove: 'Город большой! Двигай его пальчиком, чтобы посмотреть, кто ещё ждёт помощи.',
  carsAsk: 'Би-би! Светофор не горит, и машины не могут проехать перекрёсток! Поставь светофор и подключи его к столбу!',
  carsHappy: 'Би-бип! Светофор работает, поехали! Спасибо!',
  tramAsk: 'Дзынь-дзынь! Трамвай стоит: на подстанции нет тока. Поставь рубильник, соедини столб, рубильник и подстанцию в одну цепочку и включи рубильник!',
  tramHappy: 'Дзынь! Трамвай поехал! Спасибо!',
  bakerAsk: 'Печь холодная, и хлеб не печётся! Поставь у печки обогреватель, а рядом ленту — она повезёт булки на прилавок. Подключи обе к столбу!',
  bakerHappy: 'Ах, какой румяный хлеб! Спасибо, помощник!',
  pigeonsAsk: 'Гуль-гуль! Фонтан не работает! Поставь у фонтана насос. Столба в парке нет — поставь ветряк, ветер даст ток!',
  pigeonsHappy: 'Гуль-гуль! Фонтан бьёт! Спасибо!',
  grandmaAsk: 'Ох, корзинка с продуктами тяжёлая, а я живу наверху! Поставь у дома лифт и кнопку, соедини их со столбом в одну цепочку и держи кнопку — лифт поднимет корзинку ко мне на балкон!',
  grandmaHappy: 'Вот и мои продукты! Спасибо, внучок!',
  liftWrongWay: 'Лифт едет вниз. Поменяй провода местами, и он поедет вверх!',
  kittenDark: 'Мяу! Стемнело, и я не вижу дорогу домой! Зажги три фонарика вдоль дорожки!',
  kittenHome: 'Мур! Теперь видно дорожку! Спасибо!',
  clubAsk: 'В клубе вечеринка! Поставь диско-шар, а рядом фотодатчик и музыкальную шкатулку. Свет шара упадёт на датчик, и заиграет музыка!',
  clubHappy: 'Ура! Дискотека! Все танцуют!',
  fireAsk: 'Тревога! Из домика идёт дым! Включи пожарную машину у пожарной части, а у домика поставь насос — он будет поливать огонь!',
  fireHappy: 'Пожар потушен! Ты настоящий пожарный!',
  raccoonComes: 'Ночью к магазину игрушек крадётся енот, он хочет порыться в мусорных баках!',
  raccoonTip: 'Поставь на дорожке домино и подключи к нему звонок. Енот заденет костяшки, они упадут, звонок зазвенит — и енот убежит!',
  raccoonScared: 'Ура! Енот испугался звонка и убежал!',
  schoolAsk: 'Доброе утро! Школьный звонок включает лазерный луч. Поставь лазер, зеркало и фотодатчик, подключи к датчику звонок и направь луч через зеркало на датчик!',
  schoolHappy: 'Дзынь-дзынь! Дети побежали на урок!',
  cityEvening: 'Наступает вечер. В городе зажигаются огни.',
  lookAround: 'Кто ещё ждёт помощи? Нажми на того, у кого над головой облачко!',
  chainStart: 'Протяни проводок к этой детали.',
  chainNext: 'Теперь протяни проводок дальше, к следующей детали.',
  chainBack: 'И последний проводок — обратно, чтобы цепочка замкнулась!',
  cityDone: 'Наступило утро! Ты помог всем в городе! Ты настоящий электрик!',
  stCar: 'Машинки',
  stTram: 'Трамвай',
  stBaker: 'Пекарь',
  stPigeon: 'Голуби',
  stGrandma: 'Бабушка',
  stKid: 'Дети',
  stFirefighter: 'Пожарный',
  stRaccoon: 'Енот',
  stSchool: 'Школа',
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
  private endsAt = 0;

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

  /**
   * Hook up to the game's audio graph once it exists (after a first touch), and
   * again whenever it is rebuilt: decoded clips are not tied to a context.
   */
  attach(ctx: AudioContext, out: AudioNode) {
    const first = !this.ctx;
    if (!first) this.stop();
    this.ctx = ctx;
    this.out = out;
    if (!first) return;
    // Decode one clip at a time in the background: decoding all ~200 at once
    // on the first touch made the first seconds of play stutter on an iPad.
    const queue = [...this.raw.keys()];
    const next = () => {
      const id = queue.shift();
      if (!id) return;
      void this.decode(id).then(() => setTimeout(next, 15));
    };
    next();
  }

  private decoding = new Map<PhraseId, Promise<AudioBuffer | null>>();

  /** Decode a clip (once); also used to jump the queue for a phrase that is wanted now. */
  private decode(id: PhraseId): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    let p = this.decoding.get(id);
    if (!p) {
      p = (this.raw.get(id) ?? Promise.resolve(null)).then(async (buf) => {
        if (!buf) return null;
        try {
          const clip = await ctx.decodeAudioData(buf.slice(0));
          this.clips.set(id, clip);
          return clip;
        } catch {
          return null; // Undecodable clip: synthesis covers it.
        }
      });
      this.decoding.set(id, p);
    }
    return p;
  }

  /** Say a phrase; the same phrase is not repeated within `cooldown` ms. */
  say(id: PhraseId, cooldown = 6000) {
    if (!this.enabled) return;
    const now = performance.now();
    if (this.last && this.last.id === id && now - this.last.at < cooldown) return;
    this.last = { id, at: now };
    this.stop();
    const clip = this.clips.get(id);
    // Not decoded yet: decode it now and speak a moment later (better than the robot voice).
    if (!clip && this.ctx && this.raw.has(id)) {
      const asked = this.last;
      void this.decode(id).then((c) => {
        if (this.last !== asked) return; // Something else was said meanwhile.
        if (c) {
          this.last = null;
          this.say(id, 0);
        } else this.speak(id);
      });
      return;
    }
    if (clip && this.ctx && this.out) {
      const src = this.ctx.createBufferSource();
      src.buffer = clip;
      src.connect(this.out);
      src.start();
      this.playing = src;
      this.endsAt = now + clip.duration * 1000;
      return;
    }
    this.speak(id);
  }

  /** The browser's own voice, for a phrase without a clip. */
  private speak(id: PhraseId) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(PHRASES[id]);
    u.lang = 'ru-RU';
    if (this.voice) u.voice = this.voice;
    u.rate = 0.95;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  }

  /** Still talking (a clip playing or the synthesiser speaking)? */
  get busy() {
    if (this.playing) return performance.now() < this.endsAt;
    return 'speechSynthesis' in window && speechSynthesis.speaking;
  }

  stop() {
    try {
      this.playing?.stop();
    } catch {
      // Already finished.
    }
    this.playing = null;
    // Only when it is talking: on an iPad a needless cancel can take the audio away from the game.
    if ('speechSynthesis' in window && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
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
