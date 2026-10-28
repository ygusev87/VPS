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
  turnTile: 'Поверни плитку — пусть провод соединится!',
  tapReverser: 'Нажми на стрелку — вперёд или назад!',
  twoHands: 'Нажми и держи обе зелёные кнопки сразу — двумя пальчиками!',
  latheSlow: 'Станок крутится слишком медленно. Поменяй шестерёнки местами!',
  latheFast: 'Слишком быстро! Поменяй шестерёнки местами — большую сюда, маленькую туда.',
  latheOk: 'Как раз! Станок точит игрушку.',
  plugShape: 'Найди розетку такой же формы!',
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
  balloon: 'Воздушный шарик',
  skittles: 'Кегли',
  garland: 'Гирлянда',
  kettle: 'Чайник',
  windTip: 'Поставь вентилятор перед ветряком и включи его. Ветряк сделает электричество из ветра!',
  lightTip: 'Посвети на фотодатчик лампочкой, и он включит свою цепь!',
  targetTip: 'Попади в мишень шариком или нажми на неё пальчиком!',
  dominoTip: 'Толкни домино шариком или пальчиком!',
  balloonTip: 'Лопни шарик — пушкой, лазером или пальчиком!',
  skittlesTip: 'Сбей кегли шариком из пушки!',
  aimTip: 'Нажми на пушку, и она повернётся в другую сторону.',
  wrongWire: 'Этот провод ведёт не туда. Нажми на него, чтобы убрать.',
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
  cowHot: 'Мне так жарко! Поставь рядом со мной вентилятор и включи его!',
  cowHappy: 'Какой приятный ветерок! Спасибо!',
  pigThirsty: 'Я хочу пить! Поставь насос у корыта, пусть он нальёт воды!',
  pigHappy: 'Вкусная водичка! Спасибо!',
  gateStuck: 'Трактору нужно в поле, а ворота закрыты! Подключи мотор у ворот, и они откроются.',
  gateHappy: 'Ворота открылись! Трактор поехал в поле!',
  evening: 'Наступает вечер. Солнце садится, и солнечная батарея засыпает до утра.',
  henDark: 'Темно! Мы не видим зёрнышки! Зажги нам свет!',
  henHappy: 'Светло! Спасибо!',
  rabbitCold: 'Брр, нам холодно! Поставь к нам обогреватель!',
  rabbitHappy: 'Тепло! Спасибо!',
  foxComes: 'Ночью к кроликам крадётся лиса!',
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
  placeHere: 'Поставь его на подсвеченное место рядом!',
  soon: 'Эта карта скоро откроется!',
  snapOk: 'Отлично, на месте! Теперь подключи провода к столбу.',
  farmMove: 'Ферма большая! Двигай её пальчиком, чтобы посмотреть, кто ещё зовёт на помощь.',
  sheepMill: 'Хочу хлебушка, а муки нет! Поставь мельницу на подсвеченное место и подключи её к солнечной батарее.',
  sheepHappy: 'Мельница мелет муку! Спасибо!',
  cowSleepy: 'Нам не спится. Включи нам музыку, пожалуйста!',
  cowSleep: 'Какая красивая песенка. Спокойной ночи!',
  ducksAsk: 'Доброе утро! Сделай нам фонтан: поставь насос у пруда и подключи его к ветряку!',
  ducksHappy: 'Фонтан! Ура, как весело!',
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
  v0: 'Ноль вольт.',
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
  kittenStuck: 'Я залез на сеновал и не могу слезть! Поставь рядом лифт и подними его ко мне!',
  kittenRide: 'Я в лифте! Теперь поменяй провода местами, и лифт поедет вниз!',
  kittenHappy: 'Я на земле! Спасибо!',
  liftUp: 'Лифт едет вниз, а котёнок наверху. Поменяй провода местами, и лифт поедет вверх!',
  goatsAsk: 'Нам скучно! Поставь у нашего загона карусель и включи её!',
  goatsHappy: 'Как весело кататься! Спасибо!',
  beesAsk: 'Цветы не распускаются без воды, и пчёлкам нечего собирать! Полей клумбу насосом!',
  beesHappy: 'Цветы распустились! Пчёлки летят за мёдом!',
  horseHot: 'В конюшне так жарко! Поставь мне вентилятор!',
  horseHappy: 'Свежий ветерок! Спасибо!',
  puppyAsk: 'Я хочу играть в мячик! Поставь пушку, пусть она бросает мне мячики!',
  puppyHappy: 'Поймал! Какая весёлая игра!',
  eggsCold: 'Яйцам в гнезде холодно! Поставь рядом лампу или обогреватель, чтобы им было тепло!',
  chicksHatched: 'Вылупились цыплята! Ура!',
  geeseDark: 'У пруда темно, мы не видим дорожку! Зажги нам фонарик!',
  geeseHappy: 'Светло! Спасибо!',
  roosterAsk: 'Утро, а петушок охрип и не может разбудить ферму! Поставь рядом звонок и включи его!',
  roosterHappy: 'Все проснулись! Доброе утро!',
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
  barrier: 'Шлагбаум',
  ferris: 'Колесо обозрения',
  carWash: 'Автомойка',
  drawbridge: 'Разводной мост',
  towerCrane: 'Башенный кран',
  duskLamp: 'Уличный фонарь. Он сам загорается, когда стемнеет!',
  neon: 'Неоновая вывеска',
  ladder: 'Пожарная лестница',
  gearMotor: 'Мотор с шестерёнкой. Поставь рядом шестерёнки, чтобы зубчики сцепились!',
  gear: 'Шестерёнка',
  bigGear: 'Большая шестерёнка',
  press: 'Пресс. Его крутят шестерёнки!',
  tank: 'Бак с краской',
  pipe: 'Труба. Нажми, и она повернётся!',
  paintBooth: 'Покрасочная камера',
  robotArm: 'Робот-рука',
  wireBox: 'Щиток-головоломка',
  reverser: 'Переключатель вперёд-назад',
  railCart: 'Тележка на рельсах',
  safetyPress: 'Пресс на две руки',
  smallGear: 'Маленькая шестерёнка',
  shaftMotor: 'Мотор с валом',
  lathe: 'Токарный станок',
  socketBoard: 'Щит с розетками',
  pipeBox: 'Трубы-головоломка',
  bigWireBox: 'Большой щиток',
  grinder: 'Точильный станок',
  gantry: 'Кран-балка',
  packer: 'Упаковщик',
  cityIntro: 'Добро пожаловать в город! Жителям нужна твоя помощь. Нажми на того, кто зовёт, и он расскажет, что случилось.',
  factoryMove: 'Завод большой! Двигай его пальчиком, чтобы найти, кто ещё ждёт помощи.',
  leverWire: 'Протяни провод от рычага к машине — кружочек к кружочку.',
  cartGo: 'Нажми зелёную стрелку на рычаге — тележка поедет к ленте!',
  cartBack: 'Теперь оранжевую стрелку — тележка вернётся на склад за новыми заготовками.',
  hoistUp: 'Нажми зелёную стрелку — подъёмник поднимет коробку в грузовик!',
  hoistDown: 'Оранжевая стрелка — подъёмник поедет вниз за следующей коробкой.',
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
  kittenDark: 'Стемнело, и я не вижу дорогу домой! Поставь три уличных фонаря вдоль дорожки — они сами загорятся в темноте!',
  kittenHome: 'Теперь видно дорожку! Спасибо!',
  clubAsk: 'В клубе вечеринка! Поставь неоновую вывеску, а рядом фотодатчик и музыкальную шкатулку. Вывеска засветится, датчик увидит свет, и заиграет музыка!',
  clubHappy: 'Ура! Дискотека! Все танцуют!',
  fireAsk: 'Тревога! Дом горит, а на крыше котик! Включи пожарную машину, поставь у дома пожарную лестницу и насос у гидранта!',
  fireHappy: 'Пожар потушен, котик спасён! Ты настоящий пожарный!',
  raccoonComes: 'Ночью к магазину игрушек крадётся енот, он хочет порыться в мусорных баках!',
  raccoonTip: 'Поставь на дорожке домино и подключи к нему звонок. Енот заденет костяшки, они упадут, звонок зазвенит — и енот убежит!',
  raccoonScared: 'Ура! Енот испугался звонка и убежал!',
  schoolAsk: 'Доброе утро! Школьный звонок включает лазерный луч. Поставь лазер, зеркало и фотодатчик, подключи к датчику звонок и направь луч через зеркало на датчик!',
  schoolHappy: 'Дзынь-дзынь! Дети побежали на урок!',
  cityEvening: 'Наступает вечер. В городе зажигаются огни.',
  // Noises for poking things (characters, the herd, the toys).
  moo: 'Му-у-у!',
  oink: 'Хрю-хрю!',
  baa: 'Бе-е-е!',
  cluck: 'Ко-ко-ко!',
  munch: 'Хрум-хрум!',
  woof: 'Гав-гав!',
  quack: 'Кря-кря!',
  meow: 'Мяу!',
  maa: 'Ме-е-е!',
  buzz: 'Ж-ж-ж!',
  neigh: 'И-го-го!',
  yap: 'Тяв-тяв!',
  peep: 'Пи-пи-пи!',
  honk: 'Га-га-га!',
  crow: 'Кукареку!',
  beep: 'Би-бип!',
  squeak: 'Ой, я тут живу!',
  mapAllDone: 'Ты помог всем! Нажми на картинку — поедем дальше. Или сыграем ещё раз?',
  notNeeded: 'Сейчас эта деталь никому не нужна — кладу её обратно в ящик.',
  fetchHere: 'Вот она! Сейчас принесу её сюда.',
  onTable: 'Она уже на столе — вот здесь!',
  crowSneak: 'Ой, ворона крадётся к проводу! Нажми на неё!',
  crowScared: 'Ой-ой-ой, улетаю!',
  crowZapped: 'Ай, щиплется! Больше не буду!',
  ribbit: 'Ква-ква! Плюх!',
  crowCaw: 'Ой, шляпа улетела!',
  mailHere: 'Тебе письмо!',
  splash: 'Бульк!',
  parkAsk: 'Би-би! Мы хотим на парковку, а шлагбаум закрыт! Поставь шлагбаум и кнопку, соедини их со столбом и держи кнопку, пока мы заезжаем!',
  parkHappy: 'Ура, все машины на парковке! Спасибо!',
  ferrisAsk: 'Мы хотим покататься на колесе обозрения! Поставь колесо и ветряк — столба в парке нет, ветер даст ток!',
  ferrisHappy: 'Ух ты, как высоко! Весь город видно! Спасибо!',
  washAsk: 'Ой, я весь в грязи! Поставь автомойку и насос и подключи их к столбу!',
  washHappy: 'Я чистенький и блестящий! Спасибо!',
  craneAsk: 'На стройке нужен кран! Поставь башенный кран и рубильник, соедини их со столбом и включи рубильник — построим дом!',
  craneHappy: 'Дом построен! Три этажа! Спасибо, помощник!',
  bridgeAsk: 'Ту-ту! Кораблику не проплыть под дорогой! Поставь разводной мост и кнопку, соедини со столбом и держи кнопку — мост поднимется!',
  bridgeHappy: 'Ура! Кораблик приплыл в гавань!',
  tramDing: 'Дзынь-дзынь!',
  yum: 'Ням-ням, свежий хлеб!',
  coo: 'Гуль-гуль!',
  grannyOh: 'Ох, внучок, привет!',
  giggle: 'Хи-хи-хи! Щекотно!',
  siren: 'Уи-уи-уи!',
  shopHello: 'Здравствуй! Заходи за игрушками!',
  hammer: 'Тук-тук-тук!',
  toot: 'Ту-ту-у!',
  factoryIntro: 'Это настоящий завод! Он стоит, и в цеху темно. Нажми на мастера у щита — начнём со света!',
  boxAsk: 'В цеху темно! Поверни плитки в щитке, чтобы медная дорожка соединилась, — и лампы загорятся.',
  boxHappy: 'Ток пошёл — свет горит! Завод просыпается!',
  cartAsk: 'На ленте пусто, станкам нечего делать! Тележка привезёт заготовки со склада. Поставь рычаг у рельсов и подключи его к тележке.',
  cartHappy: 'Заготовки приехали на ленту!',
  latheAsk: 'Заготовка ждёт у токарного станка. Станок крутится медленно: поставь большую шестерёнку на станок, а маленькую — на мотор.',
  latheHappy: 'Как раз! Станок точит детали!',
  press2Ask: 'Заготовка под прессом. Нажми и держи обе зелёные кнопки сразу — двумя пальчиками!',
  press2Happy: 'Бух! Пресс штампует детали!',
  plugAsk: 'Роботу нужен ток. У него треугольная вилка: протяни провода от робота к треугольным розеткам на щите.',
  plugHappy: 'Робот работает! Вжик-вжик!',
  hoistAsk: 'Коробка с игрушкой доехала до подъёмника! Поставь рычаг, подключи его к подъёмнику и подними коробку в грузовик.',
  hoistHappy: 'Коробка в грузовике! Дальше водитель сам: ещё две — и грузовик поедет.',
  gearBack: 'Эта шестерёнка не подходит сюда. Нажми на неё — она вернётся в ящик, и попробуй другую!',
  eveningShift: 'Начинается вечерняя смена! На складе темно — помоги кладовщику включить свет.',
  storeAsk: 'На складе темно! Поверни плитки в большом щитке, чтобы ток дошёл до ламп склада.',
  storeHappy: 'Свет на складе! Вечерняя смена может работать!',
  gantryAsk: 'Нужен стальной рулон с полки. Поставь два рычага у крана: один везёт тележку, другой поднимает крюк. Подключи их к крану.',
  gantryHappy: 'Рулон на ленте! Здорово управляешь краном!',
  craneUp: 'Подними крюк — нажми стрелку вперёд на рычаге крюка!',
  craneDown: 'Опусти крюк — стрелка назад на рычаге крюка!',
  craneToCoil: 'Вези тележку к рулону — стрелка назад на рычаге тележки!',
  craneToLine: 'Теперь вези рулон к ленте — стрелка вперёд на рычаге тележки!',
  paintAsk2: 'Игрушки серые — краска не доходит до камеры. Поверни трубы, чтобы краска дотекла!',
  paintHappy2: 'Краска пошла! Игрушки разноцветные!',
  turnPipe: 'Поверни трубу — пусть краска потечёт дальше!',
  grinderAsk: 'Точильный камень крутится быстро: поставь большую шестерёнку на мотор, а маленькую — на камень.',
  grinderHappy: 'Вжжж! Камень точит детали!',
  grinderSlow: 'Слишком медленно! Поменяй шестерёнки: большую на мотор, маленькую на станок.',
  welderAsk: 'У сварочного робота квадратная вилка. Протяни провода от робота к квадратным розеткам на щите.',
  welderHappy: 'Робот варит! Искры летят!',
  lorry2Ask: 'Второй грузовик ждёт коробки вечерней смены!',
  lorry2Happy: 'Второй грузовик полный! Поехали!',
  pipeTurn: 'Эта труба смотрит не туда. Нажми на неё, и она повернётся!',
  breakerAsk: 'В цеху темно! Поставь рубильник, соедини столб, рубильник и щит в одну цепочку и включи рубильник!',
  breakerHappy: 'Свет горит! Фабрика просыпается!',
  pressAsk: 'Пресс крутят шестерёнки! Поставь мотор, маленькую и большую шестерёнку — пусть зубчики сцепятся. Подключи мотор к столбу!',
  pressHappy: 'Бух! Бух! Пресс штампует игрушки!',
  paintAsk: 'Игрушки надо покрасить! Поставь бак с краской и три трубы до покрасочной камеры, подключи бак и камеру к столбу!',
  paintHappy: 'Ура, краска пошла! Игрушки разноцветные!',
  robotAsk: 'Робот должен видеть игрушки! Поставь лампу над лентой, фотодатчик и робота. Свет лампы включит датчик, а датчик — робота!',
  robotHappy: 'Робот работает! Вжик-вжик!',
  packAsk: 'Пора упаковывать! Поставь упаковщик и рубильник, соедини их со столбом и включи рубильник!',
  packHappy: 'Коробки с бантиками! Красота!',
  loadAsk: 'Би-бип! Грузовик ждёт коробки! Поставь ленту и рубильник и включи — коробки поедут в кузов!',
  loadHappy: 'Грузовик полный! Повёз игрушки детям! Би-би!',
  factoryDone: 'Фабрика работает! Ты построил настоящий завод!',
  machinesIntro: 'Это машины! Выбери любую: все детали уже стоят, тебе нужно только соединить провода, чтобы машина заработала!',
  machineWorks: 'Машина работает! Ты её собрал! Она теперь в твоих изобретениях.',
  mNightlight: 'Лампа светит на фотодатчик, а датчик включает колесо обозрения. Соедини провода!',
  mShooting: 'Пушка стреляет в мишень, а мишень включает звонок. Соедини провода!',
  mParty: 'Пушка лопнет шарик, а шарик включит гирлянду. Соедини провода — будет праздник!',
  mWindsign: 'Вентилятор дует на ветряк, а ветряк зажигает вывеску. Соедини провода!',
  mPress: 'Мотор крутит шестерёнки, а шестерёнки — пресс. Подключи мотор к батарейке!',
  mPaint: 'Насос гонит краску по трубам в покрасочную камеру. Подключи бак и камеру к батарейке!',
  mAlarm: 'Шарик уронит домино, а домино включит пищалку. Соедини провода!',
  mLaser: 'Лазер светит в зеркало, зеркало — на датчик, а датчик включит сирену. Соедини провода и поверни зеркало!',
  mCarwash: 'Автомойка: щётки и насос. Подключи их к батарейке!',
  mBridge: 'Разводной мост поднимается, пока держишь кнопку. Соедини провода!',
  mDisco: 'Диско-шар светит на фотодатчик, а датчик включает музыку. Соедини провода!',
  mHelicopter: 'Большой батарее хватит сил поднять вертолёт! Соедини провода и включи рубильник!',
  mBand: 'Целый оркестр! Подключи к батарее шкатулку, тубу, маракасы и колокольчики — они сыграют вместе!',
  mFactory: 'Большой завод! Ветер крутит ветряк, ветряк — мотор, мотор — шестерёнки и пресс, а насос гонит краску. Соедини всё!',
  binCat: 'Я тут обедаю!',
  hydrantSpray: 'Пш-ш-ш! Брызги!',
  clockRing: 'Дзынь-дзынь! Пора работать!',
  sodaCan: 'Бульк! Газировка!',
  passerby: 'Привет! Хорошая погода!',
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
/** How much decoded voice to keep (a phrase is ~0.2–1 MB of sound, all ~400 of them ~90 MB; one decodes in a few ms). */
const CLIP_BUDGET = 32 * 1024 * 1024;

