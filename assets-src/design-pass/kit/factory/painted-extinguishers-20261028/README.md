# Рисованные огнетушители — 28.10.2026

Три ракурса текущего factory-fire-extinguisher, fit height1.1, для неизменных PROPS. 3 built-in image_gen, первая попытка каждого принята, 0 Tripo/API. Исходники/точные промпты/геометрические референсы рядом. Только полный resize LANCZOS768×576 и WebP quality90/alpha100/method6, без crop/paint/mask. Всего60522Б; SHA в review.json. build.py по умолчанию проверяет побайтовую воспроизводимость; --write пересоздаёт только эти производные.

## Контракт интеграции

КРИТИЧНО: у северного огнетушителя x<0, но это NORTH, а не WEST. Выбирать north при yaw===0 (или явно z−33.62), затем west/east для ±PI/2. Одно общее правило половины зала без исключения перепутает северный вид. Не менять нынешние x/z/yaw/fit.

| Вид | x,z | yaw | visible S | span | front | deep | full canvas W |
|---|---|---|---|---|---|---|---|
|north|[-8.64, -33.62]|0|0.6695518602121999|324|0.1999954222235786|0.5974008410945029|1.587085890873363|
|west|[-52.52, 0.27]|1.5707963267948966|0.40921718883314867|164|0.3304834131900999|1.6151981011963252|1.916334152584501|
|east|[52.52, 12.15]|-1.5707963267948966|0.4142076423555041|166|0.3304834131900999|1.5957378831096225|1.916334152584501|

У всех image768×576, at[384,528], geometry.translate(0,−.0625,0) ОДИН раз. FullW=S*768/span. Опора — виртуальная точка (x0,y0,zBox.maxZ), спроецированная guide(512,704)→(384,528), намеренно ниже нарисованного основания на боковых видах. Не обрезать canvas и не переносить опору к нижнему opaque pixel. Размер следует ортографическому guide; visible width +1.3/+2.3/+3.6% к точным vertex bounds north/west/east. Это не точная реконструкция перспективного старого силуэта.

Собрать исходный mesh ДО добавления art. Только если картинка правильного вида готова: исходному material.colorWrite=false/depthWrite=false, castShadow=false; visible/geometry/raycast оставить. В ТОТ ЖЕ root добавить painted([{x:0,z:front,size:S}],texture,definition,blob); art.rotation.y=−yaw, все новые card/shadow raycast=()=>{}. Стандартные cards: Standard/sRGB/alphaTest.45/DoubleSide/noAO. Сохранить Life.addProp и его jump/wobble/chime, отдельной анимации рукояти или шланга нет. Не статический batch.

Одна тень на holder по принятой формуле: x=S*.45,z=front−depth*.5=0,size=S*1.35,y.009/order3, farm/blob-shadow. Старую GLB shadow выключить, не складывать две. Мягкая декоративная тень, не физическое совпадение с directed light. При отсутствии нужного вида — полностью старый GLB с прежними flags; другой ракурс не подставлять.

## Проверка

fixture.html импортирует настоящие FactoryMap/World/Stage/Life и public loadModels/loadKit/loadGround. 24 состояния/24 native JPEG: 1024×768 старый/новый/крупно каждого;390×844 старый/новый/tap/rest каждого;freshfallback каждого. q2/DPR1, все модели загрузились, console0/overflowfalse. 121ray×24 состояния сравнения original mesh/whole holder:0mismatch, первые21 состояние сохраняют UUID3original. Сетка редкая на игровом масштабе; это точечная проверка, не исчерпывающий pick-аудит.

3 настоящих pointerclick390: north195,516;west/east195,517 → original GLB/Life.tap accepted, chime hook. Реальный Life.update(.175): rootY.12/Zrotation−.03854858822278267; +1.7→restY/Z0. Погрешность наследования anchor ≤6.408e−9. Freshfallback=1 не передаёт новую текстуру в fixture, не имитирует отказ сети.

npm test88/88 в17 файлах + typecheck PASS22:17:21 Bangkok. 7 runtime/src и GLB73140Б/3862tri/1mesh/1material byteequal89dc70a. Нет общего Input/story11/wires/iPad/PWA/FPS/VRAM/слуховой приёмки/непрерывного видео/globalocclusion. Следующий шаг Claude — runtime1024/390/generalInput/tap-rest/соседи. Исходники игры и GLB не правились, commit только локальный.

## Предыдущее ревью

trolleys-runtime-review/ содержит два оригинала Claude и мой статичный review89dc70a/m0610: замечаний нет; Input11/публикация — отчёт Claude, не моя независимая проверка.
