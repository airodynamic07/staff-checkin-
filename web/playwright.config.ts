import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'

const chromium = '/opt/pw-browsers/chromium'
const PORT = 5179

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
    timezoneId: 'Asia/Bangkok',
    actionTimeout: 10_000,
    geolocation: { latitude: 13.7563, longitude: 100.5018 },
    permissions: ['geolocation'],
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: true,
    env: {
      VITE_SUPABASE_URL: 'http://supabase.test',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_APP_URL: `http://localhost:${PORT}`,
    },
  },
})