/** Phrases any table may need at once, decoded first: problems, the next wire, praise. */
const COMMON: PhraseId[] = ['short', 'reversed', 'bypass', 'wrongWire', 'switchBeside', 'connect', 'toPlus', 'toMinus', 'toPair', 'holdButton', 'tapSwitch', 'weak', 'drag', 'placeHere', 'needPower', 'needBattery', 'newSticker', 'winChain'];

export class Voice {
  enabled = true;
  private voice: SpeechSynthesisVoice | null = null;
  private last: { id: PhraseId; at: number } | null = null;
  private saidAt = -1e9;
  private ctx: AudioContext | null = null;
  private out: AudioNode | null = null;
  /** The MP3 of each take: a phrase's first take is its id, more takes of it are `<id>--v02`… (variants.json says how many). */
  private raw = new Map<string, Promise<ArrayBuffer | null>>();
  /** Takes beyond the first, per phrase (praise said a few different ways). */
  private takes = new Map<PhraseId, string[]>();
  /** The take of each phrase said last (the next time, another one). */
  private lastTake = new Map<string, string>();
  /** A take picked while it was still being decoded: said as soon as it is ready. */
  private chosen = new Map<PhraseId, string>();
  /** Decoded clips, least recently said first; their sound takes far more memory than the MP3s, so only some stay. */
  private clips = new Map<string, AudioBuffer>();
  private clipBytes = 0;
  /** Clips waiting to be decoded ahead of need, one at a time. */
  private ahead: string[] = [];
  private playing: AudioBufferSourceNode | null = null;
  private endsAt = 0;

