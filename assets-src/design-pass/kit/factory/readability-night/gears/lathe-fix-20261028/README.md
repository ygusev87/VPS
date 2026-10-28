# Moved lathe/grinder shaft review — 28 October 2026

Review of Claude m0558 / 02be7ce. Historical ../replacement-contract.json and ../review.json remain unchanged.

Run `node assets-src/design-pass/kit/factory/readability-night/gears/lathe-fix-20261028/audit-current.mjs` from the repository root. It derives LATHE_SHAFT_AT and shaft height from current sources, tests only the two moved-axis machine bodies, and writes audit.json. Existing motor checks are not repeated.

The new axis is (-2.45, 0.51, -0.45). Conservative rim/spoke/hub cylinder checks find no body surface intersections. Rim clearance: lathe 0.2866646747, grinder 0.9728171104. These are radial clearances in clipped vertical slabs, not a global assembly separation metric.

fixture.html uses real loadModels/model, Lathe, ShaftMotor, and Gear constructors. Native 1180×820 and 390×844 frames show actual GLB bodies and the pair distance 1.40. They are diagnostic evidence, not full game presentation acceptance or mechanical tooth-phase proof. review.json records exclusions.
