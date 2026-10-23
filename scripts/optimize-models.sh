#!/usr/bin/env bash
# Compress generated part models for the web: meshopt geometry, 1024px WebP
# textures, light simplification. Sources (raw .glb from Higgsfield) live in
# assets-src/models/, results go to public/models/.
#   scripts/optimize-models.sh            # all models
#   scripts/optimize-models.sh battery    # one model
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/models
names=("$@")
if [ ${#names[@]} -eq 0 ]; then
  for f in assets-src/models/*.glb; do names+=("$(basename "$f" .glb)"); done
fi
for n in "${names[@]}"; do
  npx gltf-transform optimize "assets-src/models/$n.glb" "public/models/$n.glb" \
    --compress meshopt --texture-compress webp --texture-size 1024 \
    --simplify-ratio 0.6 --simplify-error 0.0008
done
ls -la public/models