  constructor() {
    // Fetch every clip up front (a few MB of MP3) so they also work offline later.
    for (const id of Object.keys(PHRASES) as PhraseId[]) this.raw.set(id, fetchClip(id));
    void fetchTakes().then((more) => {
      for (const [id, n] of Object.entries(more)) {
        if (!(id in PHRASES) || n < 2) continue;
        const keys = Array.from({ length: n - 1 }, (_, i) => `${id}--v${String(i + 2).padStart(2, '0')}`);
        for (const k of keys) this.raw.set(k, fetchClip(k));
        this.takes.set(id as PhraseId, keys);
      }
    });
    void fetchSounds().then((sounds) => {
      for (const [id, s] of Object.entries(sounds)) {
        if (!s.takes?.length) continue;
        for (const t of s.takes) this.raw.set(`sfx:${t}`, fetchSound(t));
        this.sounds.set(id, { takes: s.takes.map((t) => `sfx:${t}`), intro: (s.intro ?? []).map((t) => `sfx:${t}`), cue: !!s.cue });
      }
    });
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
    if (first) this.prepare(COMMON);
  }

  /**
   * Decode these clips ahead of need (the open map's or task's phrases), one at
   * a time in the background: decoding many at once on a touch made an iPad stutter.
   */
  prepare(ids: PhraseId[]) {
    const keys = ids.flatMap((id) => [...(this.sounds.get(id)?.takes ?? []), id]);
    this.ahead = [...new Set([...keys.filter((id) => this.raw.has(id)), ...this.ahead])];
    this.batch = 0;
    if (this.pumping || !this.ctx) return;
    this.pumping = true;
    const next = () => {
      const id = this.ahead.shift();
      // Ahead of need only up to three quarters of the budget at a time: more would push out what was just made ready.
      if (!id || this.batch > CLIP_BUDGET * 0.75) return void ((this.pumping = false), (this.ahead.length = 0));
      void this.decode(id).then((c) => {
        if (c) this.batch += c.length * c.numberOfChannels * 4;
        setTimeout(next, 15);
      });
    };
    next();
  }

