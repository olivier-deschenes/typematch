import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts so unit tests don't boot the
// Cloudflare, TanStack Start and Paraglide plugins.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
