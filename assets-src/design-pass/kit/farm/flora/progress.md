# Луга —9 карточек растений

Все9готовы: **tuft-card-a, tuft-card-b, tuft-card-c, flower-card-a, flower-card-b, flower-card-c, flower-card-d, shrub-card-a, shrub-card-b**. WebP в public/textures/kit/farm/, суммарно254866байт. kit.json остаётся main.

9built-in imagegen-вызовов, повторов0; все9оригиналовPNG побайтово сохранены, полныепромпты/SHA/manifest/README/qa-review. Финальные native JPEG: каждый на белом/чёрном/фактическом grass-main-a, крупно+32/48/64px. Все9прошли alpha/readabilityQA.

Техническая обрезка рамки удалила только дальние пиксели alpha1, сохранив нативную альфу растения и полные originals. Подробный cropAudit в manifest. Нижний центр: y254/256 у большинства, y253 уtuft-b/flower-d; y508/512 укустов. Точные Sprite.center в manifest/README. Anchor — центр нижнего видимого силуэта, не измеренный скрытый корень. Точный52° требует игрового сравнения.

Field завершён коммитом **15f11f2**: 7WebP, 6готовы, ruts-strip условно — небольшой стык, не verifiedseamless. Здесь готовится отдельныйflora-коммит только своихфайлов, безpush. Runtimeне менялся; интеграция/FPS/PWA уmain/Claude.

ВзрослыеTripo отложены. Factory не начинать. Общийread/ack не используется. Следующий разрешённый конечный шаг — bush-card-a/b (512²), широкие плотные кусты для лесной кромки, отдельная зона bush/. Main делает pond-rim/yard3. Peek841 active, Codex78% осталось.
