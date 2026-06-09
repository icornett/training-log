import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test/setup.ts'],
    reporters: ['default', 'junit'],
    outputFile: { junit: 'test-results/web-junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/pages/**/*.tsx', 'src/services/api.ts'],
      thresholds: {
        lines: 75,
        branches: 60,
        functions: 45,
        statements: 75,
      },
    },
  },
})
