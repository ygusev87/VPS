# Factory machine models — delivery

On 27 October 2026 the owner approved the required existing Tripo Studio credits for project models and justified iterations, and explicitly removed the proposed 200-credit total and 100-credit worker ceilings. The four secondary PNG uploads to studio.tripo3d.ai were also explicitly approved. Do not ask again for this same authorized work. Purchases, top-ups and paid API use remain outside the task. The independent Codex usage reserve stays at least 15%. The earlier git-push rejection is separate.

## Delivered GLBs

| Model | Bytes | Triangles | Local asset commit |
|---|---:|---:|---|
| safety-press | 107740 | 3739 | 1577818 |
| lathe | 110232 | 3900 | 6f6e56d |
| factory-cabinet | 90648 | 3434 | 6f6e56d |
| hoist | 150148 | 2952 | 611bf6f |
| lever-box | 82708 | 3900 | 1a4aa2a |
| shaft-motor | 93824 | 3579 | 08f7251 |
| socket-board | 104804 | 3115 | 08f7251 |
| rail-cart | 112308 | 3929 | 7a17cee |

Total: **852412 bytes, 28548 triangles**. Each model uses one material, a 512-pixel WebP texture and Meshopt. All eight have passed geometry checks and native 390×844 / 1024×768 visual review. Exact hashes and delivery metadata are in `release.json`; detailed acceptance is in `primary-release.json` and `secondary-main-review.json`. The worker's final rail-cart checks report 88 tests and TypeScript passing. Main independently reviewed the actual lathe/motor game view at both sizes; frames are in `integration-main/`.

Seven models are accepted in the game. The lever's square STOP glow and crane relocation are accepted (49d36e2 / d20eed9). Cabinet lamp and hint obstructions are fixed and accepted (a416f5c, m0463). Rail-cart was handed to Claude in m0464; its moving/loaded/unloaded game review remains.

## Integration details

- Press: a real through-bore; ram and rod remain code. Claude corrected the rod in 930e839.
- Lathe: real spindle bore and continuous tailstock; rotation and vibration clearance checked.
- Cabinet: low tray below the rotating tiles. Keep the code door, stripe and lamp (4600e6e).
- Hoist: factory-only static shaft, integrated in 9218bf2. Keep the code cabin, rope and pulley; the farm lift is unchanged. After unusable Studio results, the shaft was rebuilt locally with the original generated atlas.
- Lever: static housing with a swept lever opening; keep the code lever. Painted symbols and runtime state glow are aligned.
- Motor: through-bore at model XZ (0, −0.25); fit width 1.1, place at part (0, .16, −.1). Keep shaft, collar and gears.
- Socket panel: fit width 2.6, place at (0, .16, −.8); keep all eight active terminals. Painted symbols are visual guides.
- Cart: fit width 1.3, offset Y +.08 inside the cart. Rotate exactly four `wheel-front/rear-left/right` groups around local Z, excluding `_geometry` children. Preserve the world transform when attaching `load-coil` to the runtime bed. Details and clearance reports are in `secondary/README.md`.

## Provenance and cost

The main generation log records four orders for 100 existing credits, including three free hoist retries. `secondary/orders.json` records four more orders for 100 credits. **200 is the actual spend for this batch, not a ceiling.** The last recorded Studio balance after these orders is 5400. No purchases, top-ups or API charges were made.

Source GLBs remain in `assets-src/raw/factory-2026-10-27/`; some are gitignored and were not committed. References were not repainted. Cart wheel geometry was rebuilt locally with colors sampled from the original atlas; the coil was separated from fused supports. The real physical iPad/PWA has not been tested by this asset delivery. All commits by main and the worker are local; no GitHub push is performed by this delivery.
