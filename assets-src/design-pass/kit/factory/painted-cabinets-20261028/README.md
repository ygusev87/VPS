# Painted control cabinet bodies, 28 October 2026

Two new side-view images for the two existing factory control cabinets. These replace only the appearance of `body`; the three original GLB lamp meshes, their cloned materials, power response and tap flash remain live. Runtime integration is Claude's next step. Main changed no `src` or GLB files and did not publish.

## Delivery

| Piece | File under public/textures/kit/factory | Dimensions | Bytes |
| --- | --- | --- | --- |
| factory-cabinet-west-painted | factory-cabinet-west-painted-a.webp | 768×576 | 23832 |
| factory-cabinet-east-painted | factory-cabinet-east-painted-a.webp | 768×576 | 23130 |

Total 46962 bytes. Both are in factory `kit.json`. SHA values, source hashes and nine unchanged runtime/model/reference files are in `sources.json`. Each texture has one alpha≥115 connected silhouette. East's single-alpha bottom border is retained and discarded by the existing .45 alpha test.

Four builtin imagegen calls: a real GLB guide for each side, then an edit removing invented/misregistered round sockets. Rejected first results are retained. Final raw PNGs are 1448×1086. Only full-canvas LANCZOS resizing and WebP quality90/alpha100/method6 followed generation. No crop, mask, painting, Tripo or paid API. `python3 .../build.py` verifies byte-for-byte output; `--write` recreates only these two derivatives. Prompts are exact; references have repository-local names. Nonround static switch projections and side-panel screws are decorative; three round lamp lenses come exclusively from the GLB.

## Placement and lamp contract

Use `placement.json` as the numeric source. These are two orientations of the same current `PROPS` model, so a single model-name-to-image mapping is insufficient. Choose west for current yaw +PI/2 and east for -PI/2. Do not rotate the raster again. Model fit `{height:2.1}`, both original holder positions and yaw stay unchanged.

| Side | Original X,Z | Ground anchor in image | Opaque span | Full card width |
| --- | --- | --- | --- | --- |
| west | -52.11,-10.12 | 370,533 | 227 | 3.336569335028568 |
| east | 52.11,26.33 | 392,531 | 216 | 3.5064872178309487 |

The old rotated world AABB width is S=.9861995300149544 and depth=1.2533860286263623, hence `front=.6266930143131811`, `deep=1.2709253964127891`. Anchors are the visual middle of the front feet line (may be transparent), ±1px, not the middle of the overall silhouette including the handle. They were checked against the actual lamps in Stage at 1024 and390. Artwork interprets the silhouette; orthographic guides and perspective Stage do not imply exact roof/body contour matching.

1. Keep original holder `m` and its geometry. Collect its four original meshes before adding art. Preserve the existing lamp-material clones and references in `cabinetLamps`.
2. If the correct texture is available, hide only the body from color/depth/shadows: `colorWrite=false`, `depthWrite=false`, `castShadow=false`. Keep `visible`, geometry, raycast, original transforms and Life membership. Do not apply the existing blanket all-mesh hide loop to the lamps.
3. On each original `lamp-*`, retain its material identity, texture, color and dynamic emissive updates. Use `transparent=true`, `depthTest=false`, `depthWrite=false`, `renderOrder=30`, `userData.noAO=true`, `castShadow=false`. Do not move nodes or reset quantized transforms. Do not replace the lamps with painted or constant-color circles.
4. Build art in a child group whose `rotation.y=-yaw`. Use existing `painted([{x:0,z:front,size:S}],texture,definition,blob)` in that child: fullWidth=S*768/span and geometry translation **once**, west `[.018229166666666685,-.05598958333333334,0]`, east `[-.01041666666666663,-.05859375,0]`. Existing cards Standard/sRGB/DoubleSide/alphaTest.45/noAO stays.
5. Use the accepted single replacement blob: local art x=S*.45, z=front-depth*.5 (=0), size=S*1.35, y=.009/order3. All added card/shadow meshes must have no-op raycast. No new pick shape or collider, no duplicate old shadow.
6. Add this art to the same holder already used by Life. Its jump/wobble and lamp flash callback remain unchanged. No static batching of the two independent holders.
7. If that side's texture is absent, leave its entire original GLB body/lamps/material/depth/shadow behavior unchanged. A missing west image must not select the east image, or vice versa.

Overlay lamps bypass depth testing, as tested locally against the adjacent walls. Claude must check current full-game moving occluders and general Input after integration. These isolated side views are not a global occlusion guarantee.

## Verification

`fixture.html` constructs actual FactoryMap/World/Stage/Life from ab54058, public loadModels/loadKit/loadGround, q2/DPR1, and substitutes art only in the fixture. `comparison.html` links twenty native JPEGs; `browser.json` contains corresponding states.

- 1024×768 and390×844, both sides, old/new, close views, red/green/evening amber on/off, diagnostic all-off, tap and return, fresh fallback. All factory models loaded; no console warnings/errors or horizontal overflow.
- 121 rays per state compare original meshes with the whole holder including the new descendants: 20 states, zero changed first hits. All six lamp local matrices remain unchanged. Lamp material UUIDs remain unchanged across the first18 same-instance states.
- Two native pointer clicks at390×844 (195,491), one per side, hit original GLB body and actual Life.tap accepted. Both call beep/chime hooks. Fixed dt .175 gives holderY.12 /rotationZ−.0385485882, then1.7 returns to rest. East's real tap flash red intensity1.6577 then.4088 while green stays on; after rest red goes to0.
- The actual FactoryMap.tick sets red/green intensity near2.2 for fixture-selected power. Evening amber goes2.1993→.0007. Fixture sets hum/box.closed/phase/time; it does not solve electrical wiring. Diagnostic all-off sets intensity0 directly.
- Rest anchor analytic error≤3.983e−9 (Float32 instance matrix). Fallback query hands no new textures to a fresh fixture; original four meshes per holder stay visible with original depth/cast state. This is not a network failure test.
- 88/88 tests in17 files and typecheck pass, started2026-10-28 21:37:34 Bangkok.

No general Input/11-station journey, physical iPad/PWA, auditory review, FPS/VRAM measurement or continuous motion recording claimed. Gameplay integration and publication remain with Claude.

## Previous batch review

`rack-runtime-review/` preserves two original comparisons from Claude m0604/ab54058: tall rack and booth shadow. Main inspected those images and the ordered B→A→old fallback / .45,.5,1.35 shadow diff, with no new static defect. Rack task marked done. Claude reported publication and11/11; main did not independently repeat those checks.
