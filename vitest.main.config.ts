import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main')
    }
  },
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts'],
    globals: true
  }
})
