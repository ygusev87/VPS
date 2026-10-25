# Mobile model pass — 2026-10-25

47 models: 9.91 → 6.69 MiB downloaded; 646,771 → 497,203 triangles in the complete asset inventory.

Embedded texture estimate: 740 → 94 MiB (RGBA8 plus mip chain). This is the sum of every asset, **not** actual simultaneously allocated GPU memory. No iPad FPS gain has been measured.

Color: max 512px WebP quality 88; normal/ORM: max 256px WebP quality 90. No material maps removed. Geometry error cap 0.25% of mesh radius; budget is a target, never forced beyond this error. Original decoded geometry, node transforms, skin and animation arrays are verified exactly for protected models. Embedded meshopt blocks are copied unchanged for those models.

Reflective solar/buzzer/drum/bell/panel/target/tuba meshes keep their geometry: simplifying them created visible highlight distortion during comparison. Mechanical pivots also remain exact. Sheep, tractor, doghouse, racecar and firetruck remain above triangle targets because of the quality error cap.

## Reproduce

Original web assets are backed up locally (gitignored) in `assets-src/raw/mobile-models-2026-10-25/`. Their SHA256 values and all per-model measurements are in `mobile-models-report.json`.

```sh
MODEL_SOURCE_DIR=assets-src/raw/mobile-models-2026-10-25 \
  MODEL_REPORT_PATH=/tmp/models-report.json scripts/optimize-models.sh
```

Preview with Vite at `/assets-src/farm-v2/model-diet-qa.html`. Optional `before` and `after` query arguments select directories. The comparison tool disposes model GPU resources after each image, so viewing the whole catalog does not keep all textures resident.

## Validation

All 47 final files: glTF Validator 0 errors. Warnings: existing generated tangent space (47), rigged mesh under Armature (1); meshopt unsupported-extension notices. All models visually compared before/after at game and top views; seven reflective models revised and checked again. Independent integrated QA by Claude (coordination m0033): 1180×820 and 390×844 at DPR 2, no console/page errors in table or farm, no visible model degradation. Farm overview: texture estimate ~266 → 55 MiB, rendered triangles ~472k → 290k, quality stays at 2. Chromium with Metal; not a physical iPad FPS measurement. Unit tests: 17/17; typecheck passed.

| Model | Triangles before | After | KiB before | After | Texture MiB before → after | Geometry exact |
|---|---:|---:|---:|---:|---|---|
| barn | 14619 | 8000 | 321.0 | 182.2 | 16 → 2 | simplified |
| battery | 7748 | 6000 | 184.1 | 122.5 | 16 → 2 | simplified |
| bell | 8377 | 8377 | 199.4 | 126.1 | 16 → 2 | yes |
| button | 6103 | 5999 | 166.9 | 117.3 | 16 → 2 | simplified |
| buzzer | 13195 | 13195 | 225.7 | 166.0 | 16 → 2 | yes |
| cannon | 9485 | 9485 | 176.2 | 124.1 | 16 → 2 | yes |
| carousel | 14392 | 14392 | 279.7 | 188.2 | 16 → 2 | yes |
| coop | 14920 | 7999 | 241.4 | 153.1 | 16 → 2 | simplified |
| cow | 17674 | 8000 | 234.8 | 141.1 | 16 → 2 | simplified |
| dog | 19952 | 7998 | 228.4 | 136.6 | 16 → 2 | simplified |
| doghouse | 17988 | 11001 | 260.2 | 197.7 | 16 → 2 | simplified |
| drum | 10510 | 10510 | 200.4 | 141.1 | 16 → 2 | yes |
| duck | 17569 | 7999 | 187.0 | 114.5 | 16 → 2 | simplified |
| dynamo | 16881 | 16881 | 217.0 | 167.3 | 16 → 2 | yes |
| firetruck | 13708 | 7654 | 260.5 | 169.8 | 16 → 2 | simplified |
| floorfan | 17228 | 17228 | 190.1 | 151.1 | 16 → 2 | yes |
| fox | 17008 | 8000 | 190.5 | 124.7 | 16 → 2 | simplified |
| fox-rig | 17007 | 17007 | 199.6 | 196.9 | 4 → 2 | yes |
| heater | 9263 | 5999 | 236.7 | 151.9 | 16 → 2 | simplified |
| helicopter | 8115 | 8115 | 179.9 | 119.1 | 16 → 2 | yes |
| hen | 17576 | 8000 | 221.5 | 128.9 | 16 → 2 | simplified |
| knife | 17473 | 17473 | 222.2 | 169.2 | 16 → 2 | yes |
| laser | 8104 | 8104 | 213.6 | 130.6 | 16 → 2 | yes |
| led | 5537 | 5537 | 152.7 | 90.2 | 16 → 2 | yes |
| magnet | 9371 | 9371 | 234.0 | 141.5 | 16 → 2 | yes |
| mirror | 9100 | 9100 | 163.3 | 113.5 | 16 → 2 | yes |
| motor | 16818 | 16818 | 233.0 | 180.5 | 16 → 2 | yes |
| musicbox | 9233 | 9233 | 210.4 | 140.5 | 16 → 2 | yes |
| panel | 16102 | 16102 | 199.4 | 151.2 | 16 → 2 | yes |
| pig | 17970 | 8000 | 195.0 | 117.7 | 16 → 2 | simplified |
| pole | 7769 | 5999 | 176.6 | 118.7 | 16 → 2 | simplified |
| propeller | 17488 | 17488 | 146.8 | 130.9 | 16 → 2 | yes |
| pump | 9567 | 9567 | 190.9 | 130.5 | 16 → 2 | yes |
| rabbit | 17469 | 7999 | 180.8 | 115.1 | 16 → 2 | simplified |
| racecar | 20264 | 9082 | 291.9 | 174.3 | 16 → 2 | simplified |
| sack | 22454 | 8000 | 318.3 | 147.7 | 16 → 2 | simplified |
| sails | 17042 | 17042 | 309.8 | 210.3 | 16 → 2 | yes |
| sheep | 26509 | 14981 | 250.3 | 182.7 | 16 → 2 | simplified |
| socket | 4390 | 4390 | 123.4 | 74.3 | 16 → 2 | yes |
| solar | 9415 | 9415 | 200.1 | 134.0 | 16 → 2 | yes |
| target | 7174 | 7174 | 176.9 | 111.4 | 16 → 2 | yes |
| tester | 9298 | 9298 | 218.4 | 139.2 | 16 → 2 | yes |
| tractor | 23271 | 13556 | 327.1 | 234.4 | 16 → 2 | simplified |
| trafficlight | 7689 | 7689 | 178.1 | 114.1 | 16 → 2 | yes |
| tuba | 13631 | 13631 | 277.8 | 181.7 | 16 → 2 | yes |
| windgen | 17352 | 17352 | 168.1 | 140.8 | 16 → 2 | yes |
| windmill | 16963 | 16963 | 189.2 | 154.2 | 16 → 2 | yes |