  private pumping = false;
  /** Bytes made ready by the latest `prepare`. */
  private batch = 0;

  private decoding = new Map<string, Promise<AudioBuffer | null>>();

  /** Decode a take (or find it decoded); also used to jump the queue for a phrase that is wanted now. */
  private decode(id: string): Promise<AudioBuffer | null> {
    const ctx = this.ctx;
    if (!ctx) return Promise.resolve(null);
    const have = this.clips.get(id);
    if (have) return Promise.resolve(have);
    let p = this.decoding.get(id);
    if (!p) {
      p = (this.raw.get(id) ?? Promise.resolve(null)).then(async (buf) => {
        if (!buf) return null;
        try {
          // A copy: decoding takes the bytes over, and the MP3 stays for the next time.
          const clip = await ctx.decodeAudioData(buf.slice(0));
          this.keep(id, clip);
          return clip;
        } catch {
          return null; // Undecodable clip: synthesis covers it.
        } finally {
          this.decoding.delete(id);
        }
      });
      this.decoding.set(id, p);
    }
    return p;
  }

  /** Keep a decoded clip, letting the least recently said ones go beyond the budget. */
  private keep(id: string, clip: AudioBuffer) {
    const bytes = (c: AudioBuffer) => c.length * c.numberOfChannels * 4;
    const old = this.clips.get(id);
    if (old) this.clipBytes -= bytes(old);
    this.clips.delete(id);
    this.clips.set(id, clip);
    this.clipBytes += bytes(clip);
    for (const [other, c] of this.clips) {
      if (this.clipBytes <= CLIP_BUDGET) break;
      if (other === id || c === this.playing?.buffer) continue;
      this.clips.delete(other);
      this.clipBytes -= bytes(c);
    }
  }

