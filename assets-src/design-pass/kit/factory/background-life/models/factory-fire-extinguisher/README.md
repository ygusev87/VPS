# factory-fire-extinguisher — READY

`public/models/factory-fire-extinguisher.glb`: 73,140 bytes, 3862 triangles; 1 mesh nodes, one OPAQUE material, 512×512 WebP and Meshopt. No skin or animation. SHA256 `858fe9596ba115ccdee115802a0bb10b5325be1a816c6a24fbb639f0f8109a90`.

Actual XYZ **0.660967 × 1.100000 × 0.399991**. Scale: uniform height 1.1. Front +Z, centre XZ=0, base Y=0 within 0.0001 quantization tolerance. Preserve these actual proportions/footprint; preliminary target width/depth are not independent scale factors.

Continuous canister, thick attached hose, pressure gauge and broad handle. One connected base ring contacts the floor.

Single static mesh; no moving handle or removable hose. The wider footprint includes the hose and handle.

Local processing: bake source transform, rotationY=0, uniform scale/centering; bottom contact band 0.001 flattened to Y=0. Source was already below 4000 triangles, so simplification was not applied. Roughness 0.72, metallic 0, texture resize/compression and Meshopt position16 applied. No ground plate or added support geometry.

Native browser QA: 1024×768 views 0/3/6/7 and 390×844 view0 reviewed; no overflow or browser errors/warnings. Exact screenshot dimensions and public-model byte/triangle checks are in `qa.json`; source order/reference hashes, contact and transformed-node bounds are retained. GLB validator: zero errors/warnings. Repository 17 test files / 88 tests and TypeScript passed on 2026-10-27. In-game placement and physical iPad performance remain integration work.

Tripo Studio H3.1 task `745311f8-7a73-44ff-827c-96f46eddc479`; one attempt, 25 included credits, balance 4675→4650. Original built-in image_gen reference unchanged; prompt, reference hash, Studio settings and completion screenshots saved. Raw source is locally retained (git-ignored) under `assets-src/raw/factory-props-2026-10-27/`; exact raw hash in `report.json`.
