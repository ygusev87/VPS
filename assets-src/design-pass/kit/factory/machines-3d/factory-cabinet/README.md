# factory-cabinet — factory GLB

One Tripo H3.1 order, 25 included credits. Source/processing hashes and budgets: model-report.json. 90648 bytes, 3434 triangles, one material, 512 WebP/Meshopt.

Build from repo root: `node assets-src/design-pass/kit/factory/machines-3d/build-primary.mjs factory-cabinet`. Geometry validation: `node assets-src/design-pass/kit/factory/machines-3d/validate-primary.mjs`. GLTF validator: zero errors/warnings; EXT_meshopt decoder independently verified by NodeIO and real game loader.

Native UI checks in ../qa-primary.html, actual game Lathe/WireBox, 390×844 and 1024×768, three phases each; no browser errors/warnings. 88 tests and typecheck passed. See ../primary-geometry-review.json for full swept-volume analysis. Does not claim actual iPad/PWA testing.

Fit width2.5, placement(0,0.16,-0.1), size2.5×0.12×2.5. Complete rim below moving tile slabs: maximumY0.280007 vs tilebottom0.3. Door/stripe and functional lamp remain code (Claude fixed after m0448); screenshots include that correction. Only 2×2 layout accepted.
