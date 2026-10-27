# factory-loading-ramp — READY

`public/models/factory-loading-ramp.glb`: 71,256 bytes, 3490 triangles; 1 mesh nodes, one OPAQUE material, 512×512 WebP and Meshopt. No skin or animation. SHA256 `b8c6f94a5a114ec92d6314ab368a3b0f3c623ad641fb073b08f0a15f8b4e4ab7`.

Actual XYZ **2.215381 × 1.058113 × 3.800000**. Scale: uniform contain in [3.6, 1.2, 3.8]. Front +Z, centre XZ=0, base Y=0 within 0.0001 quantization tolerance. Preserve these actual proportions/footprint; preliminary target width/depth are not independent scale factors.

Solid wedge with broad sloped deck, upper landing and two side curbs. Low entry faces +Z and high landing -Z.

Single static mesh, decorative ramp. Sampled deck profile is in deck.json; no physical vehicle traversal or collider behavior is certified.

Local processing: bake source transform, rotationY=0, uniform scale/centering; bottom contact band 0.001 flattened to Y=0. Source was already below 4000 triangles, so simplification was not applied. Roughness 0.72, metallic 0, texture resize/compression and Meshopt position16 applied. No ground plate or added support geometry.

Native browser QA: 1024×768 views 0/3/6/7 and 390×844 view0 reviewed; no overflow or browser errors/warnings. Exact screenshot dimensions and public-model byte/triangle checks are in `qa.json`; source order/reference hashes, contact and transformed-node bounds are retained. GLB validator: zero errors/warnings. Repository 17 test files / 88 tests and TypeScript passed on 2026-10-27. In-game placement and physical iPad performance remain integration work.

Tripo Studio H3.1 task `b405ee6d-5d14-4ec7-ad13-72b8a0255957`; one attempt, 25 included credits, balance 4625→4600. Original built-in image_gen reference unchanged; prompt, reference hash, Studio settings and completion screenshots saved. Raw source is locally retained (git-ignored) under `assets-src/raw/factory-props-2026-10-27/`; exact raw hash in `report.json`.
