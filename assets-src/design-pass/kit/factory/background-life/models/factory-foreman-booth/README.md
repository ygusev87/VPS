# factory-foreman-booth — READY

`public/models/factory-foreman-booth.glb`: 95,272 bytes, 3030 triangles; 1 mesh nodes, one OPAQUE material, 512×512 WebP and Meshopt. No skin or animation. SHA256 `8a167c0c8a471e7d2b7688cc73f8510799c005d5127728d3904b491ff30ffe5c`.

Actual XYZ **3.850181 × 2.599962 × 2.585862**. Scale: uniform height 2.6. Front +Z, centre XZ=0, base Y=0 within 0.0001 quantization tolerance. Preserve these actual proportions/footprint; preliminary target width/depth are not independent scale factors.

Closed booth with integral roof/base, opaque pale blue windows and two closed coral doors on opposing facades. The full footprint is3.85×2.586; height2.6 keeps width below4 while preserving proportions. Both side edges of the base contact the floor.

Single static mesh, no interior, transparent glass, opening door or detachable roof.

Local processing: bake source transform, rotationY=0, uniform scale/centering; bottom contact band 0.001 flattened to Y=0. Source was already below 4000 triangles, so simplification was not applied. Roughness 0.72, metallic 0, texture resize/compression and Meshopt position16 applied. No ground plate or added support geometry.

Native browser QA: 1024×768 views 0/3/6/7 and 390×844 view0 reviewed; no overflow or browser errors/warnings. Exact screenshot dimensions and public-model byte/triangle checks are in `qa.json`; source order/reference hashes, contact and transformed-node bounds are retained. GLB validator: zero errors/warnings. Repository 17 test files / 88 tests and TypeScript passed on 2026-10-27. In-game placement and physical iPad performance remain integration work.

Tripo Studio H3.1 task `63e3b9d2-5d9a-4996-b259-29c7fcf4a667`; one attempt, 25 included credits, balance 4600→4575. Original built-in image_gen reference unchanged; prompt, reference hash, Studio settings and completion screenshots saved. Raw source is locally retained (git-ignored) under `assets-src/raw/factory-props-2026-10-27/`; exact raw hash in `report.json`.
