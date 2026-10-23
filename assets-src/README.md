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
