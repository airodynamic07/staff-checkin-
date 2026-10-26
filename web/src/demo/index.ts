// Demo mode: the whole backend runs inside the page, using sample data.
import { FakeSupabase, type FakeState } from './fakeSupabase'
import { demoSeed } from './seed'

export const IS_DEMO = import.meta.env.VITE_DEMO === '1'
export const DEMO_API = 'https://demo-backend.invalid'

const STORE_KEY = 'staff-checkin-demo-v1'

function load(): FakeState {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as FakeState
  } catch {
    // storage unavailable or corrupt: start fresh
  }
  return demoSeed()
}

let backend: FakeSupabase | null = null

function getBackend(): FakeSupabase {
  if (!backend) {
    backend = new FakeSupabase(load())
    backend.onChange = () => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(backend!.snapshot()))
      } catch {
        // ignore: demo still works for this visit
      }
    }
  }
  return backend
}

export function resetDemo() {
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    // ignore
  }
  backend = null
}

/** fetch() replacement handed to supabase-js in demo mode. */
export async function demoFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const req = input instanceof Request ? input : new Request(input, init)
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => (headers[k] = v))
  const text = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = null
  }
  const res = getBackend().handle({ method: req.method, url: req.url, headers, body })
  await new Promise((r) => setTimeout(r, 120)) // feel like a network
  return new Response(res.status === 204 || res.body == null ? null : JSON.stringify(res.body), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** In-memory auth storage: the demo never depends on browser storage for login. */
export const memoryStorage = (() => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
})()
