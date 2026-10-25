# Исходники графики деталей

Модели деталей сгенерированы в Higgsfield: сначала картинка (`concepts/*.png`, модель
`gpt_image_2_5`), затем по ней 3D (`tripo_h3_1_image_to_3d`, texture_quality=detailed, pbr,
face_limit=30000). Сырые `.glb` (5–10 МБ) в git не хранятся: положите их в `assets-src/models/`
и запустите `scripts/optimize-models.sh` — сжатые версии попадут в `public/models/`.

Общий хвост промпта картинок, чтобы новые детали были в том же стиле:

> isolated object, three-quarter top view, centered, plain pure white background, soft studio
> lighting, high quality stylized 3D product render, slightly toy-like but realistic proportions,
> clean, no text, no wires, no shadow on background

| файл | что | image job | 3D job |
|---|---|---|---|
| motor | моторчик на бирюзовой стойке, без пропеллера | 78fb7994-c39a-4179-8258-0bfdd5c92456 | fd02ed35-0d10-4ce6-b629-cece46183597 |
| propeller | трёхлопастной пропеллер | a2a63c0c-a57a-4206-8ec4-bc958350bf88 | 28a72867-ab18-4432-8410-73d19be23816 |
| knife | основание рубильника без ножа | 3b43d43c-19e9-4fd0-aad3-353a13d50647 | 88233539-47b1-4677-8ed4-6f1ae84a2ed7 |
| windmill | башня мельницы без крыльев (смотрит в +x, в коде `rotateY: -π/2`) | d8f5a2dd-526f-4765-8b18-4d5c3863e411 | 6f5bd53e-c88b-4dff-afc6-2a04266b4cb9 |
| sails | крылья мельницы (плоскость YZ, `rotateY: -π/2`) | 988003df-fe9d-482f-baed-7c4c4e687ff0 | aa184479-160d-4ff4-832f-576b079ab0c4 |
| panel | пульт с тремя кнопками (вдоль z, `rotateY: -π/2`) | 219fefd8-45f6-4c14-ac68-5a91eaa2b382 | c8d656d7-a0d2-4e92-98fb-1ae19c5e46ab |
| racecar | красная гоночная машинка (для трассы) | 2bfaf157-1053-4f07-bd42-105bc2583ba4 | ce773a91-a992-4872-96e0-0ed8a95d51a6 |
| dynamo | корпус динамо-машины с циферблатом (циферблат в +x, `rotateY: -π/2`; ручка строится кодом) | 6e8a8f88-8b50-4ed3-b5fc-b27790f1fa51 | 5702c830-b24b-44ab-af00-54aaf9ab3381 |
| floorfan | подставка напольного вентилятора с мотором, без лопастей (ручка мотора в +x, `rotateY: -π/2`; лопасти и решётка — кодом) | 3130e2d7-25b8-4fbf-94de-6208f39ad438 | fbe260f5-8266-4ccf-8b1a-51f4b55bfc83 |
| windgen | башня ветряка без лопастей (вал в +x, в коде `rotateY: -π/2`, лопасти — кодом на кончике вала) | aa9f584a-70f2-40e9-84cd-f8dabd5f1973 | 93669d50-a93e-43dc-9dff-b68bdba71d8d |
| cow, pig, hen | животные фермы (смотрят в +x; задачи — в истории Higgsfield за 24.10.2026) | — | — |
| duck | утёнок (смотрит в −z, в коде `rotateY: -π/2`) | 9fe67673-f5ed-43a2-a603-6469de6df7d9 | a2f6ec34-7d35-4f7f-8168-86f60db15b43 |
| sheep | овечка (смотрит в −z, `rotateY: -π/2`) | 23291fa8-675f-4405-b87e-61851e125338 | 244d7881-5d21-4489-8cc3-c723a6e18f6e |
| barn | красный амбар (двери в +x, на карте `rotateY: -π/2`) | — | 20d4f4b1-8701-40e5-ba66-574704f8a12a |
| coop | курятник с лесенкой (дверца в +x, `rotateY: -π/2`) | — | 781be023-b76a-4184-a1b7-05d87066e757 |
| tractor | зелёный трактор (нос в +z, на карте `rotateY: π`) | — | 86008a18-4f91-4e9f-9ce2-9bf7413a7503 |

## Второй набор: детали на кремовой плате

