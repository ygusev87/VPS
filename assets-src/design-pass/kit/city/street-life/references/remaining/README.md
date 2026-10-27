# Remaining city props — reference set

Eight original PNG references created with the built-in image_gen tool, one call each. Exact prompts, SHA256 and pixel dimensions are in `generation.json`. Originals were copied byte-for-byte; no manual image edits. These are authoring references, not final 3D assets. No Tripo orders were made by main.

The actual target bounds and candidate locations are in `../../remaining-layout-proposal.json`; dimensions include caps, rims and all appendages. Match the toy-city palette and large readable forms rather than tiny surface detail. The current model worker remains on the factory forklift; this package does not start another batch.

- **city-fruit-stall**: `refs/city-fruit-stall.png`, target XYZ [2.4, 2.4, 1.6]. Connected counter, three large produce trays and open canopy. Keep apples/pears/citrus readable after simplification.
- **city-bike-rack**: `refs/city-bike-rack.png`, target XYZ [2.5, 1.3, 1.6]. Two bicycles / four wheels, chunky disc centres and one rack. Reference uses simplified toy bikes without a visible drivetrain; accepted as static toy design. Do not add thin spokes or chains. All four wheels must share ground plane.
- **city-playground**: `refs/city-playground.png`, target XYZ [3.8, 2.5, 2.8]. Connected slide and one stationary swing. Source shows a large set; fit actual GLB uniformly to declared bounds and verify every foot. No animated seat requested.
- **city-flower-planter**: `refs/city-flower-planter.png`, target XYZ [0.9, 0.85, 0.9]. Five broad blooms and compact connected leaves. Do not spend geometry on tiny stems; preserve pot silhouette.
- **city-poster-column**: `refs/city-poster-column.png`, target XYZ [0.9, 2.2, 0.9]. Music note and sun/star are flat pictorial graphics. Cap/base are modestly wider than the cylinder: target width includes them.
- **city-drinking-fountain**: `refs/city-drinking-fountain.png`, target XYZ [0.7, 1, 0.7]. Empty basin with integrated spout and button. Decorative dry asset, no new water interaction.
- **city-street-bin**: `refs/city-street-bin.png`, target XYZ [0.76, 0.9, 0.76]. Open shell only: image suggests depth but does not prove geometric openness. Require real unobstructed top opening >=.56 after fitting; preserve coded .84 lid/cat.
- **city-postbox**: `refs/city-postbox.png`, target XYZ [0.44, 1.22, 0.6]. Shell/post only, no flag or letter. Native assembly must preserve coded flag pivot (.24,.95,.1) and letter; geometry cannot fill their motion clearance.

Bin/postbox replace existing city toy bodies only. Keep their coded moving parts, sounds and tapping; do not add static duplicates. Other maps remain outside this city task. The reference alone cannot establish open cavities, contacts or swept collision clearance.
