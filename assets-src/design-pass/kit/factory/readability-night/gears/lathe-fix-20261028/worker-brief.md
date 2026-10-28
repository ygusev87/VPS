# Cosmetic factory gears — bounded next model card

## Scope

Exactly three new cosmetic gear assets: small, medium, big. Main has accepted the moved lathe/grinder shaft in review.json after Claude 02be7ce / m0558. Previous body-contact ordering gate is cleared for this card. Do not change src, kit.json, shared coordination read/ack, or previously accepted model batches. Do not switch branches or touch other agents' files.

Own source/output folder: assets-src/design-pass/kit/factory/machines-3d/gears-cosmetic/ (create if absent). Own matching model files only: public/models/factory-gear-small.glb, factory-gear-medium.glb, factory-gear-big.glb. These are new names; integration remains Claude's task. Save raw downloads, prompts, input references, measured quotes and credit ledger in your folder. Commit only explicit owned paths locally; no git push.

## Exact geometry contract

Use items[].replacementLimits from ../replacement-contract.json (relative to this brief, the historical contract is one directory above; audit.json repeats its limits with the corrected runtime axis). Logical radii are 0.4 / 0.6 / 1.0. Axis +Y; flat XZ; centre pivot (0,0,0). This is an explicit exception to floor-Y=0: geometry extends below the pivot. Do not normalize the lower surface to Y=0.

Uniformly fit decoded maximum radial norm, not phase-zero AABB width. Preserve glTF node quantization transforms. The allowed shape is the UNION of these cylinders: rim radius r, Y -0.069..0.069; upper spoke/detail radius 0.7r, Y 0.069..0.084; hub radius 0.3r-0.001, Y -0.099..0.099. A triangle crossing Y boundaries must be clipped per slab for containment; checking only vertex containment or a box is insufficient. Nothing may protrude beyond the union under any Y rotation.

Each asset is one static wheel, no stand, base, shaft, bearing, skeleton, animation or extra props. The code retains plates, pegs, pickables, placement, gearAt height .51, logical radius and ratios. Avoid baking shaft shadows or unsupported highlights into transparent areas. An opaque texture is required; holes are geometry, not alpha.

Target clear rounded/bevelled teeth and readable spoke pattern. Small brass #d9ad4c, medium steel #8d97a3, big copper #c4553f, consistent with the accepted painted workshop models. Current procedural counts are 6/8/14 teeth; preserve that visual intent where practical. This is cosmetic conditional meshing approved by Claude m0537, not physically phase-locked gearing. Do not promise tooth contact without overlap across rotation.

Budget per GLB: at most 4000 triangles, target at most 150000 bytes, one OPAQUE material, one 512px WebP texture, Meshopt. Keep models centred; no nonuniform squashing to fake the bounds. Existing motor/lathe/grinder public GLBs must remain unchanged.

## Work and validation

You remain the only Tripo Studio operator. Use the owner's existing authorization for necessary project models; check live quote/balance before an order, prefer an appropriate free retry, record actual debit. No purchases, top-ups, subscriptions, paid API, or workaround around new approval rejections. Exactly these three assets; do not expand the batch. Today's 28 October Bangkok exception means no Codex usage-limit checks or reserve pause; it does not change service credit rules.

Prepare isolated reference(s) matching the cylinders rather than uploading a machine assembly screenshot as a gear reference. Follow the existing model pipeline. Preserve a clear provenance distinction between generated raw mesh and any local cleanup/remesh. Stop and report a concrete constraint failure if a wheel cannot fit the contract without losing its required silhouette; no silent relaxation.

Verify decoded bounds, triangle budget, material/texture format, radial/slab containment and shared mesh/node transforms. Use actual game loader in a worker-owned fixture for small/big motor-lathe and big/small motor-grinder pairs at the corrected axis (-2.45, .51, -.45), pair separation 1.4; also inspect medium standalone. Capture readable 1180 and 390 frames and several Y phases. No broad repeat QA of accepted batches. Report limitations honestly; no runtime integration in your source changes.

Deliver the three files, exact measured scale/pivot/bounds, SHA256, processing commands, source provenance, cost ledger and frames. Write progress only in your own folder; notify main on a concrete completion or blocker. Root coordination read/ack remains main-only.
