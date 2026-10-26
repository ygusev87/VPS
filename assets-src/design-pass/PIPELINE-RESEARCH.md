# Environment art pipeline for a fixed-camera mobile 3D game: research and rules

Context: three.js, iPad Safari, fixed-tilt perspective camera (pan and zoom only), 110x75-unit maps, GLB characters and devices,
unlimited AI images (gpt-image), limited AI 3D. Goal: everything static is finished painted art placed as-is, not built in a shader.

## 0. Honest note on sources

- Web search found **no primary source (GDC talk, postmortem) for how Hay Day, Township, Gardenscapes, Family Island or Royal Match
  build their ground**. Supercell and Playrix have not published that detail where I could reach it. Do not cite those games as proof.
- What I did verify: Clash of Clans (Supercell) uses pre-rendered 3D rendered to 2D sprites; Dead Cells renders 3D to pixel sprites;
  Octopath-style HD-2D puts 2D billboards into real 3D lit scenes; Bad North/Townscaper tile-kit lessons; MDN/Android/three.js/OpenAI
  docs for the technical parts.
- Items marked **[practice]** are widely used industry practice or my own synthesis, not backed by a fetched source. Treat as
  hypotheses to test on an iPad.
- Items marked **[budget]** are my conservative numbers for you to measure, not published limits.

## 1. Ground / terrain for a fixed-angle camera

