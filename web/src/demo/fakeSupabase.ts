// An in-memory stand-in for the Supabase REST, Auth and Edge Function
// endpoints the app calls. The browser e2e test uses it through Playwright,
// and the demo build runs it inside the page. It mirrors the database rules in
// supabase/migrations for every path the app uses.

export interface FakeUser { id: string; email: string; password: string }
export type Row = Record<string, unknown>

export interface FakeState {
  users: FakeUser[]
  profiles: Row[]
  projects: Row[]
  visits: Row[]
}

export interface FakeRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

export interface FakeResponse {
  status: number
  body: unknown
}

const MAX_ROWS = 1000

export class FakeSupabase implements FakeState {
  users: FakeUser[] = []
  profiles: Row[] = []
  projects: Row[] = []
  visits: Row[] = []
  /** Server clock; replaceable so tests are deterministic. */
  now: () => string = () => new Date().toISOString()
  /** Called after every write (the demo saves its state here). */
  onChange: () => void = () => undefined

  constructor(state?: Partial<FakeState>) {
    Object.assign(this, state)
  }

  snapshot(): FakeState {
    return { users: this.users, profiles: this.profiles, projects: this.projects, visits: this.visits }
  }

  private userFromHeaders(headers: Record<string, string>): FakeUser | undefined {
    const auth = headers['authorization'] ?? headers['Authorization'] ?? ''
    return this.users.find((u) => auth === `Bearer token-${u.id}`)
  }

  private profile(u?: FakeUser): Row | undefined {
    return u && this.profiles.find((p) => p.id === u.id)
  }

  private isActive(u?: FakeUser) {
    return !!this.profile(u)?.active
  }

  private isManager(u?: FakeUser) {
    const p = this.profile(u)
    return !!p && p.role === 'manager' && !!p.active
  }

  private canSeeProject(p: Row, u: FakeUser): boolean {
    if (this.isManager(u)) return true
    if (!this.isActive(u)) return false
    return !p.archived || this.visits.some((v) => v.project_id === p.id && v.user_id === u.id)
  }

  private visitFull(v: Row, u: FakeUser): Row {
    const project = this.projects.find((p) => p.id === v.project_id)
    return {
      ...v,
      project: project && this.canSeeProject(project, u) ? project : null,
      profile: this.profiles.find((p) => p.id === v.user_id),
    }
  }

  private ok(body: unknown, status = 200): FakeResponse {
    return { status, body }
  }

  private rpcError(code: string): FakeResponse {
    return { status: 400, body: { code: 'P0001', message: code, details: null, hint: null } }
  }

