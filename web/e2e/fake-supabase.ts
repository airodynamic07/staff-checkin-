// Playwright adapter for the in-memory Supabase stand-in in src/demo/fakeSupabase.ts.
import type { Page } from '@playwright/test'
import { FakeSupabase as Core } from '../src/demo/fakeSupabase'

export class FakeSupabase extends Core {
  constructor() {
    super({
      users: [
        { id: 'u-staff', email: 'staff@example.com', password: 'password123' },
        { id: 'u-manager', email: 'manager@example.com', password: 'password123' },
      ],
      profiles: [
        { id: 'u-staff', full_name: 'Somchai', role: 'staff', language: 'en', active: true },
        { id: 'u-manager', full_name: 'Malee', role: 'manager', language: 'en', active: true },
      ],
      projects: [
        { id: 'p-a', code: 'sitea1', name: 'Site A', address: null, lat: null, lng: null, color: '#2563eb', archived: false },
        { id: 'p-b', code: 'siteb1', name: 'Site B', address: null, lat: null, lng: null, color: '#e11d48', archived: false },
      ],
      visits: [],
    })
    // Start at 08:00 Bangkok today; each write moves the clock 2 h 15 m so durations are visible
    // and the test never depends on the real time of day.
    let clock = Date.parse(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())}T01:00:00Z`) - 135 * 60 * 1000
    this.now = () => {
      clock += 135 * 60 * 1000
      return new Date(clock).toISOString()
    }
  }

  async install(page: Page) {
    await page.route('http://supabase.test/**', async (route) => {
      const req = route.request()
      let body: unknown = null
      try {
        body = req.postDataJSON()
      } catch {
        body = null
      }
      const res = this.handle({ method: req.method(), url: req.url(), headers: req.headers(), body })
      await route.fulfill({
        status: res.status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
        body: res.body == null ? '' : JSON.stringify(res.body),
      })
    })
  }
}
