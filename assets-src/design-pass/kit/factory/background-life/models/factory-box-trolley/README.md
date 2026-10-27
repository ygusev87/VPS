# factory-box-trolley — READY

`public/models/factory-box-trolley.glb`: 84,968 bytes, 3544 triangles; 1 mesh nodes, one OPAQUE material, 512×512 WebP and Meshopt. No skin or animation. SHA256 `a389222462a07917bb2d99fb726215e9a323938575bc5674a309f5b3b52213ad`.

Actual XYZ **1.128111 × 1.207801 × 1.600000**. Scale: uniform contain in [1.2, 1.3, 1.6]. Front +Z, centre XZ=0, base Y=0 within 0.0001 quantization tolerance. Preserve these actual proportions/footprint; preliminary target width/depth are not independent scale factors.

Three broad boxes, one rear handle and four separate caster wheels verified from below and by floor contact groups.

Single static mesh; boxes and wheels are not separate animated parts. Handle faces -Z; open end +Z. Preserve actual uniform-contain size rather than inflating height to 1.3.

Local processing: bake source transform, rotationY=1.5707963267948966, uniform scale/centering; bottom contact band 0.002 flattened to Y=0. Source was already below 4000 triangles, so simplification was not applied. Roughness 0.72, metallic 0, texture resize/compression and Meshopt position16 applied. No ground plate or added support geometry.

Native browser QA: 1024×768 views 0/3/6/7 and 390×844 view0 reviewed; no overflow or browser errors/warnings. Exact screenshot dimensions and public-model byte/triangle checks are in `qa.json`; source order/reference hashes, contact and transformed-node bounds are retained. GLB validator: zero errors/warnings. Repository 17 test files / 88 tests and TypeScript passed on 2026-10-27. In-game placement and physical iPad performance remain integration work.

Tripo Studio H3.1 task `1aba2262-5faf-4a30-8f35-4f8a856f2984`; one attempt, 25 included credits, balance 4650→4625. Original built-in image_gen reference unchanged; prompt, reference hash, Studio settings and completion screenshots saved. Raw source is locally retained (git-ignored) under `assets-src/raw/factory-props-2026-10-27/`; exact raw hash in `report.json`.
