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
| battery | отсек 2×AA, синий, с батарейками | aa1360c0-d551-4053-824b-140e11911a51 | fa29bad3-1060-4490-b44f-ede5272375c9 |
| socket | патрон лампочки без колбы | bc1690fe-00e5-4094-b9b3-02ce71235071 | c60f3d6a-6fb8-4cde-a853-c29306c65088 |
| motor | моторчик на бирюзовой стойке, без пропеллера | 78fb7994-c39a-4179-8258-0bfdd5c92456 | fd02ed35-0d10-4ce6-b629-cece46183597 |
| propeller | трёхлопастной пропеллер | a2a63c0c-a57a-4206-8ec4-bc958350bf88 | 28a72867-ab18-4432-8410-73d19be23816 |
| knife | основание рубильника без ножа | 3b43d43c-19e9-4fd0-aad3-353a13d50647 | 88233539-47b1-4677-8ed4-6f1ae84a2ed7 |
| led | красный светодиод (гладкий купол) | afc228b0-108f-4340-9588-8ac54346baa9 | f6bec243-e1e4-46cd-ad5f-ee55dba42ad1 |
| buzzer | пьезопищалка | 2c2e2294-51b3-4e21-9314-7f9c41ef3952 | 7f751ea4-ac23-4f36-a495-0af449137cd1 |
| bigbattery | отсек 4×AA, бирюзовый («большая батарея 6 В») | 34f43e75-f71d-431e-8784-3641eb269dad | 16e5f4c1-3270-4e64-ae58-0eb20d9f93af |
| carousel | карусель с лошадками | 896e30f6-ea6f-4289-a171-d6b770f0bf0b | c106eed0-c101-4a4c-8241-b26b7fec45dd (face_limit 40000) |
| windmill | башня мельницы без крыльев (смотрит в +x, в коде `rotateY: -π/2`) | d8f5a2dd-526f-4765-8b18-4d5c3863e411 | 6f5bd53e-c88b-4dff-afc6-2a04266b4cb9 |
| sails | крылья мельницы (плоскость YZ, `rotateY: -π/2`) | 988003df-fe9d-482f-baed-7c4c4e687ff0 | aa184479-160d-4ff4-832f-576b079ab0c4 |
| musicbox | музыкальная шкатулка | e141a3c9-ceea-4659-99af-e80fc70499cf | 70eac3c3-3687-442c-b33d-575a74f919ed |
| button | большая красная кнопка | df4e97d8-ca15-44bb-8ada-cdf643536349 | 72f5f4dd-40b7-462e-b647-f9ad9749d9f3 |
| panel | пульт с тремя кнопками (вдоль z, `rotateY: -π/2`) | 219fefd8-45f6-4c14-ac68-5a91eaa2b382 | c8d656d7-a0d2-4e92-98fb-1ae19c5e46ab |
| drum | игрушечный барабан, красный с зигзагом | 79c4d8b7-b12c-4a59-b399-9102420a4dc2 | a1db1876-120e-4817-b291-77cf4d253efb |
| racecar | красная гоночная машинка (для трассы) | 2bfaf157-1053-4f07-bd42-105bc2583ba4 | ce773a91-a992-4872-96e0-0ed8a95d51a6 |
| helicopter | жёлтый вертолёт без винта | 430de888-4b2c-45cb-ad81-ff311201415f | e4c50fca-365a-4456-858e-2a5948de9689 |
| firetruck | пожарная машина без мигалок | c1e6f768-00f3-4188-8320-a00e8e9174b8 | f83185e4-7293-4069-8f1f-6e0b52807268 |
| dynamo | корпус динамо-машины с циферблатом (циферблат в +x, `rotateY: -π/2`; ручка строится кодом) | 6e8a8f88-8b50-4ed3-b5fc-b27790f1fa51 | 5702c830-b24b-44ab-af00-54aaf9ab3381 |
| tuba | латунная туба (в коде блеск: metalness 0.85, roughness 0.32) | 9176e509-e7b5-4d03-8b26-7ed5f68539ea | b16454a0-73b4-4c4f-a0ec-24dfd650e95c |
| floorfan | подставка напольного вентилятора с мотором, без лопастей (ручка мотора в +x, `rotateY: -π/2`; лопасти и решётка — кодом) | 3130e2d7-25b8-4fbf-94de-6208f39ad438 | fbe260f5-8266-4ccf-8b1a-51f4b55bfc83 |
| cow, pig, hen, rabbit, dog, fox | животные фермы (смотрят в +x; задачи — в истории Higgsfield за 24.10.2026) | — | — |
| barn | красный амбар (двери в +x, на карте `rotateY: -π/2`) | — | 20d4f4b1-8701-40e5-ba66-574704f8a12a |
| coop | курятник с лесенкой (дверца в +x, `rotateY: -π/2`) | — | 781be023-b76a-4184-a1b7-05d87066e757 |
| tractor | зелёный трактор (нос в +z, на карте `rotateY: π`) | — | 86008a18-4f91-4e9f-9ce2-9bf7413a7503 |

Картинки карт для выбора (`public/maps/*.webp`, 480 px) — `gpt_image_2_5`, 4:3, «cute cartoon isometric diorama …
cream background #f6eddd, no text»; исходники `assets-src/concepts/map-*.png`.

Лифт и кран строятся кодом целиком (`src/parts/more.ts`), как и компьютерный вентилятор, вертушка (`src/parts/wind.ts`), пианино, маракасы, колокольчики (`src/parts/band.ts`) и все механизмы (`src/parts/mech.ts`). Ксилофон, светофор, диско-шар и трасса (кроме машинки) строятся кодом целиком (`src/parts/extra.ts`, `src/parts/fun.ts`).

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
