// Mechanical image resize/encoding and measurements only; art is made by builtin Image.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('./', import.meta.url);
const report = { date: '2026-10-26', assets: [], totalBytes: 0 };
for (const id of ['grass-base', 'grass-meadow']) {
  const out = new URL(`candidates/${id}-v2.webp`, root);
  await sharp(new URL(`sources/${id}-v2.png`, root).pathname).resize(512,512).removeAlpha().webp({quality:90, effort:6}).toFile(out.pathname);
  const buf = await readFile(out);
  const stat = await sharp(buf).stats();
  const old = await sharp(new URL(`candidates/${id}-v1.webp`, root).pathname).stats();
  report.assets.push({id, file:`candidates/${id}-v2.webp`, size:[512,512], bytes:buf.length, sha256:createHash('sha256').update(buf).digest('hex'),meanRgbV1:old.channels.slice(0,3).map(c=>+c.mean.toFixed(2)),meanRgbV2:stat.channels.slice(0,3).map(c=>+c.mean.toFixed(2))});
  report.totalBytes += buf.length;
}
await writeFile(new URL('candidates/grass-v2-report.json', root), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
