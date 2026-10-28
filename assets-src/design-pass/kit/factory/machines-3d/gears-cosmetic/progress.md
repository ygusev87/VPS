# Cosmetic factory gears

2026-10-28 READY FOR INTEGRATION. Exact three-model card complete. Files: `public/models/factory-gear-small.glb`, `factory-gear-medium.glb`, `factory-gear-big.glb`. Total 158640 B; all three decoded clipped-triangle containment gates pass, radius 0.4 / 0.6 / 1.0, central pivot (0,0,0), +Y (not floor-normalized).

| Asset | Triangles | Bytes | Decoded radius | Y bounds |
| --- | ---: | ---: | ---: | --- |
| factory-gear-small | 3812 | 53020 | 0.399950680 | -0.036535913 … 0.080728968 |
| factory-gear-medium | 3842 | 51940 | 0.599942906 | -0.051068040 … 0.051262940 |
| factory-gear-big | 3874 | 53680 | 0.999937863 | -0.053776648 … 0.097014130 |

- `factory-gear-small.glb`: `eaeafcd8600dc3cc7f923d0a41d4122899cbabf6542101606749f2306a3e27fb`
- `factory-gear-medium.glb`: `a5e9a120882493db6212140b0635079c67fafdfac5a953f50314844b740cfcf8`
- `factory-gear-big.glb`: `767fa4e0e940b9b30552971c2d31d7a0b645f463255aa107d87ab4dacddf4342`

Small original and medium corrected flat-reference output use uniform fit only. Big uses original task 9b4912b9 / raw/big-attempt1.glb with documented local upper-hub clip at Y=.097, annular cap and intact bore; no nonuniform squash. Source hashes, bounds, node transforms and commands: README.md and per-model reports. The latest raw/factory-gear-big.glb is a rejected variant; tuning.json intentionally selects big-attempt1.glb.

Credits: 125 included, 4475→4350, five paid orders and three free retries, final live balance confirmed. No purchases/API. ledger.json contains all attempts and release selection.

QA: 12 individual + 18 assembly native-browser frames at 1180×820 and 390×844; phases 0/45/90, loader/constructors verified, axis (-2.45,.51,-.45), separation 1.4. Continuous body sweep passes; visual review passes; npm test: 17 files / 88 tests and typecheck pass. Cosmetic pair phasing only, no physical tooth-contact claim; physical iPad not tested. Existing 3 machine GLBs and relevant runtime sources unchanged. No src/shared coordination edits or push.

Deliverable index: manifest.json, README.md, qa.json, body-clearance.json, qa/batch-preview.jpg. Asset commit: **c5a0e9d** (local dev, no push). This note records the finished delivery; no other model orders in this bounded card.
