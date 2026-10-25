# Material texture memory — 25 October 2026

Reviewed 25 small farm assets side by side at 200 px in the game camera. Remove normal maps from all 25. Preserve ORM and the original highlights on 17 animals/painted buildings; remove both maps only from eight already matte assets: barn, coop, stable, sheep, nest, sack and the two flowerbeds. No mesh simplification or atlas resizing in this pass.

- These 25 files: 3,432,208 → 3,285,352 bytes; 75 → 42 textures.
- Texture estimate: 50 → 39 MiB (RGBA8 plus full mip chain). This is an asset inventory, not measured device VRAM or an iPad FPS result.
- All 68 GLBs before this pass: 130 MiB. This pass saves 11 MiB, leaving 119 MiB. Not every GLB is rendered simultaneously.
- SHA-256 signatures verify decoded geometry/accessors, node transforms, joints and animation data remain unchanged, including fox-rig.
- glTF Validator: zero errors. fox-rig retains its pre-existing non-root skinned-node warning; the skin and hierarchy are unchanged.
- Comparison evidence: /tmp/gameios-visual-audit-2026-10-25/material-final-{1,2,3}.png.
- Glossy animal materials were deliberately retained after the fully matte candidate looked flatter. Metal/solar/electrical models are unchanged.

Reproduce from the ignored originals (do not use the already processed public files):

```sh
node scripts/reduce-material-maps.mjs assets-src/raw/materials-before-2026-10-25 /tmp/material-output assets-src/farm-v2/material-memory/models.json /tmp/material-report.json
```

The script rejects an in-place output directory and stops if geometry or animation data changes.

Validation: 17 tests pass; TypeScript check passes. IAB game at q=2: tablet and phone views, night-to-day, and explicit WEBGL_lose_context/restore all rendered correctly. This does not substitute for testing Safari on the physical iPad.
