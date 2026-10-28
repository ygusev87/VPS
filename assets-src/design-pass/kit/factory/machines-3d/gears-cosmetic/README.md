# Cosmetic factory gears · 28 October 2026

Three finished assets, ready for runtime integration. Exact card: `../../readability-night/gears/lathe-fix-20261028/worker-brief.md` (main eb08a59, corrected axis Claude 02be7ce). This delivery changes only this source folder and the three new `public/models/factory-gear-*.glb` files. Runtime integration belongs to Claude.

| Asset | Triangles | Bytes | Decoded max radius | Decoded Y range |
| --- | ---: | ---: | ---: | --- |
| factory-gear-small | 3812 | 53020 | 0.399950680 | -0.036535913 … 0.080728968 |
| factory-gear-medium | 3842 | 51940 | 0.599942906 | -0.051068040 … 0.051262940 |
| factory-gear-big | 3874 | 53680 | 0.999937863 | -0.053776648 … 0.097014130 |

Total **158640 bytes / 11528 triangles**. Each has one mesh, one OPAQUE material, one 512×512 WebP texture and Meshopt compression; no skeleton or animation. Six/eight/fourteen teeth and three/four/six open spokes respectively. The color intent is brass / steel / copper; references and native GLB frames are retained.

## Pivot and integration

All three have centre pivot `(0,0,0)`, rotation axis **+Y**, wheel plane XZ. Logical radii remain **0.4 / 0.6 / 1.0**. Geometry intentionally extends below the pivot: **do not floor-normalize or fit by AABB width**. The files already have their final scale. Preserve nested glTF quantization node transforms.

The present `model()` loader adds an offset to put an ordinary model on the floor. The owned fixture removes only that loader-added scene offset:

```js
const wheel = model('factory-gear-big', {});
wheel.children[0].position.set(0, 0, 0); // scene offset only
gear.wheel.clear();
gear.wheel.add(wheel);
```

Do not set the nested `gear` node's position/scale to identity. `gear-pivot` is identity; `gear` retains the quantization transform documented in each report. Code keeps plates, pegs, picking, `gearAt().y === .51`, logical radii and speed ratios.

The allowed union is rim radius r at Y[-.069,.069], upper spoke radius .7r at Y[.069,.084], hub radius .3r−.001 at Y[-.099,.099]. The validator decodes world-space mesh vertices, splits every triangle at each Y boundary, and checks the resulting convex polygons. This proves radial/slab containment for continuous Y rotation, including triangles with individually valid vertices that cross an invalid region. The numeric tolerance is 1e−7; fitting leaves .00005 nominal radial slack.

These are cosmetic gears. The phase frames **do not establish physically phase-locked, overlap-free tooth contact** between wheels.

## Provenance and local cleanup

References were created with built-in image generation; prompts, source image paths and hashes are in `prompts.json`, `flat-prompts.json`, `references.json` and `refs/`. Tripo used H3.1, requested 4000 triangles, 2K textured, delight on, ultra/AI enhancement/PBR/8K/parts off. Native settings and completion evidence are in `studio/`.

- Small: original task `b023388e-a64f-428d-9924-78a61a2019b6`, `raw/factory-gear-small.glb`; uniform normalization and texture/compression only.
- Medium: corrected flat-reference task `8a4faed3-e31b-4521-b092-5ba0871e3953`, `raw/factory-gear-medium.glb`; uniform normalization and texture/compression only. Original and free-retry raised hubs exceeded the Y envelope.
- Big: original task `9b4912b9-cfa2-4ee1-a62f-5e5540d4f052`, **`raw/big-attempt1.glb`**. After uniform normalization, locally clip only the excess hub above Y=.097 and close its annulus while preserving the bore. Cut points all lie inside radius .299. No nonuniform scaling; retained lower vertices are unchanged before final quantization. The operation removes 154 entire top triangles, clips 100 crossing triangles, and caps with 100 triangles: 3876→3874. Both cut loops have complete boundary coverage and cap area matches the annular polygon. The cap samples a single existing red atlas texel to avoid stretched UV islands. This is a local geometry repair, not an untouched Tripo export.

The big flat-reference paid attempt and its free retry were rejected for the rim/shape envelope. **`raw/factory-gear-big.glb` currently contains the last rejected attempt**, also saved as `raw/big-attempt4.glb`; `tuning.json` explicitly selects `big-attempt1.glb` for the final build. `big-attempt4-orientation.json` records the rejected source investigation; it is not a final orientation. Rejected reports are named by attempt. Free retries retain the same Tripo task ID with different history variants.

