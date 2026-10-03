import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    // Unit tests drive iframe events explicitly; never contact a map provider.
    environmentOptions: { happyDOM: { settings: { disableIframePageLoading: true } } },
    globals: true,
    // Bound DOM worker memory on small CI runners and local machines.
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      // Vitest 4 removed coverage.all. Preserve the old extension/include scope,
      // including untouched sources, rather than silently inflating coverage.
      include: ['**/*.{js,cjs,mjs,ts,mts,tsx,jsx,vue,svelte,marko,astro}'],
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        // Generated browser reports contain bundled third-party viewer code, not app sources.
        'playwright-report/**',
        'test-results/**',
        'reports/**',
        '**/*.config.js',
        '**/mockServiceWorker.js',
        '**/__tests__/**',
        '**/tests/**',
        'scripts/**',
        // The browser lifecycle harness and frozen assets are not application coverage.
        'e2e-pwa/**'
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70
      }
    },
    setupFiles: ['./src/tests/setup.js'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 10000,
    hookTimeout: 10000
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
