import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * Writes dist/sw.js: the service worker that saves the whole game on the
 * device for offline play. Its file list and version come from the build
 * output, so every deploy refreshes the saved copy.
 */
function offline(): Plugin {
  let outDir = 'dist';
  return {
    name: 'offline-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const hash = createHash('sha256');
      for (const f of list) hash.update(f).update(readFileSync(join(outDir, f)));
      const sw = readFileSync('scripts/sw-template.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__FILES__', JSON.stringify(list));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

// base: './' — relative asset paths, so the build works on GitHub Pages
// (/VPS/) and in any other subfolder without changes.
/** Which build this is, shown small in a corner: the commit and when it was built (the owner's time, Bangkok). */
function buildLabel() {
  let commit = 'dev';
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    // Not a git checkout: the label just says dev.
  }
  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${commit} · ${when}`;
}

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(buildLabel()) },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
  plugins: [offline()],
});
