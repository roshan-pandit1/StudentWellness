import { defineConfig } from 'vitest/config'
import base from './vite.config'

export default defineConfig({
  ...base,
  test: { ...base.test, include: ['tests/integration/**/*.test.tsx'], exclude: [], hookTimeout: 20_000, testTimeout: 20_000 },
})
