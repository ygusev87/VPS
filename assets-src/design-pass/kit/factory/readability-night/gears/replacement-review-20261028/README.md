# Main acceptance: three cosmetic gears, 28 October 2026

Accepted worker delivery `c5a0e9d` / `54ce440`: **158640 bytes, 11528 triangles** across small, medium and big. Each is below 4000 triangles / 150000 bytes, with one OPAQUE material, one 512² WebP and Meshopt. Runtime integration remains Claude’s task.

`audit.json` independently decodes final public GLBs, verifies their SHA, and clips every triangle at the allowed cylinder-union Y boundaries. All three stay inside the card through continuous Y rotation. The large gear’s repaired top annulus has 100 upward triangles, 200 local edges each incident to two triangles, and no cap triangle covers the bore origin. This is a local cap check, not proof that the entire mesh is watertight. The big source is `big-attempt1.glb` with a local hub cut/cap, not an untouched Tripo export; provenance and rejected variants remain in the worker folder.

The previously accepted moved-axis body clearances from `../lathe-fix-20261028/` still apply conservatively: current meshes fit inside those larger swept volumes, and `sources.json` confirms unchanged geometry/placement sources and body GLBs. This is an inference from the earlier body test plus a new containment test, not a new full-assembly collision audit. Worker’s narrower body-clearance numbers were read but not repeated.

Eight original native browser PNGs and `browser.json` use the worker’s production-loader fixture with real `Lathe`, `ShaftMotor`, `Gear`, `loadModels` and `model`. Checked lathe at 0/45/90 degrees, grinder rear and portrait phases, and medium standalone at 1180×820 / 390×844. Every GLB loaded, no overflow and no captured browser warnings/errors. The broad portrait fixture leaves whitespace; it is contact evidence, not full-game presentation approval. Four additional original worker top/bottom/assembly frames were visually inspected.

## Integration contract

The GLBs already have final scale and centred pivot `(0,0,0)`, axis +Y, plane XZ. Logical radii remain .4/.6/1, shaft axis `(-2.45,.51,-.45)`, motor separation 1.4. Call `model(name,{})` and remove **only** its added scene offset via `holder.children[0].position.set(0,0,0)`. Preserve nested quantization transforms, code plate/axle/picking and speed ratios. Do not fit by width/depth/height or normalize the wheel bottom to the floor. Existing 6/8/14 teeth are cosmetic; these checks make no physical meshing or tooth-phase promise.

Tripo cost is **125 included credits, 4475→4350**, from the worker’s ledger/evidence. Main placed no orders. This acceptance does not cover arbitrary map neighbours, terminals, wrong-size gears, live snap/picking, physical iPad, Safari/PWA, or performance.

Run the independent audit from repository root (writes only the specified report):

```sh
node assets-src/design-pass/kit/factory/readability-night/gears/replacement-review-20261028/audit-delivery.mjs /tmp/gear-delivery-audit.json
```

See `review.json` for validation and next step. Main changed only this acceptance folder; no runtime, public GLB or kit changes.
