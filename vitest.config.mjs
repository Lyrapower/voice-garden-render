import { defineConfig } from 'vitest/config';

export default defineConfig({ root: '.', test: { include: ['test/**/*.test.mjs'], testTimeout: 30_000 } });