  private filter(rows: Row[], params: URLSearchParams): Row[] {
    return rows.filter((r) => {
      for (const [key, raw] of params) {
        if (['select', 'order', 'limit', 'offset', 'columns'].includes(key)) continue
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

  private changed<T>(res: T): T {
    this.onChange()
    return res
  }

  private newId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
  }

  private later(at: string, than: unknown) {
    return Date.parse(at) > Date.parse(String(than)) ? at : new Date(Date.parse(String(than)) + 1000).toISOString()
  }

  handle(req: FakeRequest): FakeResponse {
    if (req.method === 'OPTIONS') return this.ok({})
    const url = new URL(req.url)
    const path = url.pathname
    const user = this.userFromHeaders(req.headers)
    const body = (req.body ?? {}) as Record<string, unknown>

    // --- auth ---
    if (path === '/auth/v1/token') {
      const u = this.users.find((x) => x.email === body.email && x.password === body.password)
      if (!u) return { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' } }
      return this.ok({
        access_token: `token-${u.id}`, token_type: 'bearer', expires_in: 3600 * 24,
        expires_at: Math.floor(Date.now() / 1000) + 3600 * 24, refresh_token: `refresh-${u.id}`,
        user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      })
    }
    if (path === '/auth/v1/user') {
      if (!user) return { status: 401, body: { message: 'unauthorized' } }
      return this.ok({ id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} })
    }
    if (path === '/auth/v1/logout') return { status: 204, body: null }

    // --- edge function: invite ---
    if (path === '/functions/v1/invite') {
      if (!user) return { status: 401, body: { error: 'unauthorized' } }
      if (!this.isManager(user)) return { status: 403, body: { error: 'not_manager' } }
      const email = String(body.email ?? '').trim().toLowerCase()
      const name = String(body.full_name ?? '').trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || !['staff', 'manager'].includes(String(body.role))) {
        return { status: 400, body: { error: 'bad_request' } }
      }
      if (this.users.some((u) => u.email === email)) return { status: 400, body: { error: 'invite_failed' } }
      const id = this.newId('u')
      this.users.push({ id, email, password: 'password123' })
      this.profiles.push({ id, full_name: name, role: body.role, language: 'th', active: true })
      return this.changed(this.ok({ user_id: id }))
    }

    // --- rpc ---
    if (path.startsWith('/rest/v1/rpc/')) {
      const fn = path.split('/').pop()
      if (!user) return { status: 401, body: { message: 'unauthorized' } }
      if (fn === 'is_manager') return this.ok(this.isManager(user))
      if (fn === 'project_by_code') {
        if (!this.isActive(user)) return this.ok(null)
        return this.ok(this.projects.find((p) => p.code === body.p_code) ?? null)
      }
      if (fn === 'scan_in') {
        if (!this.isActive(user)) return this.rpcError('inactive_user')
        const project = this.projects.find((p) => p.code === body.p_project_code)
        if (!project) return this.rpcError('unknown_project')
        if (project.archived) return this.rpcError('archived_project')
        const open = this.visits.find((v) => v.user_id === user.id && v.check_out_at == null)
        if (open && open.project_id === project.id) return this.ok({ status: 'already_in', visit: open, closed_visit_id: null })
        if (!String(body.p_task ?? '').trim()) return this.rpcError('empty_task')
        const at = this.now()
        if (open) Object.assign(open, { check_out_at: this.later(at, open.check_in_at), auto_closed: 'switched_project' })
        const visit: Row = {
          id: this.newId('v'), user_id: user.id, project_id: project.id, check_in_at: at, check_out_at: null,
          task: String(body.p_task).trim(), work_done: null, in_lat: body.p_lat ?? null, in_lng: body.p_lng ?? null,
          in_accuracy_m: body.p_accuracy ?? null, out_lat: null, out_lng: null, out_accuracy_m: null,
          auto_closed: null, edited_by: null, edited_at: null,
        }
        this.visits.push(visit)
        return this.changed(this.ok({ status: 'checked_in', visit, closed_visit_id: open?.id ?? null }))
      }
      if (fn === 'scan_out') {
        if (!this.isActive(user)) return this.rpcError('inactive_user')
        const v = this.visits.find((x) => x.id === body.p_visit_id)
        if (!v || v.user_id !== user.id) return this.rpcError('not_your_visit')
        if (v.check_out_at) return this.rpcError('visit_not_open')
        if (!String(body.p_task ?? '').trim()) return this.rpcError('empty_task')
        Object.assign(v, {
          check_out_at: this.later(this.now(), v.check_in_at), task: String(body.p_task).trim(),
          work_done: String(body.p_work_done ?? '').trim() || null,
          out_lat: body.p_lat ?? null, out_lng: body.p_lng ?? null, out_accuracy_m: body.p_accuracy ?? null,
        })
        return this.changed(this.ok(v))
      }
      if (fn === 'update_visit') {
        if (!this.isManager(user)) return this.rpcError('not_manager')
        const v = this.visits.find((x) => x.id === body.p_visit_id)
        if (!v) return this.rpcError('not_your_visit')
        const inAt = body.p_check_in_at as string | null
        const outAt = body.p_check_out_at as string | null
        if (!inAt || (outAt == null && v.check_out_at != null) || (outAt != null && Date.parse(outAt) <= Date.parse(inAt))) {
          return this.rpcError('bad_times')
        }
        if (!String(body.p_task ?? '').trim()) return this.rpcError('empty_task')
        Object.assign(v, {
          check_in_at: inAt, check_out_at: outAt, task: String(body.p_task).trim(),
          work_done: String(body.p_work_done ?? '').trim() || null, edited_by: user.id, edited_at: this.now(),
        })
        return this.changed(this.ok(v))
      }
      return { status: 404, body: { message: `no rpc ${fn}` } }
    }

    // --- tables ---
    const table = path.replace('/rest/v1/', '')
    if (!user) return { status: 401, body: { message: 'unauthorized' } }
    const manager = this.isManager(user)
    const source = table === 'profiles' ? this.profiles : table === 'projects' ? this.projects : table === 'visits' ? this.visits : null
    if (!source) return { status: 404, body: { message: `no table ${table}` } }

    let rows: Row[]
    if (table === 'profiles') rows = this.profiles.filter((p) => manager || p.id === user.id)
    else if (table === 'projects') rows = this.projects.filter((p) => this.canSeeProject(p, user))
    else rows = this.visits.filter((v) => manager || v.user_id === user.id).map((v) => this.visitFull(v, user))

    const wantsObject = (req.headers['accept'] ?? req.headers['Accept'] ?? '').includes('vnd.pgrst.object')
    const reply = (result: Row[]) =>
      wantsObject ? (result.length === 1 ? this.ok(result[0]) : { status: 406, body: { message: 'not one row' } }) : this.ok(result)

    if (req.method === 'POST') {
      if (table !== 'projects' || !manager) return { status: 403, body: { code: '42501', message: 'permission denied' } }
      const row: Row = { id: this.newId('p'), code: Math.random().toString(36).slice(2, 8), archived: false, color: '#2563eb', ...(body as Row) }
      this.projects.push(row)
      return this.changed(reply([row]))
    }

    if (req.method === 'PATCH') {
      if (table === 'visits') return { status: 403, body: { code: '42501', message: 'permission denied' } }
      const patch = body as Row
      const targets = this.filter(rows, url.searchParams)
      if (table === 'projects' && !manager) return reply([])
      if (table === 'profiles') {
        const changesRole = 'role' in patch || 'active' in patch
        if (changesRole && (!manager || targets.some((t) => t.id === user.id))) return this.rpcError('role_change_forbidden')
      }
      const updated = targets.map((r) => Object.assign(source.find((x) => x.id === r.id)!, patch))
      return this.changed(reply(updated))
    }

    // Like PostgREST: offset/limit from .range(), and never more than max_rows.
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Math.min(Number(url.searchParams.get('limit') ?? MAX_ROWS), MAX_ROWS)
    const order = url.searchParams.get('order') ?? ''
    const desc = order.startsWith('check_in_at.desc')
    const result = this.filter(rows, url.searchParams)
      .sort((a, b) => {
        const c = String(a.check_in_at ?? a.full_name ?? a.name ?? '').localeCompare(String(b.check_in_at ?? b.full_name ?? b.name ?? ''))
        return desc ? -c : c
      })
      .slice(offset, offset + limit)
    return reply(result)
  }
}
