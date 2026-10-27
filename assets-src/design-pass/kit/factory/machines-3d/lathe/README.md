# lathe — factory GLB

One Tripo H3.1 order, 25 included credits. Source/processing hashes and budgets: model-report.json. 110232 bytes, 3900 triangles, one material, 512 WebP/Meshopt.

Build from repo root: `node assets-src/design-pass/kit/factory/machines-3d/build-primary.mjs lathe`. Geometry validation: `node assets-src/design-pass/kit/factory/machines-3d/validate-primary.mjs`. GLTF validator: zero errors/warnings; EXT_meshopt decoder independently verified by NodeIO and real game loader.

Native UI checks in ../qa-primary.html, actual game Lathe/WireBox, 390×844 and 1024×768, three phases each; no browser errors/warnings. 88 tests and typecheck passed. See ../primary-geometry-review.json for full swept-volume analysis. Does not claim actual iPad/PWA testing.

Fit width 2.6, placement (0.1,0.16,0.2), local size 2.6×1.1×0.95. Expanded tailstock neck ±0.13 in Z above bed; real X-axis bore radius0.2 at modelY0.75,Z0. Conservative workpiece vibration envelope radius0.19 has minimum0.00827 clearance; central ring including vibration has0.09194. Gauge, shaft, wood and ring remain code.
