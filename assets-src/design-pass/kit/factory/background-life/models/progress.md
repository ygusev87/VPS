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

## ACTIVE — next factory batch03 — owner directly requested continuation

2026-10-27: existing sole model operator takes six queued props: control-cabinet/lockers/fire-extinguisher/box-trolley/loading-ramp/foreman-booth. Preparing refs in each own models/<id>/refs; common main manifest/layout/ref folders/src/kit untouched. Detailed contract in models/factory-control-cabinet/batch-03.json. New Studio orders not yet placed. Do not duplicate these six orders. Prior forklift/workers and citybatch02 stay closed.

## READY — factory-control-cabinet

`public/models/factory-control-cabinet.glb`: 70,512 bytes, 3150 triangles; actual XYZ 1.253386 × 2.100000 × 0.986199; SHA `78a76cb20e763c830a5b1ea3492bdb4452ff961ac80e7140de0af5b61a58b001`. 4 mesh nodes, one OPAQUE material, 512 WebP, Meshopt, no skin/animation. Four grounded feet and a complete cabinet body. Three raised lens faces are partitioned into lamp-red, lamp-amber, lamp-green; body has 3058 triangles and lenses have 31/33/28. All 3150 source triangles are retained exactly once. Clone each lamp mesh material before changing emissive; all four nodes share one source material. For example: const lens = scene.getObjectByName("lamp-red"); lens.material = lens.material.clone(); lens.material.emissive.set("#ff240d"); lens.material.emissiveIntensity = 1.5; Clone amber and green materials likewise. Set intensity 0 to turn off. Do not move lamp nodes: boundaries are cut from the connected source surface for lighting only. Cabinet consumes four mesh draw calls; no door or switch animation. Native 390/1024 and four views PASS; validator and browser errors/warnings zero; 88 tests / TypeScript PASS. Full evidence and placement contract in own README.

## READY — factory-lockers

`public/models/factory-lockers.glb`: 90,380 bytes, 3027 triangles; actual XYZ 1.976928 × 2.000000 × 0.991729; SHA `301300368da5c8777aee51046cf00261789de33579646f5c96abaad39b94b1e8`. 1 mesh nodes, one OPAQUE material, 512 WebP, Meshopt, no skin/animation. Three colored closed doors on four grounded feet. The generated rear repeats the doors; it is not a plain back panel. Suitable as a static locker bank, including wall placement. Single static mesh. No doors may open; no interior or detached handles. Native 390/1024 and four views PASS; validator and browser errors/warnings zero; 88 tests / TypeScript PASS. Full evidence and placement contract in own README.

## READY — factory-fire-extinguisher

`public/models/factory-fire-extinguisher.glb`: 73,140 bytes, 3862 triangles; actual XYZ 0.660967 × 1.100000 × 0.399991; SHA `858fe9596ba115ccdee115802a0bb10b5325be1a816c6a24fbb639f0f8109a90`. 1 mesh nodes, one OPAQUE material, 512 WebP, Meshopt, no skin/animation. Continuous canister, thick attached hose, pressure gauge and broad handle. One connected base ring contacts the floor. Single static mesh; no moving handle or removable hose. The wider footprint includes the hose and handle. Native 390/1024 and four views PASS; validator and browser errors/warnings zero; 88 tests / TypeScript PASS. Full evidence and placement contract in own README.

## READY — factory-box-trolley

`public/models/factory-box-trolley.glb`: 84,968 bytes, 3544 triangles; actual XYZ 1.128111 × 1.207801 × 1.600000; SHA `a389222462a07917bb2d99fb726215e9a323938575bc5674a309f5b3b52213ad`. 1 mesh nodes, one OPAQUE material, 512 WebP, Meshopt, no skin/animation. Three broad boxes, one rear handle and four separate caster wheels verified from below and by floor contact groups. Single static mesh; boxes and wheels are not separate animated parts. Handle faces -Z; open end +Z. Preserve actual uniform-contain size rather than inflating height to 1.3. Native 390/1024 and four views PASS; validator and browser errors/warnings zero; 88 tests / TypeScript PASS. Full evidence and placement contract in own README.

## READY — factory-loading-ramp

`public/models/factory-loading-ramp.glb`: 71,256 bytes, 3490 triangles; actual XYZ 2.215381 × 1.058113 × 3.800000; SHA `b8c6f94a5a114ec92d6314ab368a3b0f3c623ad641fb073b08f0a15f8b4e4ab7`. 1 mesh nodes, one OPAQUE material, 512 WebP, Meshopt, no skin/animation. Solid wedge with broad sloped deck, upper landing and two side curbs. Low entry faces +Z and high landing -Z. Single static mesh, decorative ramp. Sampled deck profile is in deck.json; no physical vehicle traversal or collider behavior is certified. Native 390/1024 and four views PASS; validator and browser errors/warnings zero; 88 tests / TypeScript PASS. Full evidence and placement contract in own README.

## READY — factory-foreman-booth

`public/models/factory-foreman-booth.glb`: 95,272 bytes, 3030 triangles; actual XYZ 3.850181 × 2.599962 × 2.585862; SHA `8a167c0c8a471e7d2b7688cc73f8510799c005d5127728d3904b491ff30ffe5c`. 1 mesh nodes, one OPAQUE material, 512 WebP, Meshopt, no skin/animation. Closed booth with integral roof/base, opaque pale blue windows and two closed coral doors on opposing facades. The full footprint is3.85×2.586; height2.6 keeps width below4 while preserving proportions. Both side edges of the base contact the floor. Single static mesh, no interior, transparent glass, opening door or detachable roof. Native 390/1024 and four views PASS; validator and browser errors/warnings zero; 88 tests / TypeScript PASS. Full evidence and placement contract in own README.

## Factory props batch03 complete — six READY

All six public GLBs are ready for main/integrator acceptance. Total **485,528 bytes / 20,103 triangles**. Cabinet has four nodes for independent lens lighting; other five have one static mesh each. One OPAQUE 512 WebP material per file, Meshopt, no rigs/animations. Exact footprints and SHA are in each report and updated `factory-control-cabinet/batch-03.json`.

Cabinet/lockers/extinguisher committed as **0222d60**. Trolley/ramp/booth complete with source, native screenshots, bounds and reports. Cabinet requires material clone per lamp before setting emissive; do not displace lens nodes. Lockers repeat the three doors on the rear; booth has two closed opposing doors. Booth actual size3.850181×2.599962×2.585862, uniformly reduced from preliminary height2.8; do not force it into targetXYZ by independent axis scaling. Trolley4 wheel contacts within0.0001; ramp180 deck rays pass, 1.4-wide central sampled strip, no physics traversal claim.

All30 native frame/data checks pass (four1024×768 views plus390×844 per model),0 errors/warnings/overflow. Validator0 errors/warnings for everyGLB. Latest repository17 files/88 tests and TypeScript PASS at19:57 Bangkok,2026-10-27. Common manifest/layout/kit/src untouched. Main owns placement and runtime acceptance.

Included credits **150 total:4725→4575**, six orders at25, one attempt each. No paid add-ons, API, purchases or topups. All original reference PNGs/prompt hashes retained unchanged. Prior forklift/workers/citybatch02 stay closed. No additional generation orders queued. Remaining Codex26% on7-day window at19:57; reserve15%, warning25%.
