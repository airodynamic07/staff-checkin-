import { createClient } from '@supabase/supabase-js'
import { DEMO_API, demoFetch, IS_DEMO, memoryStorage } from '../demo'

export const supabase = IS_DEMO
  ? createClient(DEMO_API, 'demo-anon-key', {
      global: { fetch: demoFetch },
      auth: { storage: memoryStorage, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: {} },
    })
  : createClient(
      import.meta.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321',
      import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'missing-anon-key',
    )

export const APP_URL: string = IS_DEMO
  ? 'https://checkin.example.com'
  : (import.meta.env.VITE_APP_URL ?? window.location.origin)
