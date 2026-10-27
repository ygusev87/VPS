# Мишка — factory-product-bear

READY, 2026-10-27. File: `public/models/factory-product-bear.glb`.

- 52348 bytes; 3784 triangles. Actual XYZ: 0.594539 × 0.750000 × 0.639218.
- Front+Z, baseY≈0, centreXZ0. Uniform scale only, source proportions preserved.
- Nodes: `product`. One OPAQUE material and512×512WebP atlas in the file; Meshopt. No skin or animation clips.
- SHA256: `e2adf0de223205d4036a00f55f95f4ab2a8377bd7dc8404c467edc7c0b000075`.
- Raw: `assets-src/raw/factory-interactive-2026-10-27/factory-product-bear.glb`, SHA256 `014fe46eae53ad8bbe4985a234bc70abf45258bfbba4da907d402060b557ac0a`. Original kept locally in ignored raw folder.
- Imagegen reference: `refs/factory-product-bear.png`, SHA256 `921dc8702d7e7bc58d601518417eb05b7c4117d6a5e5b2bd998b1074c5916817`; exact prompt and generation provenance in prompt.json/reference.json.
- Tripo H3.1 task `a585ab95-f932-4c81-a9d3-473e95009d7b`; one25credit order, 4550→4525. No paid API or purchases. order.json/studio contain settings and completion evidence.
- Native QA1180×820 and390×844 uses actual `src/parts/assets.ts` loader. Front, rear, bottom and oblique views inspected; no overflow. See qa.json and qa/*.jpg.
- glTF validation:0errors/0warnings; extension support info is covered by real Meshopt loader QA. npm test17files/88tests and npm run typecheck passed.

Uniform height.75; actual width/depth exceed the preliminary .55/.5 envelope. Proportions were preserved; use actual bounds for layout. One rigid `product`node; whole object travels, no rig. Ground group and underside measured in contacts.json.

Runtime material colour multiplication tested with26b7b0,ef745d,e9bd4e. Warm ivory/wood atlas is not pure white: teal becomes greener and dark facial texels also receive tint. Face stays visible; changing only the body independently needs a mask/atlas edit. No printed star; integrator owns later station markings. Superseded bunny reference is archived under refs/superseded-bunny; no bunny Studio order or charge occurred.

Rebuild: node build.mjs, verify report.pass, copy candidateGLB to public/models, inspect structure and contacts, re-run native QA.
