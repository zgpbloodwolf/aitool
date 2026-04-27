import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['src/renderer/src/**/*.test.ts'],
    globals: true
  }
})
