# Factory background life — five models

2026-10-27. Working on exact worker-batch-01 card: forklift and four workers. City six accepted; unchanged.

Project active revision1076. Codex remaining35%, reserve15%, warn25%. Standing owner authorization covers project reference uploads and included-credit generations. Batch started5050; final live balance4925. No purchases/API/topups.

Forklift motion is provisional until segmentation and swept-volume clearance are measured. Readiness delivered individually here.

## READY — factory-worker-foreman

`public/models/factory-worker-foreman.glb`: 78,952 bytes, 3867 triangles; actual XYZ 0.920147 × 1.650000 × 0.788920; SHA `e846cd0aacb5c8b4b7888d66eb153c908ac6dcb33b7ba7c56f4c4e20627bfffd`. One OPAQUE material, 512 WebP, Meshopt. Uniform height scale; front +Z, centre XZ=0, base Y=0. Two sole contacts verified, floor snap 0.5mm. Native 390/1024 and four views PASS; 0 browser errors/overflow; 88 tests and TypeScript PASS. Ready for integration; raw/prompt/source SHA and full QA in own folder.

## READY — factory-worker-technician

`public/models/factory-worker-technician.glb`: 84,836 bytes, 3771 triangles; actual XYZ 0.866189 × 1.600000 × 0.715940; SHA `48a73b88d2a99a8e641d9a029b8f5ce7123c29b3b742fcea4cfd3b3647adf8d5`. One OPAQUE material, 512 WebP, Meshopt. Uniform height scale; front +Z, centre XZ=0, base Y=0. Two sole contacts verified, floor snap 0.5mm. Native 390/1024 and four views PASS; 0 browser errors/overflow; 88 tests and TypeScript PASS. Ready for integration; raw/prompt/source SHA and full QA in own folder.

## READY — factory-worker-loader

`public/models/factory-worker-loader.glb`: 85,512 bytes, 3712 triangles; actual XYZ 1.141308 × 1.650000 × 0.730105; SHA `c81f83d890c8616e8c28e590e229dab44efb0d23ec185130d6cea2ebd4c20172`. One OPAQUE material, 512 WebP, Meshopt. Uniform height scale; front +Z, centre XZ=0, base Y=0. Two sole contacts verified, floor snap 5mm. Native 390/1024 and four views PASS; 0 browser errors/overflow; 88 tests and TypeScript PASS. Ready for integration; raw/prompt/source SHA and full QA in own folder.

## READY — factory-worker-inspector

`public/models/factory-worker-inspector.glb`: 82,692 bytes, 3941 triangles; actual XYZ 0.645381 × 1.600000 × 0.629023; SHA `551ba0432e7a0722d01d8f96191254da01b6fb1fcf2db294dc55c2414edc4102`. One OPAQUE material, 512 WebP, Meshopt. Uniform height scale; front +Z, centre XZ=0, base Y=0. Two sole contacts verified, floor snap 2mm. Native 390/1024 and four views PASS; 0 browser errors/overflow; 88 tests and TypeScript PASS. Ready for integration; raw/prompt/source SHA and full QA in own folder.

## BLOCKED ARTICULATION — factory-forklift

Preserved own-folder `factory-forklift/static-candidate.glb`,100,228 bytes,3590tri,1 OPAQUE/512WebP/Meshopt; SHA `eb5b5415248c1d86ce1160da4d6b4fd064a393dc7682936abc36bafcbae802bc`. ActualXYZ1.605267×2.199951×3.791795, uniformheight2.2,+Z,centreXZ0;4 tyre contacts within0.0001 after7mm sole band. Native390/1024 through actual game loader passed,0 errors/overflow; static validator0errors/warnings. Runtime public GLB not released.

Raw closed surface is one component. Free detailed segmentation47 parts separated both fork blades, but mast+carriage remained part1/321tri. Local152tri split creates13/15-vertex non-planar boundaries; first cap misses a boundary edge (10tri vs11required), so no articulated GLB emitted. Source mast/diagonal webbing preserved. No forks group/pivot/accepted travel; swept collision and rail-bearing clearance not certified. Exact sourceSHA, segment/bounds/tip measurements, failed boundary and native proof in own folder. Card fallback applies: integrator review of remesh/external assembly needed before animation; do not move whole mast.

## Batch result and spend

Four workers READY individually; forklift static candidate retained with concrete articulation blocker. No additional orders after the five assigned models. Included-credit spend125 total: forklift25, foreman25, technician25, loader25, inspector25; segmentation trial0. Balance5050→4925. No purchases/topups/API.

Commits: foreman+technician b062aa3; loader+inspector022f972. Common manifest/kit/runtime and city assets untouched by this chat. Integration remains main/Claude. Standing authorization for other project references and included-credit generation remains in force; no repeated permission question.

Final validation:17 test files/88 tests PASS; TypeScript PASS (2026-10-27). Static forklift uses real game loader, both native sizes verified. No articulated motion claim.
