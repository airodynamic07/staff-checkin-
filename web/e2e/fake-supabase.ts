// A tiny in-memory stand-in for the Supabase REST + Auth endpoints the app
// calls, so the browser flow can be tested without a running Supabase stack.
// It mirrors the database rules in supabase/migrations for the paths used here.
import type { Page, Route } from '@playwright/test'

interface User { id: string; email: string; password: string }
type Row = Record<string, unknown>

export class FakeSupabase {
  users: User[] = [
    { id: 'u-staff', email: 'staff@example.com', password: 'password123' },
    { id: 'u-manager', email: 'manager@example.com', password: 'password123' },
  ]
  profiles: Row[] = [
    { id: 'u-staff', full_name: 'Somchai', role: 'staff', language: 'en', active: true },
    { id: 'u-manager', full_name: 'Malee', role: 'manager', language: 'en', active: true },
  ]
  projects: Row[] = [
    { id: 'p-a', code: 'sitea1', name: 'Site A', address: null, lat: null, lng: null, color: '#2563eb', archived: false },
    { id: 'p-b', code: 'siteb1', name: 'Site B', address: null, lat: null, lng: null, color: '#e11d48', archived: false },
  ]
  visits: Row[] = []
  // Start at 08:00 Bangkok today so the test never depends on the real time of day.
  private clock = Date.parse(
    `${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date())}T01:00:00Z`,
  ) - 135 * 60 * 1000

  private now(): string {
    // Each write moves the fake clock forward 2 h 15 m so durations are visible.
    this.clock += 135 * 60 * 1000
    return new Date(this.clock).toISOString()
  }

  async install(page: Page) {
    await page.route('http://supabase.test/**', (route) => this.handle(route))
  }

  private userFromToken(route: Route): User | undefined {
    const auth = route.request().headers()['authorization'] ?? ''
    return this.users.find((u) => auth === `Bearer token-${u.id}`)
  }

  private isManager(u?: User) {
    return !!u && this.profiles.some((p) => p.id === u.id && p.role === 'manager')
  }

  private visitFull(v: Row): Row {
    return {
      ...v,
      project: this.projects.find((p) => p.id === v.project_id),
      profile: this.profiles.find((p) => p.id === v.user_id),
    }
  }

  private json(route: Route, status: number, body: unknown) {
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' },
      body: JSON.stringify(body),
    })
  }

  private rpcError(route: Route, code: string) {
    return this.json(route, 400, { code: 'P0001', message: code, details: null, hint: null })
  }

  private filter(rows: Row[], params: URLSearchParams): Row[] {
    return rows.filter((r) => {
      for (const [key, raw] of params) {
        if (['select', 'order', 'limit'].includes(key)) continue
        const value = r[key]
        const [op, ...rest] = raw.split('.')
        const arg = rest.join('.')
        const ok =
          op === 'eq' ? String(value) === arg :
          op === 'is' ? (arg === 'null' ? value == null : String(value) === arg) :
          op === 'gte' ? String(value) >= arg :
          op === 'lt' ? String(value) < arg :
          op === 'not' && arg === 'is.null' ? value != null :
          true
        if (!ok) return false
      }
      return true
    })
  }

  private async handle(route: Route) {
    const req = route.request()
    if (req.method() === 'OPTIONS') return this.json(route, 200, {})
    const url = new URL(req.url())
    const path = url.pathname
    const user = this.userFromToken(route)

    // --- auth ---
    if (path === '/auth/v1/token') {
      const body = req.postDataJSON() as { email: string; password: string }
      const u = this.users.find((x) => x.email === body.email && x.password === body.password)
      if (!u) return this.json(route, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' })
      return this.json(route, 200, {
        access_token: `token-${u.id}`, token_type: 'bearer', expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `refresh-${u.id}`,
        user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      })
    }
    if (path === '/auth/v1/user') {
      if (!user) return this.json(route, 401, { message: 'unauthorized' })
      return this.json(route, 200, { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} })
    }
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })

    // --- rpc ---
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop()
      const body = req.postDataJSON() as Record<string, unknown>
      if (!user) return this.json(route, 401, { message: 'unauthorized' })
      if (fn === 'scan_in') {
        const project = this.projects.find((p) => p.code === body.p_project_code)
        if (!project) return this.rpcError(route, 'unknown_project')
        if (project.archived) return this.rpcError(route, 'archived_project')
        const open = this.visits.find((v) => v.user_id === user.id && v.check_out_at == null)
        if (open && open.project_id === project.id) return this.json(route, 200, { status: 'already_in', visit: open, closed_visit_id: null })
        if (!String(body.p_task ?? '').trim()) return this.rpcError(route, 'empty_task')
        const at = this.now()
        if (open) Object.assign(open, { check_out_at: at, auto_closed: 'switched_project' })
        const visit: Row = {
          id: `v${this.visits.length + 1}`, user_id: user.id, project_id: project.id, check_in_at: at, check_out_at: null,
          task: String(body.p_task).trim(), work_done: null, in_lat: body.p_lat, in_lng: body.p_lng, in_accuracy_m: body.p_accuracy,
          out_lat: null, out_lng: null, out_accuracy_m: null, auto_closed: null, edited_by: null, edited_at: null,
        }
        this.visits.push(visit)
        return this.json(route, 200, { status: 'checked_in', visit, closed_visit_id: open?.id ?? null })
      }
      if (fn === 'scan_out') {
        const v = this.visits.find((x) => x.id === body.p_visit_id)
        if (!v || v.user_id !== user.id) return this.rpcError(route, 'not_your_visit')
        if (v.check_out_at) return this.rpcError(route, 'visit_not_open')
        Object.assign(v, {
          check_out_at: this.now(), task: String(body.p_task).trim(), work_done: String(body.p_work_done ?? '').trim() || null,
          out_lat: body.p_lat, out_lng: body.p_lng, out_accuracy_m: body.p_accuracy,
        })
        return this.json(route, 200, v)
      }
      if (fn === 'is_manager') return this.json(route, 200, this.isManager(user))
      return this.json(route, 404, { message: `no rpc ${fn}` })
    }

    // --- tables ---
    const table = path.replace('/rest/v1/', '')
    if (!user) return this.json(route, 401, { message: 'unauthorized' })
    const manager = this.isManager(user)
    let rows: Row[]
    if (table === 'profiles') rows = this.profiles.filter((p) => manager || p.id === user.id)
    else if (table === 'projects') rows = this.projects.filter((p) => manager || !p.archived)
    else if (table === 'visits') rows = this.visits.filter((v) => manager || v.user_id === user.id).map((v) => this.visitFull(v))
    else return this.json(route, 404, { message: `no table ${table}` })

    if (req.method() === 'PATCH') {
      const patch = req.postDataJSON() as Row
      const source = table === 'profiles' ? this.profiles : this.projects
      for (const r of this.filter(rows, url.searchParams)) Object.assign(source.find((x) => x.id === r.id)!, patch)
      return this.json(route, 200, [])
    }

    const result = this.filter(rows, url.searchParams).sort((a, b) =>
      String(a.check_in_at ?? a.name ?? '').localeCompare(String(b.check_in_at ?? b.name ?? '')),
    )
    if ((req.headers()['accept'] ?? '').includes('vnd.pgrst.object')) {
      return result.length === 1 ? this.json(route, 200, result[0]) : this.json(route, 406, { message: 'not one row' })
    }
    return this.json(route, 200, result)
  }
}