Второй набор моделей сделан в том же аккаунте Higgsfield (24.10.2026, `tripo_h3_1_image_to_3d`,
texture_quality=standard, face_limit=30000) — каждая деталь сразу стоит на кремовой плате с нарисованными
клеммами, все в одной палитре (бирюза, коралл, тёмно-синий, крем, латунь). Плату с клеммами
`scripts/strip-plate.mjs` срезает (верх платы находит сам — самая большая плоская площадка; островки
вроде клемм отбрасывает), и корпус встаёт на нашу плату с настоящими клеммами. Сырые модели кладите в
`assets-src/raw/<первые 8 знаков задачи>.glb`, затем `bash scripts/gpt-models.sh` (параметры срезки
каждой модели — там) и `scripts/optimize-models.sh`. Посмотреть несколько моделей рядом:
`/tools/contact.html?n=battery,bell&v=top` (виды top, front, side, game).

| файл | что | 3D job | в коде |
|---|---|---|---|
| battery | бирюзовая батарейка с молнией | 19f75ed3-17b1-42d0-aa44-2ab648127919 | `rotateY: π/2`; большая 6 В — она же крупнее, бирюза перекрашена в коралл (`hueShift(…, 'teal')`) |
| socket | патрон лампы (стекло срезано `--top 0.45`, колба — кодом) | 1b1cf572-7f87-4d34-8c4c-4727e5814d90 | |
| led | красный купол на кремовой подставке | da10ad6f-9fef-47e8-9a3b-edbc347f2fdc | цвет — `hueShift(…, 'vivid')`, светится только купол |
| buzzer | бирюзовый зуммер с решёткой | 3a67a048-59ea-4df8-b42f-e9ff0232a617 | |
| button | красная кнопка на синем корпусе | 1eba68cd-ddb1-4c47-a5c6-24474377b5d0 | |
| tuba | туба | 0e236a5c-061c-4eea-bdeb-d93d009f763b | |
| firetruck | пожарная машина | 690ec433-fa83-4c48-85f0-707e3b0f3cde | |
| drum | барабан (палочки срезаны вместе с платой) | defb7ac9-5063-40f4-b5e6-a4fcd21e6f23 | |
| carousel | карусель | 1998854f-0dcd-4313-96ea-77f890d9b57a | `--cut 0.16` |
| mirror | зеркало (стекло смотрит в +x, повёрнуто на 30°) | fcabed71-4f16-435c-abf4-ea73697004b0 | `rotateY: -π/3` |
| heater | красный радиатор | 7f08ce9e-08f0-47ab-bde8-e6cecbc88c60 | |
| musicbox | открытая шкатулка (балерина вырезана `--box`, её строит код) | 12d1f6b1-7773-4343-a9b5-976c1464dfc1 | `rotateY: -π/2`, балерина — на круглой сцене |
| helicopter | вертолёт (винт срезан `--top 0.85`) | 6f0237a8-a740-4c5c-892f-c6c8161dad7b | |
| tester | тестер с круглым циферблатом (в +x) | 1ed9b3c5-51d9-4d66-a292-9908d8d63e41 | наш циферблат и стрелка — поверх |
| magnet | электромагнит-подкова | 35621c45-031e-4d88-a77e-85f770446db8 | `rotateY: -π/2` |
| bell | звонок | d24e644a-3c2c-44ce-946d-0626dfe9b07f | `--cut 0.2` |
| cannon | пушка (ствол в +x) | 177531bd-94e4-4255-a3e1-f30e26b705dc | дуло — `tip(…, 'x', 1)` |
| target | мишень (смотрит в +x) | d0f78dd9-1bef-47bb-b877-6e44ea9b7ddb | падает вся |
| trafficlight | светофор (линзы в +x) | 66dd7083-9878-4deb-89f8-fb7e160e28fe | горящая линза — колпачок кодом |
| laser | лазер (линза в +x) | 9f300870-ea67-409c-9bf3-61bf1b239cac | луч от линзы на высоте `BEAM_Y` |
| solar | солнечная панель | c488cdbe-f1cc-4245-99d8-36ce71bd7797 | `rotateY: -π/2` |
| pump | насос (носик в +x) | a07ffdd3-ca1d-48e7-ad75-719066268a28 | вода из носика |
| pole | столб (перекладина вдоль z) | 0e52db62-3503-4716-a4af-b69587fcc4c5 | `rotateY: π/2` |
| fox, rabbit, dog | лиса, кролик, собака (смотрят в +x) | c2d71a9a-8a5a-44a0-bae6-fbe3f650dccd, 8f04d2f7-04a5-469c-91a4-c06cc2a72920, 0d5d3d02-f8a5-4e9b-a636-b4a7ee9eff24 | |
| doghouse | будка | 5bc78ef9-ebc5-43e1-9c03-84eb22ab6905 | |
| sack | мешок муки (1,5 млн треугольников → `gltf-transform simplify --ratio 0.02`) | c3922a1c-6876-41a2-a724-2cd40fa29a98 | |

В том же наборе есть модели, где движущееся «запечено» в корпус (лопасти вентиляторов и ветряков, нож
рубильника, ручка динамо, клавиши пианино и ксилофона, кран, лифт, домино, горка, водяная мельница, конвейер,
диско-шар, трасса с машинкой): их нельзя анимировать, поэтому у этих деталей остались прежние модели или код.

