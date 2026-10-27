# factory-lockers — READY

`public/models/factory-lockers.glb`: 90,380 bytes, 3027 triangles; 1 mesh nodes, one OPAQUE material, 512×512 WebP and Meshopt. No skin or animation. SHA256 `301300368da5c8777aee51046cf00261789de33579646f5c96abaad39b94b1e8`.

Actual XYZ **1.976928 × 2.000000 × 0.991729**. Scale: uniform height 2. Front +Z, centre XZ=0, base Y=0 within 0.0001 quantization tolerance. Preserve these actual proportions/footprint; preliminary target width/depth are not independent scale factors.

Three colored closed doors on four grounded feet. The generated rear repeats the doors; it is not a plain back panel. Suitable as a static locker bank, including wall placement.

Single static mesh. No doors may open; no interior or detached handles.

Local processing: bake source transform, rotationY=0, uniform scale/centering; bottom contact band 0.001 flattened to Y=0. Source was already below 4000 triangles, so simplification was not applied. Roughness 0.72, metallic 0, texture resize/compression and Meshopt position16 applied. No ground plate or added support geometry.

Native browser QA: 1024×768 views 0/3/6/7 and 390×844 view0 reviewed; no overflow or browser errors/warnings. Exact screenshot dimensions and public-model byte/triangle checks are in `qa.json`; source order/reference hashes, contact and transformed-node bounds are retained. GLB validator: zero errors/warnings. Repository 17 test files / 88 tests and TypeScript passed on 2026-10-27. In-game placement and physical iPad performance remain integration work.

Tripo Studio H3.1 task `4eb2b5da-d274-49ca-b152-25eab0554b97`; one attempt, 25 included credits, balance 4700→4675. Original built-in image_gen reference unchanged; prompt, reference hash, Studio settings and completion screenshots saved. Raw source is locally retained (git-ignored) under `assets-src/raw/factory-props-2026-10-27/`; exact raw hash in `report.json`.
