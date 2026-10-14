import { defineConfig } from 'vite';

// The render scene is a static page the CLI serves to a headless browser; it is built into scene-dist/.
export default defineConfig({
  root: 'scene',
  base: './',
  build: { outDir: '../scene-dist', emptyOutDir: true, target: 'es2022', chunkSizeWarningLimit: 900 },
});