Картинки карт для выбора (`public/maps/*.webp`, 480 px) — `gpt_image_2_5`, 4:3, «cute cartoon isometric diorama …
cream background #f6eddd, no text»; исходники `assets-src/concepts/map-*.png`.

Лифт и кран строятся кодом целиком (`src/parts/more.ts`), как и компьютерный вентилятор, вертушка (`src/parts/wind.ts`), пианино, маракасы, колокольчики (`src/parts/band.ts`) и все механизмы (`src/parts/mech.ts`). Ксилофон, диско-шар и трасса (кроме машинки) строятся кодом целиком (`src/parts/extra.ts`, `src/parts/fun.ts`).

## Голос

Фразы из `src/voice.ts` (`PHRASES`) озвучены в Higgsfield: модель `text2speech_v2`, вариант
`elevenlabs`, готовый голос «Elena» (`voice_id ca83ca7f-c186-493d-bd69-0d765fa861b2`), ~0,15 кредита
за фразу. Сырые mp3 кладите в `assets-src/voice/<id>.mp3` (в git не хранятся), затем сожмите:

```sh
for f in assets-src/voice/*.mp3; do ffmpeg -v error -y -i "$f" \
  -af "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse" \
  -ac 1 -b:a 64k "public/voice/$(basename "$f")"; done
```

Новая фраза: добавить в `PHRASES`, озвучить тем же голосом, положить клип. Пока клипа нет,
фразу читает синтезатор браузера.


## Ферма: материалы и анимация (25.10.2026)

Новые материалы земли — `public/textures/farm/*.webp` (512×512), созданные Image Generation.
Промпты, исходники и проверка повторения — `assets-src/farm-v2/README.md` и `prompts.json`.
Лиса `public/models/fox-rig.glb` сохраняет существующий корпус, но добавляет скелет и
`preset:quadruped:walk` (2,6 с); Tripo rig `f90a66c1-ed63-4971-89e1-6ffb1f5530b7`,
retarget `f1d80f7d-2111-41bd-8161-44568b4e93be`, всего 35 кредитов. При сжатии скелетных
ассетов не уплощать и не объединять иерархию; использовать SkeletonUtils.clone.
Декор фермы — лёгкий полноценный 3D с динамическим светом. Изображение дерева v1
оставлено только как исследование; финальный референс должен иметь крупные мягкие
формы без отдельных мелких листьев и пройти визуальное согласование перед Tripo.

## Mobile asset budget (2026-10-25)

`scripts/optimize-models.sh` now uses `scripts/optimize-mobile-models.mjs`: color maps 512px, normal/ORM 256px, target 8k triangles for farm animals/buildings and 6k for simple parts. Rigged models and parts whose vertices define pivots, plus reflective surfaces damaged by simplification, keep exact geometry. Sources must be separate from output. See `farm-v2/mobile-models-report.md` and `.json` for the complete measured inventory, exceptions and reproduction command.

## Ферма: новые животные и декор (25.10.2026)

13 новых GLB: семь животных (kitten, goat, kid, goose, rooster, horse, chick),
beehive, nest, stable, flowerbed-buds/bloom и tree-oak. Изображения — built-in Image Generation,
согласованы в coordination m0036/m0038/m0042; Tripo H3.1 image-to-model
(`v3.1-20260211`, texture `v3.5-20260815`, standard, delight=true), 30 API-кредитов за модель,
390 за набор. Итоговый баланс API 575, включая предыдущие 35 за анимацию лисы.
Промпты и исходные изображения: `farm-v2/day2/`; дерево: `farm-v2/tree-oak-v2.png`.
`day2/models.json` хранит task ID, seed, параметры, ориентацию и SHA256; приватные URL не сохраняются.
Оригиналы GLB локально в игнорируемом `assets-src/raw/farm-2026-10-25/`.

Животные, улей и вход конюшни смотрят в +x, верх +y; `model()` центрирует основание.
Для показа фасада конюшни к основной камере оставить `rotateY: -Math.PI/2`.
Клумбы имеют одинаковое основание 2.6×1.6 (длинная сторона x); переключать состояние целиком.
Гнездо пустое, яйца добавляет игра. Щенок использует существующую dog.glb.
Дерево: один меш, одна color-карта, roughness 0.9 — подходит для InstancedMesh.
Цветовой атлас дерева дополнительно скорректирован Image в `tree-oak-color-v3.png`.