Raw/candidate downloads are retained locally in ignored directories; they are not included in Git. Reproduction from another checkout requires those originals, verified by source SHA256. Committed refs, output files, scripts, ledgers and reports preserve the provenance.

**Actual debit: 125 included credits, 4475→4350; five orders at25 and three free retries.** Final balance4350 observed in Tripo. No purchase, top-up, subscription or paid API. Details: `ledger.json`.

## Exact normalization and hashes

- **factory-gear-small**: source origin `[0, 0.04623604565858841, 0]`, uniform scale `0.7902958486869801`; decoded min `[-0.3951479196548462, -0.03653591298847953, -0.3829197635670135]`, max `[0.3951479196548462, 0.08072896846919814, 0.3829197635670135]`. Source SHA256 `5e151218c04e0963a13e21f5f570e150285c521928df0e80940f358825c0a709`.
- **factory-gear-medium**: source origin `[0, 0.04297447204589844, 0]`, uniform scale `1.1881924478926447`; decoded min `[-0.5940962433815002, -0.051068039764634386, -0.5923556739255041]`, max `[0.5940962433815002, 0.05126293950246932, 0.5923556739255041]`. Source SHA256 `eed7ddfeaf59ba8d0d24906bcfd6680be6d921fb33a4c2a7a977407c9f82e982`.
- **factory-gear-big**: source origin `[0, 0.02713717520236969, 0]`, uniform scale `1.9811392438325`; decoded min `[-0.9905696511268616, -0.05377664832253852, -0.9874256573612683]`, max `[0.9905696511268616, 0.09701412958879867, 0.9874256573612683]`. Source SHA256 `a9b695bd3f8ef838875ede10299355ce7bd54c0af63b339e6524c7aefb06782d`.

- `factory-gear-small.glb`: `eaeafcd8600dc3cc7f923d0a41d4122899cbabf6542101606749f2306a3e27fb`
- `factory-gear-medium.glb`: `a5e9a120882493db6212140b0635079c67fafdfac5a953f50314844b740cfcf8`
- `factory-gear-big.glb`: `767fa4e0e940b9b30552971c2d31d7a0b645f463255aa107d87ab4dacddf4342`

## Reproduction

From repository root, using its installed Node dependencies and the retained local raw sources:

```sh
node assets-src/design-pass/kit/factory/machines-3d/gears-cosmetic/build.mjs factory-gear-small
node assets-src/design-pass/kit/factory/machines-3d/gears-cosmetic/build.mjs factory-gear-medium
node assets-src/design-pass/kit/factory/machines-3d/gears-cosmetic/build.mjs factory-gear-big
node assets-src/design-pass/kit/factory/machines-3d/gears-cosmetic/check-containment.mjs
node assets-src/design-pass/kit/factory/machines-3d/gears-cosmetic/check-bodies.mjs
npm test
npm run typecheck
npm run dev
```

`build.mjs` writes a public output only when all gates pass; reports retain final decoded bounds and transforms. Preview at `/assets-src/design-pass/kit/factory/machines-3d/gears-cosmetic/preview.html`, detailed views at `qa.html`, production-constructor assembly at `fixture.html?kind=lathe&phase=0&view=0` (also grinder/medium). These are worker-owned diagnostics, not new game UI.

## Validation

- All three release reports pass; glTF validator: zero errors/warnings. Its unsupported-Meshopt informational note is covered by actual loader validation.
- Native in-app WebGL: 12 individual frames plus18 assembly frames at1180×820 and390×844. `qa.json` records exact metrics; `qa/` contains frames. Visual review passed top/bottom/oblique/rear views and phases0/45/90, with no overflow or console warnings/errors.
- Actual `src/parts/assets.ts` loader and `Lathe`, `ShaftMotor`, `Gear` constructors. Corrected axis `(-2.45,.51,-.45)` and motor axis `(-3.85,.51,-.45)`, separation1.4. Small/big motor–lathe, big/small motor–grinder; medium standalone.
- Continuous body-sweep check passes: smallest checked lathe radial margin .296948; grinder .983431. Motor body has no triangles in the occupied Y slabs. Intended code-generated axle/bearing contact is excluded. This is a focused body-clearance check, not an assertion about arbitrary scene neighbours.
- `npm test`:17 files/88 tests passed; `npm run typecheck`:passed (28 October11:10 Bangkok). Three targeted containment regression cases passed.
- Original shaft-motor/lathe/grinder GLB hashes, relevant runtime source hashes and brief hash are unchanged (`integration-sources-final.json`).
- Physical iPad/Safari was not tested in this pass. No runtime integration or deployment in this delivery.
