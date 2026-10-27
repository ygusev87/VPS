# Factory hoist — repaired static shaft

One paid Tripo H3.1/4000tri/2K/delight order (25 included credits), then all three free retries. All four generated meshes were unusable; see studio-rejected-1..4.png and preserved raw first/final exports. The delivered geometry is a local manual reconstruction, not an accepted Tripo mesh. It follows the prepared static shaft reference and exact cabin clearance contract. The original generated atlas is reused through three selected UV patches without repainting, then resized/compressed to512WebP.

`public/models/hoist.glb`:150148B,2952tri,one material,Meshopt. SHA256931611689ef6bea702a7849c0a02c25c11321d6a3db3d4d86deb953ffce64074. Dimensions1.3×3×1.3,baseY0,centerXZ0. Four bevelled yellow posts, sparse genuine rear/side grids and cross braces, open front, teal feet. No cabin/rope/pulley/passenger/global plate baked into this file.

Build from repository root: `node assets-src/design-pass/kit/factory/machines-3d/hoist/build.mjs`. Validate full movement: `node assets-src/design-pass/kit/factory/machines-3d/hoist/validate-geometry.mjs`. Model report contains source/output hashes, texture patch provenance and validation. Zero glTF errors/warnings (meshopt informational limitation, separately decoded with NodeIO and actual game loader).

## Integration

Factory only: fitheight3,placement(0,.16,-.25). Preserve code cabin, pulley, rope, floor and floor lamps; replace only the static tower/posts/oldroof. Do not replace farm Lift or alter its driver setter/cabinFloor behavior. Factory pulley centreY2.96 and ropeTopY2.88 mount under the central crossbeam. The previous common Lift pulley/ropeTop are too low for the top cabin position; change only factory configuration. Cabin retains bottomY.24,topY1.91,height.72,Z−.23.

## Verification

Exact triangle-AABB full cabin sweep and proposed rope envelope: zero intersections. Seven native frames:390×844 and1024×768 at bottom/middle/top, plus rear1024. qa.html uses actual Lift cabin/rope/pulley in an isolated scene, replacing static geometry and proposed factory-only pulley/rope positions; this is asset-fit QA, not a claim that factory integration or physical iPad has been tested. No browser errors/warnings. 88tests/typecheck passed before commit.
