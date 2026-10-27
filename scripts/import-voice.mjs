// Brings the recorded voice into the game: clips from Codex's delivery
// (assets-src/audio-refresh/research/production-v4/delivery-manifest.json) whose
// text is still the game's (src/voice.ts) go to public/voice/<id>.mp3 and
// <id>--v02.mp3…, re-encoded small (mono, 24 kHz, 48 kbit/s: speech stays clear,
// the whole voice stays ~10 MB for the offline iPad); public/voice/variants.json
// says how many takes each phrase has, for the game to vary its praise.
//   node scripts/import-voice.mjs [--dry]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'assets-src/audio-refresh/research/production-v4');
const OUT = join(ROOT, 'public/voice');
const dry = process.argv.includes('--dry');

// The game's phrases as they are written now.
const phrases = new Map();
for (const [, id, text] of readFileSync(join(ROOT, 'src/voice.ts'), 'utf8').matchAll(/^ {2}(\w+): '((?:[^'\\]|\\.)*)',$/gm)) phrases.set(id, text.replace(/\\'/g, "'"));

const manifest = JSON.parse(readFileSync(join(SRC, 'delivery-manifest.json'), 'utf8'));
const report = { taken: 0, variants: 0, stale: [], notReady: 0, unknown: [] };
const takes = new Map();
for (const c of manifest.clips) {
  if (c.status !== 'complete' || c.technicalQA !== 'passed') {
    report.notReady++;
    continue;
  }
  const now = phrases.get(c.phraseId);
  if (now === undefined) {
    report.unknown.push(c.phraseId);
    continue;
  }
  // A take of the first variant must say the phrase as the game has it now; extra takes of praise may vary the words.
  if (c.variant === 0 && now !== c.text) {
    report.stale.push(c.phraseId);
    continue;
  }
  const src = join(SRC, c.file);
  if (!existsSync(src) || createHash('sha256').update(readFileSync(src)).digest('hex') !== c.sha256) {
    report.notReady++;
    continue;
  }
  const name = c.variant === 0 ? `${c.phraseId}.mp3` : `${c.phraseId}--v${String(c.variant + 1).padStart(2, '0')}.mp3`;
  if (!dry) execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-ac', '1', '-ar', '24000', '-b:a', '48k', join(OUT, name)]);
  takes.set(c.phraseId, Math.max(takes.get(c.phraseId) ?? 0, c.variant + 1));
  report.taken++;
  if (c.variant > 0) report.variants++;
}
const variants = Object.fromEntries([...takes].filter(([, n]) => n > 1).sort());
if (!dry) writeFileSync(join(OUT, 'variants.json'), JSON.stringify(variants, null, 1) + '\n');
console.log(JSON.stringify({ ...report, phrasesWithTakes: Object.keys(variants).length, status: manifest.status }, null, 1));
