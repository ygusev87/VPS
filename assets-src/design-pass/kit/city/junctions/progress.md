# Городские дорожные стыки

Готовы corner/tee/cross/end/zebra, 676588 байт. Промпты/все 11 исходных генераций/упаковка/manifest/9 native JPEG сохранены. Геометрия въездов и тёмный асфальт corner/end исправлены встроенным image_gen; ручной дорисовки нет. Проверены 1024×768 и390×844, все4поворота угла, tee180°, тройной фон. Есть небольшие отличия камней/тона и тонкая линия строгого стыка; требуется игровая приёмка с текущим overlap, см.README.

Main добавляет5имён в city/kit.json (теперь8). Bush2 ee46620 приняты main по двум native JPEG и добавлены в farm/kit.json (теперь37). Worker заканчивает city ground4 и затем независимо делает7карточек city flora. Общие src не менялись.

Фабрика: выбран industrial-b, концептыf9a757b уже в origin/dev. Новый FACTORY-KIT.md прочитан: город впереди, затем8корпусов станков, пол/дорожки, декор. Следующая main карточка города — kerb-strip, canal-water, quay-strip, harbour-water и park-lawn; worker-зона ground/flora не пересекается.

Проверки перед коммитом: npm test — 88/88, npm run typecheck — успешно (26.10, 21:41 Asia/Bangkok).
