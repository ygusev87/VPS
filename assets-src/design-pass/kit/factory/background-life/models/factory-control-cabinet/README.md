# factory-control-cabinet — READY

`public/models/factory-control-cabinet.glb`: 70,512 bytes, 3150 triangles; 4 mesh nodes, one OPAQUE material, 512×512 WebP and Meshopt. No skin or animation. SHA256 `78a76cb20e763c830a5b1ea3492bdb4452ff961ac80e7140de0af5b61a58b001`.

Actual XYZ **1.253386 × 2.100000 × 0.986199**. Scale: uniform height 2.1. Front +Z, centre XZ=0, base Y=0 within 0.0001 quantization tolerance. Preserve these actual proportions/footprint; preliminary target width/depth are not independent scale factors.

Four grounded feet and a complete cabinet body. Three raised lens faces are partitioned into lamp-red, lamp-amber, lamp-green; body has 3058 triangles and lenses have 31/33/28. All 3150 source triangles are retained exactly once.

Clone each lamp mesh material before changing emissive; all four nodes share one source material. For example: const lens = scene.getObjectByName("lamp-red"); lens.material = lens.material.clone(); lens.material.emissive.set("#ff240d"); lens.material.emissiveIntensity = 1.5; Clone amber and green materials likewise. Set intensity 0 to turn off. Do not move lamp nodes: boundaries are cut from the connected source surface for lighting only. Cabinet consumes four mesh draw calls; no door or switch animation.

Local processing: bake source transform, rotationY=0, uniform scale/centering; bottom contact band 0.001 flattened to Y=0. Source was already below 4000 triangles, so simplification was not applied. Roughness 0.72, metallic 0, texture resize/compression and Meshopt position16 applied. No ground plate or added support geometry.

Native browser QA: 1024×768 views 0/3/6/7 and 390×844 view0 reviewed; no overflow or browser errors/warnings. Exact screenshot dimensions and public-model byte/triangle checks are in `qa.json`; source order/reference hashes, contact and transformed-node bounds are retained. GLB validator: zero errors/warnings. Repository 17 test files / 88 tests and TypeScript passed on 2026-10-27. In-game placement and physical iPad performance remain integration work.

Tripo Studio H3.1 task `1c24be02-340a-466f-aa19-352e64735975`; one attempt, 25 included credits, balance 4725→4700. Original built-in image_gen reference unchanged; prompt, reference hash, Studio settings and completion screenshots saved. Raw source is locally retained (git-ignored) under `assets-src/raw/factory-props-2026-10-27/`; exact raw hash in `report.json`.
