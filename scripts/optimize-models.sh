#!/usr/bin/env bash
# Mobile GLB profile: color 512px, normal/ORM 256px; meshopt geometry.
# Vertex-derived pivots, rigs, and sensitive reflective meshes stay unchanged.
#   scripts/optimize-models.sh battery
#   MODEL_SOURCE_DIR=assets-src/raw/mobile-models-2026-10-25 \
#     MODEL_REPORT_PATH=/tmp/models-report.json scripts/optimize-models.sh
# Never use public/models itself as the source: preserve a separate input copy.
set -euo pipefail
cd "$(dirname "$0")/.."
args=(--input "${MODEL_SOURCE_DIR:-assets-src/models}" --output public/models)
if [[ -n "${MODEL_REPORT_PATH:-}" ]]; then args+=(--report "$MODEL_REPORT_PATH"); fi
node scripts/optimize-mobile-models.mjs "${args[@]}" "$@"
