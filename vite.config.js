import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: true,
    // MilkDrop preset packs are data-heavy by design and are loaded as separate chunks.
    chunkSizeWarningLimit: 900,
  },
});
