// Decorative PCB traces behind the table, pinned to the screen edges like the
// reference artboard's trace layer.
export function drawTraces(svg: SVGSVGElement) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const paths: string[] = [];
  const nodes: [number, number][] = [];
  const pix: [number, number][] = [];
  const trace = (pts: [number, number][]) => {
    paths.push(`M${pts.map(([x, y]) => `${x},${y}`).join(' L')}`);
    nodes.push(pts[0], pts[pts.length - 1]);
  };
  // Sidebar width; in landscape the drawers dock at the bottom instead.
  const docked = window.matchMedia('(orientation: landscape)').matches;
  const L = docked ? 0 : 76;
  // Top: runs from the brand towards the progress card.
  trace([[L + 380, 46], [W * 0.55, 46], [W * 0.55 + 22, 24], [W - 330, 24]]);
  trace([[L + 400, 62], [W * 0.52, 62]]);
  // Right edge, below the progress card.
  trace([[W - 26, 110], [W - 26, H * 0.38], [W - 48, H * 0.38 + 22], [W - 48, H * 0.52]]);
  trace([[W - 14, 140], [W - 14, H * 0.45]]);
  // Bottom right, above the view bar.
  trace([[W - 360, H - 92], [W - 120, H - 92], [W - 98, H - 70]]);
  // Left, along the sidebar (or the left edge, above the dock).
  trace([[L + 18, H * 0.3], [L + 18, H * 0.5], [L + 36, H * 0.5 + 18], [L + 36, H - 150]]);
  for (let i = 0; i < 4; i++) pix.push([W * 0.55 + 46 + i * 12, 20]);
  for (let i = 0; i < 4; i++) pix.push([L + 13, H * 0.42 + i * 12]);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML =
    paths.map((d) => `<path d="${d}"/>`).join('') +
    nodes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('') +
    pix.map(([x, y]) => `<rect class="pix" x="${x}" y="${y}" width="7" height="7"/>`).join('');
}
