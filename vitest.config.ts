import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-key', VITE_VAPID_PUBLIC_KEY: 'BPublicKey' },
    exclude: ['node_modules', 'dist', 'server/data'],
  },
})
