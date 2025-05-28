import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __DEV__: 'true',
    __TEST__: 'true'
  },
  test: {
    coverage: {
      include: ['src/**/*.{js,ts,jsx,tsx}'],
      exclude: ['src/**/*.d.{js,ts,jsx,tsx}', '**/vitest.js']
    },
    globals: true
  }
});
