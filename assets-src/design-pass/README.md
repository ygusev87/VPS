# Дизайн-проход: ориентир вида карт

`game-now/` — как карты выглядят в игре сейчас (без панелей, качество 2).
`variants/` — те же карты, перерисованные GPT Image 2.5 (Higgsfield) в стиле мобильной фермы
с той же раскладкой: farm-a/b/c из `game-now/farm-overview.png`, промпт ниже. Качество high —
1,5 кредита за картинку (не 0,25, как при quality low).

Промпт farm-a/b/c: «Repaint this top-down 3D farm board game map as a polished cozy mobile farm game
(Hay Day / FarmVille 3 / Township), keeping EXACTLY the same layout … lush hand-painted grass with several
shades, patches, clover and tiny flowers, shadows along fences; roads warm packed-earth paths with soft
edges, pebbles, ruts, grass creeping over; wet glossy mud with puddles and hoof prints in the pig pen;
crops in furrows; small props near buildings; a rim of trees around the board.»

Владелец выбирает ориентир; затем — что из него шейдер земли (`src/ground.ts`), что текстуры и декор (Codex).