What is established:
- Splat maps (tiling textures blended by painted masks) are the cheap generic route; a single painted ground texture suits a fixed camera
  and a stylised look but needs enough resolution and flat or gently sloped ground; top-down projection stretches on steep slopes.
  Sources: Unity splat-map docs and Polycount threads, summarised in search results
  ([Unity terrain textures](https://docs.unity3d.com/400/Documentation/Components/terrain-Textures.html),
  [Polycount](https://polycount.com/discussion/comment/1589870)). These are forum/old-doc level evidence.
- Clash of Clans: art is pre-rendered 3D, rendered to 2D; the camera is deliberately higher than in comparable games to make
  building/editing easier ([Making of CoC, via search summary](https://www.pocketgamer.com/articles/045814/r/); the page itself did not
  load for me, so treat as secondary).
- Our situation differs from isometric 2D games: we have a real perspective camera on a flat ground plane. Paint the ground
  **top-down orthographic** (flat) and let the camera supply perspective. Never paint perspective into ground art.

Options compared (for our case):
- **One big painted plate per map, sliced into chunks** [practice]. Best look and best fit to "finished art, placed as-is". Cost: memory.
  Math: 110x75 units at 32 px/unit = 3520x2400 = 8.4 Mpx = about 34 MB raw RGBA, about 45 MB with mips. At 64 px/unit it is 4x that,
  too much for iPad unless streamed/compressed. Use 16-24 px/unit for the macro plate (farm fields, paths, mud, lawns) and rely on
  decals/props for close-up detail.
- **Tiles (grid of painted tiles from a kit)**: cheap, reusable, but visible grid; needs variants and edge pieces. Best for roads/asphalt.
- **Decals** (quads lying on the ground, alpha cutout or multiply): mud patches, flower clusters, worn grass, tyre marks, stones. They
  hide tiling and repetition. Cost: overdraw. Bake static decals into the ground plate offline when possible.
- **Ribbon/spline roads with strip textures** [practice]: a mesh along a polyline, UV.v across width, UV.u along length, painted strip
  tiles lengthwise with feathered alpha edges; separate end-cap and junction decals. Good for organic dirt paths; bad for crossings
  (make a junction blob decal on top).
- Recommended mix: **painted macro plate (chunks) + painted road/path kit or ribbons + painted decals**, all authored top-down with the
  same light. No runtime blending of masks in a shader for static things.

Hiding tiling (when some tiling remains):
- Random per-tile offset/rotation with blending of neighbouring samples removes visible repetition but costs several texture fetches
  and was designed to keep mipmapping sane ([Inigo Quilez, texture repetition](https://iquilezles.org/articles/texturerepetition)).
  This is the kind of shader approach you are leaving; only keep it for a plain filler grass.
- Hand rules [practice]: repeat period at least 8-12 world units; 3-6 base variants chosen per cell; large-scale painted "break-up"
  decals over the top; avoid straight rows of identical features along tile edges; no directional shadows or strong highlights in a
  tiling texture because they repeat visibly ([Lovart AI texture guide](https://www.lovart.ai/fr/blog/how-to-generate-textures-materials-ai)).
- Townscaper/Bad North: hand-made special pieces that span several cells and rules like "no identical or mirrored tile next to itself"
  break up grid look ([Game Developer: How Townscaper works](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)).

Texel density for our camera [practice, compute it, do not guess]:
- Needed density = on-screen pixels per world unit at the **maximum zoom-in, at the nearest (bottom) screen row**, times your DPR cap.
  Perspective makes distant rows denser than needed; mips and anisotropy cover them.
- Rule: ground plate 16-24 px/unit; props/decals 48-96 px/unit; devices (GLB) stay as they are. Characters and interactive parts should
  be the sharpest thing on screen; ground should be softer (it also reduces visual noise for a child).
- Limit the maximum zoom so that nothing needs more than your highest density. A zoom clamp is cheaper than more pixels.
- Your renderer already has a ~4 Mpx pixel budget (AGENTS.md). Make the texture density consistent with that: texels beyond screen
  pixels are wasted.

## 2. Static props: meshes vs pre-rendered sprites

Established:
- Pre-rendering 3D to 2D sprites is a mainstream mobile pipeline (Clash of Clans; Dead Cells did it for characters with a private
  batch tool, modelling in 3ds Max and cleaning by hand; see [80.lv Dead Cells pipeline](https://80.lv/articles/case-study-dead-cells-character-art-pipeline/),
  summary only). Motivation: consistent look, cheap runtime, easy re-render at higher resolution.
- HD-2D (Octopath Traveler): 2D sprites as billboards inside a fully 3D lit world, with point lights, shadows cast onto the environment,
  depth of field and tilt-shift giving a diorama look ([Wikipedia: HD-2D](https://en.wikipedia.org/wiki/HD-2D)). This is the closest
  precedent for "2D painted pieces + 3D lit actors" on a fixed camera.
- Baked lighting precomputes light for static things and is what you want for static props; dynamic things (characters) need light
  probes/ambient to match ([Unity docs via search](https://docs.unity3d.com/2017.4/Documentation/Manual/GraphicsFeatures.html)).

Rules [practice]:
- Fixed camera makes **cutout sprites (impostors) legitimate**: render/paint each prop at the real camera pitch, put it on a quad that
  faces the camera (rotated about X by the pitch) with its pivot at the ground contact point. Because the camera never rotates, no
  view-angle popping occurs. Perspective differs a little between screen centre and edges (a few degrees); fine for trees/bushes/rocks,
  visible on tall straight things (buildings, fences, towers). Use real meshes for those, or keep sprites short.
- Sorting: use alpha-test cutout (plus alpha-to-coverage if MSAA) with depth write, not soft blended alpha, so characters can walk
  behind and in front without sorting bugs. A tilted quad clips into the ground and into characters near its base: raise the quad
  slightly or fade the bottom 2-3% so the base is tucked under the ground contact shadow.
- 3D mesh is better when: the object is walked around/through (gates, fences with gaps), is tall, is animated (swaying only needs
  vertex bend), or needs real contact with devices. Sprite is better for: bushes, trees, rocks, hay, flower beds, barrels, background
  clutter, anything seen only from the fixed angle.
- Shadows: do not use shadow maps for static sprites. Paint a soft contact/cast shadow as part of a **separate multiply decal** under
  each prop, offset in the one global light direction (e.g. toward lower right). Dynamic actors: blob shadow or the three.js
  contact-shadow approach (a top-down depth render of the actors blurred onto a transparent ground plane; cheap, no self-shadowing;
  discussion at [three.js forum](https://discourse.threejs.org/t/shadow-contact-threejs/29505)).
- Baked AO/shadows into textures or vertex colours: yes for static meshes (no runtime cost). Bake AO into prop sprites at author time
  and keep cast shadows separate so they can be reused on any ground colour.
- When 2D + 3D mixing **works**: same key-light direction and softness; ground contact shadows present; similar saturation/contrast;
  actors slightly outlined or rim-lit consistently; sprites' resolution close to the actors' on screen.
- When it **looks wrong**: sprites without contact shadows ("stickers"); highlights from a different direction than the real lights;
  actor goes behind a sprite and gets cut by the quad plane; very different sharpness (blurry sprite next to crisp 3D); hard
  white/black halos on alpha edges; sprites that are too perspective-heavy (painted as if the camera were lower than it is).
- Post-process unifier: a little shared vignette/tilt-shift or colour grade helps 2D and 3D feel like one picture (HD-2D relies on it).

## 3. Modular kits (roads, paths, fences)

- Minimal road/path set: straight, corner, T, cross, end-cap (5 shapes, rotate in 90 degree steps). Add 2-3 variants of straight and a
  wide version if needed. Autotile theory: a 4-neighbour (edge) set is 16 tiles; a 47-tile "blob" set also handles diagonals and
  isolated tiles; the 16-tile "dual-grid" set (tiles placed on corners between cells) gives nicer transitions for top-down terrain
  ([Red Blob Games autotiling](https://www.redblobgames.com/articles/autotile/claude/), [GameMaker auto tiles](https://manual.gamemaker.io/beta/en/The_Asset_Editors/Tile_Set_Editors/Auto_Tiles.htm)).
  For maps with hand-placed roads you only need the 5 shapes plus a ribbon for curves.
- Grid size [practice]: 2x2 world units for roads/paths (child-scale objects, devices are ~2-4 units); fences and walls in 1-unit
  steps; ground chunks 16x16 or 22x18.75 units. Pick one base unit and write it in the art bible; do not mix.
- Build tiles as edge/corner segments that snap and define allowed neighbours per edge; mark the connection (road/grass) on each edge
  ([Townscaper/Bad North tile lessons](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)).
  Long thin modules (fences, pipes) need end pieces and junctions or they break placement.
- Hand-draw several special pieces (crossing with zebra, bridge ramp, gate, puddle) to break repetition; give rare delightful pieces
  priority rules; keep large-scale layout predictable and let small details vary.
- Trim sheets: one strip texture with horizontal bands (kerbs, fence boards, plank edges, wall bases) reused across many meshes; keep
  density consistent across a level ([Polycount discussions on trim sheets/texel density](https://polycount.com/discussions/tagged/trim-sheet/p1)).
  For painted 2D this equals a **strip atlas**: a road edge, a fence run, a hedge run that tile in one direction.
- Decals for variety [practice]: 8-20 small painted decals per biome (leaf litter, puddles, cracks, manhole, tyre marks, flower
  clumps, pebbles) placed with random rotation and scale 0.8-1.2, not more than 2-3 repeats of the same one in view.
- Keep hero/story objects hand-placed; use kits for filler. Reskinning a tile kit later is expensive, so lock the style first.

## 4. Pipeline and process rules

- **Art bible before mass production.** Contents: shape language and proportions, palette (with hex swatches), material logic, light
  intent (one direction, softness, time-of-day variants), scale reference (child, cow, door, car in world units), edge/outline policy,
  do/don't images, technical limits (texture sizes, px/unit). Write the reasoning, not only the choices. Consistency tends to break
  past ~30-40 assets or 2-3 artists unless someone owns a review checkpoint
  ([Juego Studio](https://www.juegostudio.com/blog/art-direction-in-games), [iXie](https://www.ixiegaming.com/blog/high-performance-game-art-pipelines-from-style-guide-to-engine-ready/)); these are blog-level sources.
- **Greybox first**: lay out the map with flat-coloured primitives and real gameplay objects, verify routes, clearances, tappable
  areas and zoom. Then capture a **top-down orthographic layout guide image** and a **game-camera screenshot** per region. These become
  the references for AI generation (colour-coded zones: path, field, mud, water, building footprints). Art passes replace greybox
  one layer at a time (ground, then big props, then small props, then decals).
- **One global light**: choose a direction (e.g. key from upper-left, shadows toward lower-right, soft sky fill) and bake it into
  every painted piece; write it as one line at the top of every prompt. Day/night: night is a runtime grade plus lights, do not paint a
  second set of art (except emissive masks for windows/lamps).
- **Palette**: a small master palette (low-poly guides recommend one palette texture that everything maps to, so recolouring the
  whole game is one edit; [Bugnet style guide](https://bugnet.io/blog/low-poly-3d-a-style-guide-for-small-teams)). For painted art:
  run every generated asset through the same colour-grade (LUT or histogram match to a hero reference) in a script.
- **Edge treatment**: pick one policy for the whole game and write it down: either no outline plus a slightly darker, more saturated
  edge tone, or a thin uniform outline. Stylised surfaces: simple boxy forms, few colour variations, roughness/value gradients to
  guide the eye, subtle localised detail ([Adobe/Supercell Helsinki stylised content](https://www.adobe.com/products/substance3d/magazine/supercell-helsinki-creating-stylized-content-for-clash-of-clans-and-clash-royale.html)).
- **Detail consistency**: a 300-triangle tree next to a 30,000-triangle rock breaks the world; the same goes for painted detail
  level. Keep detail density per world unit constant ([Bugnet](https://bugnet.io/blog/low-poly-3d-a-style-guide-for-small-teams)).
- **Mind clutter when zoomed out**: ornamental detail aliases/gets busy at distance; simplify for far views
  ([Townscaper article](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)).
- **Review against the target mockup**: side-by-side "approved mockup | real screenshot", same angle and zoom, before accepting a
  region. Reject on: lighting direction, saturation, sharpness mismatch, repetition, floating props (no contact shadow), halos.
- **Naming and manifest** [practice]: `env_<map>_<kind>_<name>_<variant>_v<NN>.png`, e.g. `env_farm_tree_oak_b_v03.png`. A
  `manifest.json` per map lists: id, source file, size in world units, pixels per unit, pivot (ground contact), footprint,
  collision, atlas name, light-direction tag, palette version, prompt/seed hash, status (draft/approved). Build step reads the manifest
  to make atlases and chunks; never hand-edit atlas coordinates. Use consistent suffixes for low/high meshes when baking so bakes do not
  contaminate ([Adobe article](https://www.adobe.com/products/substance3d/magazine/supercell-helsinki-creating-stylized-content-for-clash-of-clans-and-clash-royale.html)).
- Ship small complete versions of one region first (a vertical slice of one farm corner) before generating the rest.

## 5. Mobile WebGL performance rules (iPad Safari)

Established facts:
- Mipmaps cost about 30-33% extra memory, improve cache use and reduce shimmering; skip them for textures never shown minified
  ([MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices),
  [Android texture guide](https://developer.android.com/games/optimize/textures)).
- Atlases merge draws (changing a texture forces a new batch); batching static meshes reduces CPU overhead (MDN, Android guide).
- Compressed textures are smaller in GPU memory and cheaper in bandwidth, usually lower quality than PNG/JPG; the Android guide's
  example: 17 MB uncompressed, 3 MB ETC1, 2.5 MB ASTC. Basis Universal transcodes one file to all GPU formats at load (MDN).
- three.js `KTX2Loader`: needs the WASM transcoder path, must call `detectSupport(renderer)` before loading, only Basis Universal
  payloads ([three.js KTX2Loader docs](https://threejs.org/docs/pages/KTX2Loader.html)).
- PNG/JPG/WebP are decoded to raw pixels and sit uncompressed on the GPU: 2048x2048 RGBA = 16 MB (+33% with mips). File size on disk
  does not matter for memory.
- Bilinear (with mips) is the best balance; trilinear costs bandwidth; anisotropy above 2x is expensive
  ([Android guide](https://developer.android.com/games/optimize/textures)). sRGB only for colour textures.
- WebGL guaranteed minimum `MAX_TEXTURE_SIZE` is 4096 (MDN). Survey: iOS reports 8192 for 100% and 16384 for ~98.65% of devices in
  WebGL2 ([Web3DSurvey](https://web3dsurvey.com/webgl2/parameters/MAX_TEXTURE_SIZE)). But the real limit on iOS is the **per-page
  memory budget**, not texture dimensions: heavy WebGL pages get killed by memory pressure and reloaded in a loop
  ([WebKit bug 300782](https://bugs.webkit.org/show_bug.cgi?id=300782), [Apple forum](https://developers.apple.com/forums/thread/133449)).
  Canvas backing-store memory is also capped by area, 4 bytes per pixel (WebKit source, via search summary).

Rules for us:
- Texture sizes: ground chunks 1024x1024 (max 2048 for hero), prop atlases 2048x2048 (max 4096), decal atlas 1024-2048. **Never
  rely on 8192/16384 even if reported.**
- GPU memory budget **[budget]**: keep all environment textures under about 150-200 MB resident on iPad including mips, plus
  the canvas, shadow map and post-processing buffers you already have. Measure with Safari Web Inspector / Xcode memory gauge on a real
  iPad, not a desktop.
- Format: ship **KTX2 (Basis)**: UASTC for painted ground/props where gradients must not band, ETC1S only for noisy/small textures
  **[practice]**; Safari on iPad gets ASTC from the transcoder. Memory drops 4x or more vs RGBA8. Fallback: WebP/PNG for dev builds only.
  Test banding on large soft gradients (sky-like grass) before committing; if bad, dither the source slightly or use a larger ASTC block
  quality setting.
- Use mipmaps + `anisotropy` 2-4 for ground (perspective grazing angle makes the far ground blur otherwise); no mips for UI/billboards at
  fixed size. Pad every atlas/chunk by 2-4 px of edge-extruded colour so mips and linear filtering do not bleed neighbours; for chunks,
  overlap by 1-2 px or share edge pixels so there are no seams.
- Alpha: bleed (dilate) colour into transparent pixels before compression to avoid dark/white fringes; decide premultiplied vs straight
  alpha once for the whole project.
- Draw calls: ground = one draw per visible chunk (frustum cull; roughly 10-20); static props = merged geometry or `InstancedMesh`
  per atlas; decals = one merged mesh per atlas; target total static-environment draw calls **under ~50** so the rest of the budget goes
  to the devices (your measured baseline was ~900 for 32 devices; the environment must not add to that). A blog threshold of ~100
  "SetPass calls" on mobile is a rule of thumb, not an official figure.
- Overdraw: large alpha-blended layers cost fill rate on tile-based GPUs. Bake static decals into ground chunks; keep cutout sprites
  tight (trim empty alpha with a polygon quad rather than a full rectangle for big canopies).
- Sharpness at different zoom: author at the maximum zoom density, let mips handle zoom-out; avoid 1 px lines and fine noise that
  shimmer when minified; consider two LODs (far = half-res chunk) if memory forces it. Clamp zoom to the range you have pixels for.
- Load: decode in the background, one texture at a time (you already do this for voice); keep a `dispose()` policy for maps not in view.

## 6. AI image generation recipe (gpt-image)

API facts from the [OpenAI image guide](https://developers.openai.com/api/docs/guides/image-generation) (current page names the
`gpt-image-2.5` family): `background: "transparent"` with `output_format` png or webp gives alpha; the edit endpoint accepts
multiple reference images; masks are prompt-guided and not pixel-exact; recommended sizes 1024x1024, 1536x1024, 1024x1536; custom
sizes must be multiples of 16, edges up to 3840, 0.65-8.3 Mpx; use `low` quality for drafts and a higher one for finals;
consistency of recurring elements can be imperfect; complex prompts can take up to ~2 minutes.

Recipe [practice, test and tune]:
1. **Style anchor**: pick 1-2 approved hero images (target mockups already in `assets-src/design-pass/variants`). Pass them as
   reference images in every edit call with the same sentence: "same painting style, palette and soft light as reference".
2. **Layout guide**: send the greybox top-down colour-coded image as a second reference ("paint over this layout; keep every shape
   and boundary exactly; green=lawn, brown=dirt path, ..."). This keeps scale and positions, so pieces align with gameplay.
3. **Ground prompts**: "flat orthographic top-down view, straight down, no perspective, no horizon, no cast shadows, no strong
   directional light, even soft light, hand-painted stylised children's game, <material>, subtle large-scale variation". The model
   tends to drift to a 3/4 view and to paint directional shadows; reject those. Light and shadow belong in a separate layer.
4. **Seamless tiles**: AI output is rarely seamless. Offset the image by half width/height (wrap), inpaint the centre cross seam via an
   edit with a mask, or run a seam-erase step ([80.lv tutorial](https://cdn.80.lv/articles/tutorial-using-ai-to-create-seamless-tilable-textures/?amp=1),
   [Scenario texture essentials](https://help.scenario.com/articles/3312894507-scenario-texture-the-essentials)). Always check by
   tiling 3x3 and again with a mirrored copy; describe the material, not a scene.
5. **Large plates**: generate region by region (about 1536x1024 each), then stitch offline with 15-25% overlap and feather blends
   in a script; slice into power-of-two chunks with padding. To continue across a seam, pass the neighbour strip as reference and ask
   to extend it. Place chunk boundaries along roads/fences where possible. Do the stitching offline, never at runtime.
6. **Props with alpha**: ask for "single object on a plain flat chroma-key background" or request `background: transparent`; then
   cut with a script, bleed edge colour, add a 1-2 px feather. Camera: give the greybox screenshot (or a cube rendered from the real
   game camera) as reference and state "viewed from the same camera angle, about N degrees from the ground plane" so the pitch matches.
7. **Variants**: generate 4-6 per prop from the same anchor and prompt, vary one word (season, size, leaf density); keep 2-3. Never mirror
   in a way that flips the light direction; mirrors are only for symmetric objects.
8. **Normalise in post**: scripted colour grade to the palette, slight unsharp mask, optional uniform outline/edge darkening, trim
   to bounds, write to manifest with measured px/unit and pivot.
9. **Shadows**: generate the prop without ground shadow; generate (or draw procedurally) a separate soft shadow decal in the global
   light direction so it can be reused on any ground.
10. **Review loop**: always compare with the mockup in the real engine at the real camera and zoom; fix with a mask edit and
    "change only X" rather than regenerating everything.

Pitfalls:
- Light direction and colour temperature drift between generations; style drifts after ~5-10 unanchored calls.
- Baked ground shadows and puddle highlights that repeat when tiled; baked 3/4 perspective in "top-down" ground.
- Fuzzy semi-transparent edges and white halos after cutout; ghost fragments in alpha.
- Resolution mismatch (one asset noticeably sharper); upscale then re-sharpen consistently or regenerate smaller scale.
- Over-detailed noisy ground that fights with characters; keep ground low-contrast, props/devices high-contrast.
- Text, logos and repeated objects (many hands/fence posts of different pitch) in tiles; fences of AI images rarely have constant post
  spacing, so make fences as a kit or 3D strip.
- Moderation or `image_generation_user_error` on some prompts: change the prompt, do not auto-retry.

## Source list

All sources are linked inline above (Supercell/CoC making-of, Adobe/Supercell Helsinki, HD-2D, Dead Cells, Townscaper article, Quilez, Red Blob autotiling, MDN, Android texture guide, three.js KTX2Loader, Web3DSurvey, WebKit bug 300782, OpenAI image guide, 80.lv/Scenario seamless-texture guides, art-bible blogs, Polycount).
