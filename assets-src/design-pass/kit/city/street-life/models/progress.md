# City street life — model worker

2026-10-27, Asia/Bangkok. Task city-street-life, Claude m0492/main m0493.
Status: working. Project active (peek revision1045). Codex remaining42%; reserve15%.

Exclusive scope: this progress file, city-icecream-kiosk/, city-flower-kiosk/, city-tram-shelter/, corresponding local raw files and public GLBs. No shared manifest/layout/src edits. No push.
Standing owner authorization: factory/machines-3d/evening-paint/authorization.json; project reference uploads and model generation in Tripo using existing credits, including future models. No purchases/topups/subscriptions/paid APIs.

| Model | Stage | Intended XYZ | Contract |
|---|---|---|---|
| city-icecream-kiosk | reference ready | 2.8×3.0×2.2 | striped parasol, front+Z, baseY0, centreXZ0 |
| city-flower-kiosk | reference ready | 2.7×2.7×2.0 | flower/news kiosk, front+Z, baseY0, centreXZ0 |
| city-tram-shelter | reference ready | 3.8×2.7×1.8 | opaque roof, openfront+Z, rearbench, no glass |

Targets: one opaque material,512WebP,Meshopt,<=4000tri,<=150KB each,no skeleton. Sources: city-a.png and city-green-blocks.png visually reviewed. Icecream ordered: task61b5b0ba-6f7b-4e47-a788-7744efa191b1,25credits,balance5275→5250. Flower/shelter references ready; settings checked.

Icecream raw downloaded and front+Z checked in native loader; optimizing. Flower orderfb86c6a3-ef11-46d6-8298-59c60ae9c678,25credits,5250→5225. Shelter order requested at25credits, before5225. All3 reference prompts and SHA saved.

All3 orders placed,75credits total,live balance5200. Shelter taskee550979-7fbd-43c7-acb9-2b51d46010e9. Icecream candidate85,388B/3090tri/1mat/512WebP/Meshopt; native final QA underway.

## READY — city-icecream-kiosk

public/models/city-icecream-kiosk.glb: 85388bytes,3090tri,1opaque material,512WebP/Meshopt,no skin. SHA256 `d3bc60629630c1ae50a5ab3e270211017dcae7826e426fea336a305f004ed0d7`. XYZ2.8×3.0×2.2;front+Z,baseY0,centreXZ0,width2.8. QA native390×844and1024×768 allPASS,0browsererrors/overflow. Evidence city-icecream-kiosk/qa/*.jpg,report.json,qa.json,README.md. Ready for main to accept and pass to Claude; other2 still generating.

Icecream commitc59defc;88tests and TypeScriptPASS. Flower3439tri and shelter3442tri completed in Studio on first attempt, raw downloaded; orientation/optimization/QA now underway. No retries or extra credits.

## READY — city-flower-kiosk

public/models/city-flower-kiosk.glb:113000bytes,3299tri,1OPAQUE material,512WebP/Meshopt,no skin. SHA256 `f666d3eadac981bfd1896e5bcbdb915ac62334221966a61a42a80f6111004134`. XYZ2.7×2.7×2.0;front+Z,newsrack+X,baseY0,centreXZ0,width2.7. Native390×844and1024×768allPASS,0browsererrors/overflow,validator0errors/0warnings. Evidence city-flower-kiosk/qa/*.jpg,report.json,qa.json,README.md. Ready for main to accept/pass to Claude. Shelter final QA underway;clearfrontvolume2.5×1.63×.55passed0obstructionsand49/49rays. Codexremaining41%.
