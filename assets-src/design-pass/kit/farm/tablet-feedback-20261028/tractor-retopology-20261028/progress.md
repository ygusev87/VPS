# Tractor attachment retopology · 2026-10-28

**READY_EXPERIMENTAL_ABOVE_TARGET**. Candidate-only delivery complete, pending local commit recording. No public replacement, external generation, API calls or purchases.

- Candidate: [candidate/tractor.glb](candidate/tractor.glb), SHA-256 e501ac8f4218bc576a66164855493aea48cd9f75a16479368e3d863769d59c9f.
- 13,416 triangles (source 13,556; target 8,000 missed), 249,536 bytes. Exterior tread preserved; reconstructed inner walls are visibly planar/dark. Experimental review candidate only.
- Four closed, consistently oriented wheel-* nodes, local +X; zero open/non-manifold/degenerate wheel edges/faces. Independent body/mesh decode audit passes; body has six inherited original non-manifold edges.
- Continuous full-rotation sweep passes, minimum raw body clearance 0.0068242 (0.025932 at runtime depth3.8). Wheel-pair full-rotation separation also passes. Reconstructed-surface intersections: zero.
- Original atlas/material/root transform/bounds retained; 6,416 original body triangles keep byte-exact POSITION/NORMAL/UV. Body attachment mask removes 22 source faces; central front-left hub repair removes 30 source faces. Complete mask in change-mask.json and diagnostic GLBs.
- Native in-app browser at 1024×768 and 390×844: 0/45/90°, 4 wheel nodes, 6,212 body vertices, body movement 0, no overflow, no console errors/warnings. Fourteen frames/records saved in qa/; includes before/after and masks. No physical-iPad test or production integration.
- glTF Validator: 0 errors; 5 tangent-space warnings inherited in kind from the original and repeated per mesh. Decoded payload independently validated.
- npm test: 17 files / 88 tests PASS. npm run typecheck: PASS. Self-contained rebuild reproduces exact candidate SHA.
- Public tractor and accepted kitten hashes unchanged. Only this new folder is owned/modified.

See [README.md](README.md), [manifest.json](manifest.json), [review.html](review.html), [audit-report.json](audit-report.json), [sweep-report.json](sweep-report.json), [surface-check.json](surface-check.json), [qa/browser-results.json](qa/browser-results.json).
