// Every call the app makes to Supabase. Errors are thrown as ApiError with the
// short code raised by the database functions (see supabase/migrations).
import { IS_DEMO } from '../demo'
import { fetchAllPages } from './paging'
import { bangkokMidnight, addDays } from './time'
import { supabase } from './supabase'
import type { Position } from './geo'
import type { Profile, Project, Visit, VisitFull, VisitWithProject } from './types'

export class ApiError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

const KNOWN = new Set([
  'inactive_user', 'unknown_project', 'archived_project', 'empty_task', 'visit_not_open',
  'not_your_visit', 'not_manager', 'bad_times', 'role_change_forbidden', 'bad_request', 'invite_failed',
])

function fail(error: { message?: string } | null): never {
  const msg = error?.message ?? ''
  if (KNOWN.has(msg)) throw new ApiError(msg)
  if (/fetch|network/i.test(msg) || (typeof navigator !== 'undefined' && !navigator.onLine)) throw new ApiError('offline')
  throw new ApiError('generic')
}

const VISIT_WITH_PROJECT = '*, project:projects(*)'
const VISIT_FULL = '*, project:projects(*), profile:profiles!visits_user_id_fkey(*)'

/** Inclusive Bangkok date range → half-open UTC range. */
function utcRange(from: string, to: string): [string, string] {
  return [bangkokMidnight(from).toISOString(), bangkokMidnight(addDays(to, 1)).toISOString()]
}

export async function getOpenVisit(): Promise<VisitWithProject | null> {
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) return null
  const { data, error } = await supabase
    .from('visits').select(VISIT_WITH_PROJECT)
    .eq('user_id', user.user.id).is('check_out_at', null).maybeSingle()
  if (error) fail(error)
  return data as VisitWithProject | null
}

/** Looks the code up even if the project is archived, so the scan page can say it is closed. */
export async function getProjectByCode(code: string): Promise<Project | null> {
  const { data, error } = await supabase.rpc('project_by_code', { p_code: code })
  if (error) fail(error)
  return (data as Project | null) ?? null
}

export interface ScanInResult {
  status: 'checked_in' | 'already_in'
  visit: Visit
  closed_visit_id: string | null
}

export async function scanIn(code: string, task: string, pos: Position | null): Promise<ScanInResult> {
  const { data, error } = await supabase.rpc('scan_in', {
    p_project_code: code, p_task: task, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, p_accuracy: pos?.accuracy ?? null,
  })
  if (error) fail(error)
  return data as ScanInResult
}

export async function scanOut(visitId: string, task: string, workDone: string, pos: Position | null): Promise<Visit> {
  const { data, error } = await supabase.rpc('scan_out', {
    p_visit_id: visitId, p_task: task, p_work_done: workDone, p_lat: pos?.lat ?? null, p_lng: pos?.lng ?? null, p_accuracy: pos?.accuracy ?? null,
  })
  if (error) fail(error)
  return data as Visit
}

export async function updateVisit(
  visitId: string, checkInAt: string, checkOutAt: string | null, task: string, workDone: string,
): Promise<Visit> {
  const { data, error } = await supabase.rpc('update_visit', {
    p_visit_id: visitId, p_check_in_at: checkInAt, p_check_out_at: checkOutAt, p_task: task, p_work_done: workDone,
  })
  if (error) fail(error)
  return data as Visit
}

export async function listMyVisits(from: string, to: string): Promise<VisitWithProject[]> {
  const { data: user } = await supabase.auth.getUser()
  const [start, end] = utcRange(from, to)
  const { data, error } = await supabase
    .from('visits').select(VISIT_WITH_PROJECT)
    .eq('user_id', user.user?.id ?? '').gte('check_in_at', start).lt('check_in_at', end)
    .order('check_in_at')
  if (error) fail(error)
  return data as VisitWithProject[]
}

export async function listVisits(filter: { from: string; to: string; userId?: string; projectId?: string }): Promise<VisitFull[]> {
  const [start, end] = utcRange(filter.from, filter.to)
  try {
    return await fetchAllPages<VisitFull>((lo, hi) => {
      let q = supabase.from('visits').select(VISIT_FULL).gte('check_in_at', start).lt('check_in_at', end)
      if (filter.userId) q = q.eq('user_id', filter.userId)
      if (filter.projectId) q = q.eq('project_id', filter.projectId)
      return q.order('check_in_at').order('id').range(lo, hi).returns<VisitFull[]>()
    })
  } catch (e) {
    fail(e as { message?: string })
  }
}

export async function listOpenVisits(): Promise<VisitFull[]> {
  const { data, error } = await supabase.from('visits').select(VISIT_FULL).is('check_out_at', null).order('check_in_at')
  if (error) fail(error)
  return data as VisitFull[]
}

export async function listUnreviewedAutoClosed(): Promise<VisitFull[]> {
  try {
    return await fetchAllPages<VisitFull>((lo, hi) =>
      supabase
        .from('visits').select(VISIT_FULL)
        .not('auto_closed', 'is', null).is('edited_at', null)
        .order('check_in_at', { ascending: false }).order('id').range(lo, hi).returns<VisitFull[]>(),
    )
  } catch (e) {
    fail(e as { message?: string })
  }
}

export function subscribeVisits(onChange: () => void): () => void {
  if (IS_DEMO) return () => undefined // no live updates in the demo
  const channel = supabase
    .channel(`visits-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, onChange)
    .subscribe()
  return () => void supabase.removeChannel(channel)
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name')
  if (error) fail(error)
  return data as Profile[]
}

export async function updateProfile(id: string, patch: Partial<Pick<Profile, 'full_name' | 'language' | 'role' | 'active'>>) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) fail(error)
}

export async function listProjects(includeArchived = false): Promise<Project[]> {
  let q = supabase.from('projects').select('*').order('name')
  if (!includeArchived) q = q.eq('archived', false)
  const { data, error } = await q
  if (error) fail(error)
  return data as Project[]
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
  if (error) fail(error)
  return data as Project | null
}

export type ProjectInput = Pick<Project, 'name' | 'address' | 'lat' | 'lng' | 'color'>

export async function saveProject(input: ProjectInput & { id?: string; archived?: boolean }): Promise<Project> {
  const { id, ...fields } = input
  const query = id
    ? supabase.from('projects').update(fields).eq('id', id).select().single()
    : supabase.from('projects').insert(fields).select().single()
  const { data, error } = await query
  if (error) fail(error)
  return data as Project
}

export async function inviteUser(email: string, full_name: string, role: 'staff' | 'manager'): Promise<void> {
  const { data, error } = await supabase.functions.invoke('invite', { body: { email, full_name, role } })
  if (error) {
    let code = 'invite_failed'
    try {
      const body = await (error as { context?: Response }).context?.json()
      if (body?.error) code = body.error
    } catch {
      // keep default
    }
    throw new ApiError(KNOWN.has(code) ? code : 'invite_failed')
  }
  return data
}
