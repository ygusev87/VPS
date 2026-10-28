# Tablet feedback: kitten and tractor · 28 October 2026

**Kitten delivered; tractor remains unchanged with a concrete separation blocker.** This folder implements the bounded asset card relayed by main after owner tablet feedback (Claude m0578). Runtime work stays with Claude. No Tripo orders, API calls, purchases, new models or changes to the hayloft.

## Kitten: grey-white coat

`public/models/kitten.glb` now uses the built-in imagegen edit of its existing color atlas. A light grey coat with white patches contrasts with the orange hayloft. The face, eyes and markings remain recognizable in native WebGL review. The atlas edit adds fine painted fur detail; facial pixels are not claimed to be bit-identical.

- **116136 bytes, 7764 triangles** (original111316 bytes / same7764 triangles; farm target8000).
- One OPAQUE material, 512×512 WebP base color and the original 256×256 ORM. Meshopt and KHR_mesh_quantization retained.
- Compressed geometry buffers, ORM bytes, material parameters, mesh indices, UVs, node hierarchy and transforms are **unchanged byte-for-byte**. Only the base-color image payload and necessary GLB offsets/lengths changed.
- No original skin or animation, and none added. Existing procedural gameplay animation remains a runtime concern.
- Raw bounds: min `[-0.45823541978209786, -0.5, -0.3643604846339305]`, max `[0.45823541978209786, 0.5, 0.3643604846339305]`. Pivot/orientation unchanged. Runtime fit height`.75`, yaw`-.6`; LOFT`(-21.3,-16.25)`, top`1.95`, local offset`(.3,.2)` (worldXZ`(-21,-16.05)`). No floor or coordinate adjustment to the GLB.
- Original SHA256: `f0fc67190048cbb9b37b668f6ea98f3f0875d2dce0aa741c636258f943edc6c4`.
- Delivered SHA256: `b64d165bee1ec6eaf8bbeb2a21dfded68dae49d46bf094bd98aa2eaf4f877315`.

The edited raster came from built-in imagegen, saved in `textures/kitten-grey-source.png`. Exact submitted prompt: `imagegen-request.json`; expanded preparation brief: `kitten-edit-prompt.txt`. The only subsequent raster processing is mechanical resizing to512×512 and WebP encoding quality88 with sharp. `replace-atlas.mjs` preserves all non-base-color byte ranges. `kitten-report.json` independently verifies the decoded output, binary ranges, hierarchy and glTF validation.

Native browser QA: original/candidate oblique, face-side/rear views, original/candidate on the actual hayloft at1180×820 and390×844. The released file was then loaded through `src/parts/assets.ts` with production fit in the390 view. `kitten-browser-qa.json` and `qa/kitten-before-after.jpg` record the result. The fixture places the kitten and unmodified actual hayloft using production coordinates, but it does not claim a full gameplay walkthrough or physical iPad test.

## Tractor: why no replacement was issued

The current tractor has **13556 triangles / 240008 bytes**, one connected surface after UV-seam welding, one material, 512px color plus256px normal/ORM, no skin or animation. Its original node retains uniform scale`.5` and translation`[0.00014358758926391602,0.00018312036991119385,0]`. Raw bounds: min`[-0.31517365231673905, -0.38006224844627584, -0.5]`, max`[0.3154608274952669, 0.38042848918609823, 0.5]`. Source orientation, atlas and public bytes remain untouched.

SHA256: `c5011b89177f9830e62a96bd7a71ddd0cdaadd0edc7931fdca1660e4e61d4802`.

The evaluated partition keeps the body fixed and seeks four local+X wheel pivots. The two front selections have simple16-edge boundaries. The rear tires are fused to the fenders/inner supports; there are no four pre-existing disconnected wheels. Slicing at |X|=.13 through.17 leaves rear wheel and fender in the same component. At |X|=.18 they separate, but that plane is already inside the rubber sidewall and leaves inner tire geometry on the stationary side. See the colored section diagrams.

A texture-aware selection was tried to distinguish green fenders from tires/rims. It is **not a deliverable**:

| Provisional region | Faces | Boundary edges | Boundary components | Branched boundary vertices |
| --- | ---: | ---: | ---: | ---: |
| front right | 808 | 16 | 1 | 0 |
| front left | 784 | 16 | 1 | 0 |
| rear right | 2526 | 220 | 13 | 10 |
| rear left | 2561 | 241 | 10 | 20 |

A further topology-only check absorbed isolated body-colored islands back into their surrounding wheels (see `tractor-topology-check.json`). This reduces the rear boundaries to **2 right / 3 left**, each still containing a branched vertex. The right upper attachment spans about **.25 in Y / .295 in Z**; these are extended fender/support junctions, not simple axle-plane holes. After that cleanup the body has **6438 triangles**, leaving **1562** for wheels/caps versus **7118** wheel triangles (about **78% reduction** required). This follow-up was also kept diagnostic-only.

These rear boundaries are multiple nonplanar seams, including stationary colored patches within wheel surfaces. Merely adding pivots or a flat cap would conceal rather than solve the geometry problem. Closed cuts and collision-free rotation have **not** been established, so no `wheel-*` runtime nodes, accepted centres or radii are delivered. `diagnostic/tractor.glb` is a locally retained color-coded selection preview; it must not replace public/model data.

There is also a budget tradeoff: the existing tractor exceeds the mobile farm target8000. The first provisional unchanged body alone is6877 triangles, leaving1123 for all four wheels and caps versus6679 selected wheel triangles. Meeting this would require about83% reduction of those wheels before adding caps. No such unreviewed loss of tread/silhouette was applied.

**Required next step:** deliberate local retopology at both rear wheel/fender attachments, reconstructing hidden inner tire surfaces and reviewing the body boundary and rotating clearance. This exceeds a safe preserve-body partition of the existing mesh. The current card's requested fallback is a documented blocker; it does not justify replacing the public model with the diagnostic trial.

`tractor-report.json` contains exact original transforms, boundary measurements and explicit non-release status. `partition-analysis.mjs`, `tractor-sections.mjs`, `tractor-inner-sections.mjs`, `tractor-semantic.mjs` and `tractor-boundary-report.mjs` reproduce the investigation. This is one examined conservative partition, a semantic trial and a topology cleanup check, not a proof that no possible manual mesh repair exists.

## Reproduction and checks

Original GLBs are retained in `originals/` with `originals.json` SHA records. Generated mesh-dump JSON and diagnostic GLBs are ignored but remain local; rerunning the scripts recreates them. Release candidate kitten is retained in `candidate/kitten.glb`.

From repository root:

```sh
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/inspect.mjs
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/replace-atlas.mjs assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/originals/kitten.glb assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/textures/kitten-grey-source.png assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/candidate/kitten.glb
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/validate-kitten.mjs
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/partition-analysis.mjs
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/tractor-sections.mjs
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/tractor-inner-sections.mjs
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/tractor-semantic.mjs
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/tractor-topology-check.mjs
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/tractor-boundary-report.mjs
node assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/tractor-diagnostic.mjs
npm test
npm run typecheck
npm run dev
```

Preview URL: `/assets-src/design-pass/kit/farm/tablet-feedback-20261028/model-worker/preview.html`. Inspector: `qa.html?m=kitten&source=public&loft=1`; tractor trial: `qa.html?m=tractor&source=diagnostic`.

Validation on28 October: **17 test files /88 tests passed; typecheck passed; glTF kitten validation0 errors/0 warnings**. Browser geometry/texture loading and mobile framing pass. No `src`, common kit, other public files or shared coordination cursors were edited. No push.
