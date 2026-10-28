# Painted factory trolleys, 28 October 2026

Two views for the existing `factory-box-trolley` props. The image, boxes and wheels travel with the original holder and its existing Life tap trick. Original geometry remains the pick target. Runtime integration belongs to Claude; main changed no src or GLB and did not publish.

## Files and source

| Piece | Public WebP filename | Dimensions | Bytes |
| --- | --- | --- | --- |
| factory-trolley-east-painted | factory-trolley-east-painted-a.webp | 768×576 | 41646 |
| factory-trolley-west-painted | factory-trolley-west-painted-a.webp | 768×576 | 41102 |

Total82748 bytes, both added to factory kit. Exact SHA values in `sources.json`. Two builtin imagegen calls, first result accepted for each side, zero Tripo/API. Exact prompts and two1448×1086 RGBA source PNGs retained. Postprocessing only full-canvas LANCZOS resize/WebP90 alpha100 method6. No crop, mask or painting. `build.py` defaults to byte verification; `--write` recreates these two derivatives. Each alpha≥115 silhouette is connected; bottom border max alpha1 retained and discarded by existing alphaTest.45. The handle opening remains transparent.

Reference: public static GLB84968B/3544tri/one mesh/material, SHAa389222462a07917bb2d99fb726215e9a323938575bc5674a309f5b3b52213ad. Original depth1.6, height1.207800531. No wheel animation added: this asset's four casters are part of one static mesh. Seven runtime source files and GLB byte-match bfd5192.

## Placement contract

Use `placement.json`. Keep original root positions, fit `{depth:1.6}`, yaw and Life unchanged. No new pick/collider. Each independent trolley gets its own card/shadow in an art child with `rotation.y=-yaw`. The image already contains the current yaw.

| Side | Root X,Z | yaw | piece | size S | span | front Z | deep |
| --- | --- | --- | --- | --- | --- | --- | --- |
| east | 13.5,7.29 | +.3 | factory-trolley-east-painted | 1.4233069544023904 | 309 | .9309589299887242 | 1.3081632561538485 |
| west | -16.2,7.56 | -.25 | factory-trolley-west-painted | 1.3885693360786842 | 305 | .9146794517130024 | 1.317441524808627 |

Both image anchors `[384,528]`, one unit geometry translation `[0,-.0625,0]`. FullWidth=S*768/span: east3.537539614825359 / west3.4964631151096044. Existing `painted([{x:0,z:front,size:S}],tex,definition,blob)` then art.rotation.y=-yaw gives the tested result. Existing cards Standard/sRGB/alphaTest.45/DoubleSide/noAO applies.

**Selection warning:** these side names describe the trolley's geographic placement: positive yaw=.3 is EAST. The current cabinet fallback in bfd5192 maps positive yaw to WEST; do not reuse that rule blindly for trolleys. Select the trolley definition explicitly, e.g. name==='factory-box-trolley' ? (yaw>0 ? east : west) : existing cabinet logic. Never use the opposite-side raster as fallback.

The scale comes from the original full-canvas orthographic projection: fullWidth=1024/guide.ppu. A rotated mesh bounding box contains empty corners, so fitting to its conservative width1.55056/1.48889 would inflate the sprites. Precise old world vertex-X widths are1.39730243075/1.35829859013; interpreted painted opaque widths are about1.9%/2.2% larger. No claim of exact old perspective contour matching. View=normalize(0,1,.78), guideyaw identical to PROPS.

Anchor is the guide's virtual projected ground point `(0,0,conservativeBox.maxZ)`, at512,704 on1024×768 →384,528 on768×576. It is intentionally below the drawn wheels, not a wheel-contact pixel or physical rolling constraint. This preserves full-canvas registration and original scene placement without clipping lower parts into the floor. Do not recenter the image using alpha bounds or move this anchor to the lowest opaque pixel.

When this side's texture is ready, collect the original mesh before adding art. Set originalmaterial.colorWrite=false/depthWrite=false and castShadow=false; retain visible/geometry/raycast. All new card/shadow mesh raycasts must be no-op. Add art to the SAME holder passed to Life.addProp. Keep existing trick `x + sin(min(1,k/1.4)*PI)*.5` and its k<0 reset; do not freeze the picture into scenery. Do not animate static caster shapes individually.

Use one accepted replacement blob per holder: art local x=S*.45, z=front-depth*.5 (=0), size=S*1.35, y=.009/order3. No duplicate original shadow. With missing correct-side texture, keep the whole original GLB with all original material/depth/shadow state. The existing model remains untouched.

## Checks

20 native JPEGs and20 recorded states in `qa/`, `browser.json`, `comparison.html`. Actual FactoryMap/World/Stage/Life, public loadModels/loadKit/loadGround, q2/DPR1,1024×768 and390×844. Both old/new at game and close scale, taps, shift peak, return, fresh fallback. Every factory model loaded, no warnings/errors or horizontal overflow.

121 ray tests per state compare original mesh first hit with whole holder descendants:20states,0mismatch. Original mesh UUIDs unchanged across18 same-instance states. Two native390 pointer clicks at195,510 hit original trolley GLB and actual Life.tap accepts/chime. Actual Life.update(.175) gives shiftX.1913417162/rootY.12/Zrotation−.0385485882; another.525 gives total elapsed.7 and shiftX.5 for BOTH trolleys. A further1.7 returns shiftX/Y/Zrotation to0. Art transforms inherit the holder, max anchor transform error1.597e−8. These are discrete fixed-dt states, not a continuous motion recording or audio review.

Fresh fallback=1 passes no new texture to the fixture: both old models visible with depth/cast true. Not a simulated network outage. 88/88 tests in17files and typecheck pass, started21:58:02 Bangkok. No general Input/story11, physical iPad/PWA, physical contact/rolling, FPS/VRAM claims. Claude checks general Input, neighboring occlusion and runtime movement after integration.

## Previous cabinets review

`cabinets-runtime-review/` contains Claude m0606's two original before/after/tap comparisons. Main inspected them plus bfd5192 diff: material/placement contract and static appearance accepted, taskDONE1272. Claude's1024 generalInput taps,11/11 and publication are his report, not independently repeated. Thin edge visibility of lamps is acknowledged and explicitly deferred by m0606 (“не сейчас”); no lamp or cabinet redraw was started.
