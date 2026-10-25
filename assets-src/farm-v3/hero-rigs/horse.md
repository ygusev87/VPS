# Лошадь: скелет для реакций головы и хвоста

public/models/horse-rig.glb: **285064 байта (278.4 КиБ)**, 7920 треугольников,
1 skinned mesh, 1 материал, 26 костей, без клипов. Статичная horse.glb не менялась.
Вперёд +X, вверх +Y; в игре тот же fit, что у horse, без дополнительного rotateY.

Шея и хвост проверены в браузере: наклон головы 15°, взгляд в сторону 15°,
хвост ±20° с плавным циклом. Для спокойных реакций героя на месте.
Полноценная походка не заявляется: передняя нога −Z имеет только одну кость,
без колена/копыта. Отдельных костей ушей и челюсти нет.

## Карта костей

| Роль | Имя GLB (userData.name) | Имя после GLTFLoader |
| --- | --- | --- |
| Основание шеи, основной поворот головы | tripo::Head_0 | tripoHead_0 |
| Середина / верх шеи | tripo::Head_1 / tripo::Head_2 | tripoHead_1 / tripoHead_2 |
| Голова | tripo::Head_3 | tripoHead_3 |
| Хвост: начало → середина → конец | tripo::Tail_0 → Tail_1 → Tail_2 | tripoTail_0 → tripoTail_1 → tripoTail_2 |
| Соединение хвоста с крупом; оставлять в rest | bone_1 | bone_1 |
| Задняя нога +Z | tripo::1_Right_Limb_0 → _1 → _2 → _3 | tripo1_Right_Limb_0 → _1 → _2 → _3 |
| Задняя нога −Z | tripo::1_Left_Limb_0 → _1 → _2 → _3 | tripo1_Left_Limb_0 → _1 → _2 → _3 |
| Передняя нога +Z | tripo::0_Right_Limb_0 → _1 → _2 → _3 | tripo0_Right_Limb_0 → _1 → _2 → _3 |
| Передняя нога −Z, неполная | tripo::0_Left_Limb_0 | tripo0_Left_Limb_0 |

Head_0 у лошади не родитель передних ног: их общий родитель — Spine_3.
Для хвоста проверен Tail_0, не bone_1. Не переносить карту костей коровы по именам.
Все 26 костей, родители, координаты и исходные quaternion/scale — horse-audit.json.
horse-controls.json — точные оси и углы диагностической пробы.
Как и у коровы, поворот добавлять к rest quaternion, ось переводить из пространства
модели в пространство родителя; пример в qa.html. Клонировать SkeletonUtils.clone.

## Сохранность и сжатие

Максимальное двустороннее расстояние между вершинами после одинакового fit по
ширине — 6.92e-7 ширины модели. Ошибка bind pose в исходных единицах <3.15e-7.
Нет отрицательных весов или ссылок на отсутствующие кости; сумма весов
отличается от 1 не более чем на 1.26e-7.
Цветная 512² и metallic/roughness 256² карты скопированы из horse.glb байт в байт.

Meshopt INDICES сохраняет точную последовательность индексов. Обычный режим
TRIANGLES циклически переставил вершины двух треугольников, поэтому строгая
проверка остановила первую попытку экспорта. Теперь все массивы геометрии,
веса, inverse bind matrices, иерархия и TRS совпадают с исходным rig.
Не выполнялись simplify, weld, join, flatten, retarget. Движения пишет Claude.

Валидатор: 0 ошибок, 1 предупреждение о skinned mesh внутри исходной Armature.
Сжатые массивы дополнительно декодированы и проверены скриптом.
Browser QA: 1180×844 / 390×844, виды сбоку, три четверти и игровой.
Реальный iPad в этом шаге не тестировался.

## Происхождение и повторная сборка

Tripo CLI, rig v3.0-20260909, quadruped, glb:
- import a843f891-1a32-44bf-a2bd-0aa2513fd0f9;
- check 164f9bd0-2870-4459-9d12-0d58f8c10bde — 0, riggable=true;
- rig 6fd0a3de-5291-4dce-8ce8-adc08e123c5a — 25 API-кредитов.
Баланс 190 → 165, без ретаргетинга и новых покупок.

    node scripts/prepare-hero-rig-input.mjs public/models/horse.glb assets-src/raw/farm-hero-rigs-2026-10-25/horse-input.glb

Платная операция уже выполнена. Для локальной пересборки:

    node scripts/optimize-mobile-models.mjs --input assets-src/raw/farm-hero-rigs-2026-10-25/compress-input --output public/models --texture-source public/models/horse.glb --report assets-src/farm-v3/hero-rigs/horse-compression.json horse-rig
    node scripts/audit-hero-rig.mjs public/models/horse.glb public/models/horse-rig.glb assets-src/farm-v3/hero-rigs/horse-audit.json

Просмотр: /assets-src/farm-v3/hero-rigs/qa-frame.html?model=horse.
Исходный скачанный GLB и подготовленный input лежат в игнорируемой папке
assets-src/raw/farm-hero-rigs-2026-10-25.
