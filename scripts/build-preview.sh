#!/usr/bin/env bash
# Build for hosts that serve only scripts/styles/images (the claude.ai preview):
# models ship as JS modules with base64 GLB (no meshopt), see src/parts/assets.ts.
#   scripts/build-preview.sh [outdir]   (default dist-preview)
set -euo pipefail
cd "$(dirname "$0")/.."
out="${1:-dist-preview}"
VITE_MODELS_AS_JS=1 npx vite build --outDir "$out" --emptyOutDir
rm -rf "$out/models"
mkdir -p "$out/models"
tmp="$(mktemp -d)"
for f in assets-src/models/*.glb; do
  n="$(basename "$f" .glb)"
  npx gltf-transform optimize "$f" "$tmp/$n.glb" --compress false \
    --texture-compress webp --texture-size 1024 --simplify-ratio 0.6 --simplify-error 0.0008 >/dev/null
  printf 'export default "%s";\n' "$(base64 -w0 "$tmp/$n.glb")" > "$out/models/$n.js"
done
rm -rf "$tmp"
ls -la "$out/models"
