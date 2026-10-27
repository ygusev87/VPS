# Следы износа пола: три масла и пыль

Четыре новые factory-floor-* декали, 240962 байта суммарно. Масла A/C и пыль512×512, мазокB512×171. Прозрачный WebP, исходники и точные4промпта в generation.json; встроенный image_gen, без Tripo. build.mjs только resize/WebP90 alpha100.

Готовы к интеграции; добавлены в factory/kit.json. report.json содержит SHA/байты/alphaBounds/размеры. Масла: borderNonzero0. У пыли четыре чёрных краевых пикселя alpha1/255 (шум, не видимый обрез); исходник не стирали. Это явно разрешено проверкой и отражено в отчёте.

Размер всего холста / opacity: oil-a2.8×2.8/.42; oil-b5×1.667/.40; oil-c2.8×2.8/.38; dust3.4×3.4/.22. MeshBasicMaterial white/sRGB, transparenttrue/depthWritefalse/depthTesttrue/FrontSide/alphaTest0. XYplane rotationX−pi/2, normal+Y; на стендеYfloor+.015. Окончательные позиции/высота уClaude, не закрывать подсказки/границы заданий. Не collider/pickable/shadow.

Mainосмотрел4nativeкадра1180×820/390×844 на существующей текстуре factory-floor-a, светлый/тёмный пол, сверху/наклон. Console0/overflowX0; никаких прямоугольных подложек/видимых цветных ореолов. Пыль намеренно слабая на светлом фоне. Полная карта/соседние слои ещё не приняты, физическийiPad/PWA не проверен.
