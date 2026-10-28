// Brings the animals' own sounds into the game: clips from Codex's delivery
// (assets-src/audio-refresh/research/sfx-animals/animal-sfx-manifest.json) that
// passed the technical check and that the owner picked by ear go to
// public/sfx/<clip>.mp3 as they are (already mono 24 kHz, trimmed, levelled);
// public/sfx/sfx.json says which game sound each one stands for (plan.json
// `legacyVoiceId`: 'moo' → animal-cow) and which are short enough to come
// before an animal's words.
//   node scripts/import-sfx.mjs [--dry]
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'assets-src/audio-refresh/research/sfx-animals');
const OUT = join(ROOT, 'public/sfx');
const dry = process.argv.includes('--dry');

const plan = JSON.parse(readFileSync(join(SRC, 'plan.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(join(SRC, 'animal-sfx-manifest.json'), 'utf8'));
const soundOf = new Map(plan.families.filter((f) => f.legacyVoiceId).map((f) => [f.id, f.legacyVoiceId]));

const report = { taken: [], notPicked: [], notReady: [], unmapped: [] };
const sounds = {};
if (!dry) mkdirSync(OUT, { recursive: true });
for (const c of [...manifest.clips].sort((a, b) => a.variant - b.variant)) {
  if (c.technicalQA !== 'passed') {
    report.notReady.push(c.id);
    continue;
  }
  // Only what the owner chose by ear: a sound for a five-year-old is a matter of taste.
  if (!c.ownerSelected || c.listeningQA !== 'owner-approved') {
    report.notPicked.push(c.id);
    continue;
  }
  const sound = soundOf.get(c.family);
  if (!sound) {
    report.unmapped.push(c.id);
    continue;
  }
  const src = join(SRC, c.file);
  if (!existsSync(src) || createHash('sha256').update(readFileSync(src)).digest('hex') !== c.sha256) {
    report.notReady.push(c.id);
    continue;
  }
  if (!dry) copyFileSync(src, join(OUT, `${c.id}.mp3`));
  const s = (sounds[sound] ??= { takes: [], intro: [] });
  s.takes.push(c.id);
  if (c.introEligible) s.intro.push(c.id);
  report.taken.push(c.id);
}
if (!dry) writeFileSync(join(OUT, 'sfx.json'), JSON.stringify(sounds, null, 1) + '\n');
console.log(JSON.stringify({ ...report, sounds, status: manifest.status }, null, 1));
