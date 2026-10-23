#!/usr/bin/env bash
# Build for hosts that serve only scripts/styles/images (the claude.ai preview):
# models and voice clips ship as JS modules with base64 data (no meshopt),
# see src/parts/assets.ts and src/voice.ts.
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
# Voice clips the same way (see fetchClip in src/voice.ts).
rm -rf "$out/voice"
mkdir -p "$out/voice"
for f in public/voice/*.mp3; do
  printf 'export default "%s";\n' "$(base64 -w0 "$f")" > "$out/voice/$(basename "$f" .mp3).js"
done
ls -la "$out/models"