Сборка (из корня проекта; выходные папки должны отличаться от исходной):
```sh
node scripts/prepare-farm-models.mjs assets-src/raw/farm-2026-10-25 /tmp/farm-normalized assets-src/farm-v2/day2/models.json tree-oak kitten goat kid goose horse rooster chick beehive nest flowerbed-buds flowerbed-bloom stable
node scripts/optimize-mobile-models.mjs --input /tmp/farm-normalized --output /tmp/farm-ready --report /tmp/farm-report.json
```
Первый проход только для новых статичных моделей: ориентация, согласование оснований,
Meshopt (позиции 16 бит); второй — color512 и normal/ORM256 WebP. Геометрия этого набора
не упрощалась: 86 105 треугольников; все13 GLB вместе 1.42MiB, текстуры каталога ~25.3MiB
RGBA8+mips (не измерение фактической видеопамяти). Полный отчёт — `day2/model-report.json`.
Визуальная проверка: `farm-v2/model-diet-qa.html?models=kitten,goat,kid,goose,rooster,horse,chick`
с параметрами `before` и `after` для директорий сравнения.

## Финальный декор и память фермы (25.10.2026)

Шесть объёмных декораций (ели, кусты, стог, крольчатник, секция забора и завершающий столб)
и два акцента (полевые цветы, замшелые камни): см. `farm-v2/README.md`, `decor/`, `accents/`.
Завершающий столб вырезан из готового забора без новой генерации Tripo.
У камней более холодный цветовой атлас — `farm-v2/accents/rock-color-v2.md`.

Избирательное удаление карт normal/ORM у 25 моделей: `farm-v2/material-memory/README.md`.
Экономия 11 MiB по инвентарю текстур; у 17 фигур сохранены исходные блики,
геометрия, скелеты и анимация не менялись. Для всех 68 GLB оценка RGBA8+mips
130 → 119 MiB (это не фактическая VRAM работающей сцены).

## Город: концепты (25.10.2026)

Листы построек и персонажей — `city-v1/`, стиль одобрен в m0103. Первый пакет: bakery/baker GLB (вместе 210 КиБ, 14 528 треугольников), Image-текстуры asphalt/paving 512 WebP. Две модели стоили 60 API-кредитов, осталось 305; Studio не использовалась. `city-v1/README.md` содержит параметры интеграции, план переиспользования, требования к анимации и согласование лифта. Важное: paving-v2 — одна плита, повтор 0.75 мировой единицы; ребёнок будет child.glb, kid.glb — существующий козлёнок.

Второй городской пакет: tram/car (247 КиБ, 14 146 треугольников), ещё 60 API-кредитов; актуальный остаток 245. Размеры и проверка колеи/интервалов — `city-v1/README.md` и `transport-fit-qa.html`. Машину вписывать по X: fit.width=2.4; fit.depth=2.4 слишком растягивает всю модель.

## Ферма v3: новая композиция (25.10.2026)

`farm-v3/concept-v3-dense.png` — актуальный Image-концепт по референсам владельца: компактные 110×75, крупный амбар, цветные грядки и лесной край. `farm-v3/concepts.html` — обзор, `layout-proposal.json` и `layout-technical.svg` — точная сетка и предложения для 17 площадок. Это материалы на ревью, не обновлённая игровая сцена. Ограничения и план повторного использования описаны в `farm-v3/README.md`.

Объёмные культуры: `farm-v3/crops/` — референсы built-in Image, Studio-заказы H3.1,
точные промпты и отчёты. Все шесть культур: пшеница, капуста, лаванда, морковь,
подсолнух, томат. Всего 150 кредитов подписки (50 + 100), остаток Studio — 6050;
API не использовался. Полный набор занимает 469 252 байта, 15 608 треугольников
по уникальным GLB. Один меш/материал и одна цветовая WebP 512 на модель.
Верх +Y, основание Y=0; `model()` центрирует по XZ. Это статичные повторяемые пучки.
Исходники GLB в игнорируемой `raw/farm-v3-2026-10-25/`. Обработка:
```sh
node scripts/build-farm-crops.mjs assets-src/raw/farm-v3-2026-10-25 /tmp/farm-crops crop-wheat crop-cabbage crop-lavender crop-carrot crop-sunflower crop-tomato
```
Сравнение до/после на ширине 1180/390 и в ракурсе 3/4: `farm-v3/crops/qa-frame.html`.
Девять пучков пшеницы шириной 1.4 стоят внутри эллипса трактора; по шесть растений —
в каждой из шести грядок (ширина 1.8). Задний ряд моркови сдвинут от пугала,
чтобы защитная зона интерактивной игрушки не скрывала растения. `check-farm-decor.mjs` проверяет габариты
внутри грядок, отсутствие пересечений и запас проезда. Стоимость полного кадра
проверяется отдельно: число треугольников GLB не является измерением FPS или GPU.
Файлы с суффиксом `-full` создаются только для сравнения и в `public/models/` не копируются.
