import { defineConfig } from 'vite';

// base: './' — relative asset paths, so the build works on GitHub Pages
// (/VPS/) and in any other subfolder without changes.
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
