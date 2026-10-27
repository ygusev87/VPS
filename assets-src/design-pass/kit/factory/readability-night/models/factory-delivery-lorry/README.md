# Грузовик — factory-delivery-lorry

READY, 2026-10-27. File: `public/models/factory-delivery-lorry.glb`.

- 94776 bytes; 3508 triangles. Actual XYZ: 2.044903 × 2.048371 × 5.000000.
- Front+Z, baseY≈0, centreXZ0. Uniform scale only, source proportions preserved.
- Nodes: `body + four wheel nodes`. One OPAQUE material and512×512WebP atlas in the file; Meshopt. No skin or animation clips.
- SHA256: `5c4ee9484b819cd3b5671c3d835cff7eaff66721122d7334b9589a937b164ab6`.
- Raw: `assets-src/raw/factory-interactive-2026-10-27/factory-delivery-lorry.glb`, SHA256 `784800b33d92cd338e25a337b20134ff9588777a9d0e67c9c3ecec99d4a58570`. Original kept locally in ignored raw folder.
- Imagegen reference: `refs/factory-delivery-lorry.png`, SHA256 `7cc1c3514e46cf80bcca28f2d81fe60da5e39724e3b49702f93c57c51bc83a1f`; exact prompt and generation provenance in prompt.json/reference.json.
- Tripo H3.1 task `92ee28a5-61f3-4b3a-97b5-d712cde9b91b`; one25credit order, 4575→4550. No paid API or purchases. order.json/studio contain settings and completion evidence.
- Native QA1180×820 and390×844 uses actual `src/parts/assets.ts` loader. Front, rear, bottom and oblique views inspected; no overflow. See qa.json and qa/*.jpg.
- glTF validation:0errors/0warnings; extension support info is covered by real Meshopt loader QA. npm test17files/88tests and npm run typecheck passed.

## Wheel integration

The original tyres were genuinely clipped and separated from the source mesh, with paired caps; no substitute wheel primitives. Five nodes: `body`, `wheel-front-left`, `wheel-front-right`, `wheel-rear-left`, `wheel-rear-right`. Rotate each wheel around localX. Preserve node positions; drive/yaw belongs to the parent. Rotate parentY+π/2 to face existing game+X. The production loader clones the material per mesh (5runtime materials,1atlas/file material).

Measured pivots and conservative continuous360° body clearance:

| Node | PivotXYZ | Clearance |
|---|---|---:|
| wheel-front-left | -0.788007, 0.382661, 1.625492 | 0.066007 |
| wheel-rear-left | -0.841223, 0.380757, -1.796930 | 0.018892 |
| wheel-front-right | 0.793157, 0.379994, 1.624042 | 0.069795 |
| wheel-rear-right | 0.841223, 0.385105, -1.784799 | 0.006147 |

All4tyres rest onY0. Caps have complete boundary coverage; each wheel has0nonmanifold edges. The body retains12pre-existing nonmanifold edge incidences from the source; no new cut-boundary defect was introduced. See topology.json/articulation.json. Full-rotation clearance excludes only0.2mm at intended axle seating. The tyreAABB centre defines each axis; the sculpted/painted hub centre differs by up to0.0207units. Polygonal radial variation permits up to0.0094units of floor penetration at intermediate phases; rest contacts and body clearance pass. Constant floor contact at every phase is not claimed.

## Cargo integration

Measured deckY 0.892596495..0.894320883;375samples, variation0.001724388. Free interior X[-.7,.7],Z[-2,.4] verified above deck+.005 through deck+.8;0intersecting triangles. Three .7×.65×.7 probes and actual packageGLBs verified in native viewer.

| X | Z | Package bottomY |
|---:|---:|---:|
| 0 | -1.6 | 0.893197350 |
| 0 | -0.8 | 0.893318972 |
| 0 | 0 | 0.893422794 |

Coordinates are in the unrotated asset space. `cargo.json` is authoritative. Load package at these positions without further scaling. No gameplay integration is included.

Rebuild: build.mjs → articulate.mjs → inspect-cargo.mjs → inspect-motion.mjs → release.mjs → inspect-structure.mjs factory-delivery-lorry. Re-run native QA after any output change. Candidate folder is ignored; only publicGLB is the released articulated file.
