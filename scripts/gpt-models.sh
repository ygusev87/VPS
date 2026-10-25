#!/usr/bin/env bash
# Part bodies from the second set of generated models (Higgsfield,
# tripo_h3_1_image_to_3d, all made on a cream plate with painted sockets).
# Raw .glb files go to assets-src/raw/<job>.glb (first 8 characters of the job
# id, see assets-src/README.md); this cuts their plates off into
# assets-src/models/<name>.glb, then run scripts/optimize-models.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
strip() { node scripts/strip-plate.mjs "assets-src/raw/$2.glb" "assets-src/models/$1.glb" "${@:3}"; }
copy() { cp "assets-src/raw/$2.glb" "assets-src/models/$1.glb"; }

strip battery 19f75ed3
strip socket 1b1cf572 --top 0.45 --keep 0.4
strip led da10ad6f --keep 0.3
strip buzzer 3a67a048 --keep 0.3
strip button 1eba68cd --keep 0.3
strip tuba 0e236a5c
strip firetruck 690ec433 --keep 0.3
strip drum defb7ac9
strip carousel 1998854f --cut 0.16
strip mirror fcabed71
strip heater 7f08ce9e --keep 0.3
strip musicbox 12d1f6b1 --box 0.42,0.8,0.25,0.7,0.42,1
strip helicopter 6f0237a8 --top 0.85
strip tester 1ed9b3c5 --keep 0.3 --box 0.8,1,0.35,0.8,0,0.35
strip magnet 35621c45 --keep 0.3
strip bell d24e644a --cut 0.2
strip cannon 177531bd
strip target d0f78dd9 --keep 0.3
strip trafficlight 66dd7083 --keep 0.3
strip laser 9f300870 --keep 0.3 --box 0,0.12,0.25,0.75,0,0.5
strip solar c488cdbe
strip pump a07ffdd3
strip pole 0e52db62 --keep 0.3
copy fox c2d71a9a
copy rabbit 8f04d2f7
copy dog 0d5d3d02
copy doghouse 5bc78ef9
# The flour sack came out at 1.5 million triangles.
npx gltf-transform simplify assets-src/raw/c3922a1c.glb assets-src/models/sack.glb --ratio 0.02 --error 0.01
