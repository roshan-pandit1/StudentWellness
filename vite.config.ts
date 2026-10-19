import { fileURLToPath, URL } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'tests/integration/**'],
    setupFiles: ['./tests/setup.ts'],
    css: true,
    restoreMocks: true,
    clearMocks: true,
  },
})