  /** Say a phrase; the same phrase is not repeated within `cooldown` ms. */
  say(id: PhraseId, cooldown = 6000) {
    if (!this.enabled) return;
    const sound = this.sounds.get(id);
    // An animal's own sound (a recorded moo), not words.
    if (sound && !sound.cue) return void this.cry(id);
    const now = performance.now();
    if (this.last && this.last.id === id && now - this.last.at < cooldown) return;
    // A line that goes with a sound (the mouse squeaks, the crow caws) is said at once — words first, never held
    // up — and the sound follows when the recorded line ends (see words).
    this.words(id);
  }

  /** Say the words of a phrase now (its recorded clip, or else the synthesiser). */
  private words(id: PhraseId) {
    const now = performance.now();
    this.last = { id, at: now };
    this.saidAt = now;
    this.stop();
    const take = this.pickTake(id);
    const clip = this.clips.get(take);
    // Said now: the most recently used, the last to be let go.
    if (clip) this.keep(take, clip);
    // Not decoded yet: decode it now and speak a moment later (better than the robot voice).
    if (!clip && this.ctx && this.raw.has(take)) {
      const asked = this.last;
      void this.decode(take).then((c) => {
        // Something else was said meanwhile, or the sound was turned off.
        if (this.last !== asked || !this.enabled) return;
        if (c) {
          this.last = null;
          // The take that was chosen, now decoded: that one, not a new pick.
          this.chosen.set(id, take);
          this.words(id);
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
      // Its sound right after it, unless other words cut it short (stop() also ends a clip: then it is no longer `playing`).
      if (this.sounds.get(id)?.cue) src.onended = () => this.playing === src && this.enabled && void this.cry(id);
      return;
    }
    this.speak(id);
  }

  /**
   * Say `first` (an animal's own sound), then `then` right after it — only if
   * that sound has a short whole take (≤ 0.8 s), and not more than once in 10 s:
   * the words are what matters, a long moo would only hold them up.
   */
  sayThen(first: PhraseId, then: PhraseId) {
    if (!this.enabled) return;
    const intro = this.sounds.get(first)?.intro ?? [];
    const now = performance.now();
    if (!intro.length || now - this.introAt < 10000) return this.say(then, 0);
    this.introAt = now;
    const take = intro[Math.floor(Math.random() * intro.length)];
    // Anything said or stopped meanwhile (a newer hint, another map) takes the place of these words.
    const turn = this.turn;
    void this.decode(take).then((clip) => {
      if (this.turn !== turn) return;
      if (!clip || !this.enabled) return this.say(then, 0);
      this.play(take, clip);
      this.saidAt = performance.now() + clip.duration * 1000;
      setTimeout(() => this.turn === turn && this.enabled && this.say(then, 0), clip.duration * 1000 + 100);
    });
  }

  /** Recorded animal sounds (public/sfx, sfx.json): the takes of each sound and those short enough to come before words. */
  private sounds = new Map<string, { takes: string[]; intro: string[]; cue: boolean }>();
  private introAt = -1e9;
  private cryAt = -1e9;
  private crying: AudioBufferSourceNode | null = null;

  /**
   * An animal's sound on a tap: one at a time, not more often than every 1.5 s,
   * never the same take twice running; over any words being said (it is quiet
   * and short, and a tap that made no sound would feel broken).
   */
  private async cry(id: string): Promise<number | null> {
    const now = performance.now();
    if (now - this.cryAt < 1500) return null;
    this.cryAt = now;
    const takes = this.sounds.get(id)!.takes;
    const fresh = takes.filter((t) => t !== this.lastTake.get(id));
    const take = fresh[Math.floor(Math.random() * fresh.length)] ?? takes[0];
    this.lastTake.set(id, take);
    const clip = await this.decode(take);
    // Too late to belong to the tap any more.
    if (!clip || !this.enabled || performance.now() - now > 500) return null;
    this.play(take, clip);
    return clip.duration;
  }

  /** A sound of its own for something on the map, not tied to a phrase (the fox yelps as it runs off); none until recorded. */
  cue(name: string) {
    if (this.enabled && this.sounds.has(name)) void this.cry(name);
  }

  private play(take: string, clip: AudioBuffer) {
    if (!this.ctx || !this.out) return;
    this.keep(take, clip);
    try {
      this.crying?.stop();
    } catch {
      // Already finished.
    }
    const src = this.ctx.createBufferSource();
    src.buffer = clip;
    src.connect(this.out);
    src.start();
    this.crying = src;
  }

  /** Which take to say: the one decoded and ready, or else another than last time (praise varies). */
  private pickTake(id: PhraseId): string {
    const chosen = this.chosen.get(id);
    if (chosen) {
      this.chosen.delete(id);
      return chosen;
    }
    const all = [id, ...(this.takes.get(id) ?? [])];
    if (all.length === 1) return id;
    const fresh = all.filter((t) => t !== this.lastTake.get(id));
    const ready = fresh.filter((t) => this.clips.has(t));
    // Mostly one already decoded (no wait); now and then another, so every take gets its turn.
    const pool = ready.length && Math.random() < 0.7 ? ready : fresh;
    const take = pool[Math.floor(Math.random() * pool.length)];
    this.lastTake.set(id, take);
    return take;
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

  /** Still talking (a clip playing or the synthesiser speaking, or about to)? */
  get busy() {
    // Just asked: the clip may still be decoding, or the synthesiser not started yet.
    if (performance.now() - this.saidAt < 600) return true;
    if (this.playing) return performance.now() < this.endsAt;
    return 'speechSynthesis' in window && speechSynthesis.speaking;
  }

  /** Counts the times talk was stopped (every new phrase stops the last): words waiting for their turn check it. */
  private turn = 0;

  stop() {
    this.turn++;
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

/** How many takes each phrase has (public/voice/variants.json; none on an older build). */
async function fetchTakes(): Promise<Record<string, number>> {
  try {
    if (import.meta.env.VITE_MODELS_AS_JS) return {};
    const r = await fetch(`${import.meta.env.BASE_URL}voice/variants.json`);
    return r.ok ? ((await r.json()) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** The recorded animal sounds (public/sfx/sfx.json; none on an older build or the preview host). */
async function fetchSounds(): Promise<Record<string, { takes: string[]; intro?: string[]; cue?: boolean }>> {
  try {
    if (import.meta.env.VITE_MODELS_AS_JS) return {};
    const r = await fetch(`${import.meta.env.BASE_URL}sfx/sfx.json`);
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

async function fetchSound(id: string): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}sfx/${id}.mp3`);
    return r.ok ? await r.arrayBuffer() : null;
  } catch {
    return null;
  }
}

async function fetchClip(id: string): Promise<ArrayBuffer | null> {
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
