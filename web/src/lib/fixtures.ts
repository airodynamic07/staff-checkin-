// Test data shared by unit tests.
import type { Profile, Project, VisitFull } from './types'

export const siteA: Project = { id: 'pa', code: 'sitea1', name: 'Site A', address: null, lat: null, lng: null, color: '#e11d48', archived: false }
export const somchai: Profile = { id: 'u1', full_name: 'สมชาย', role: 'staff', language: 'th', active: true }
export const anna: Profile = { id: 'u2', full_name: 'Anna', role: 'staff', language: 'en', active: true }

export function makeVisit(over: Partial<VisitFull> = {}): VisitFull {
  return {
    id: 'v', user_id: somchai.id, project_id: siteA.id,
    check_in_at: '2026-10-19T01:00:00Z', check_out_at: '2026-10-19T08:05:00Z',
    task: 'Install tiles', work_done: null,
    in_lat: null, in_lng: null, in_accuracy_m: null, out_lat: null, out_lng: null, out_accuracy_m: null,
    auto_closed: null, edited_by: null, edited_at: null,
    project: siteA, profile: somchai,
    ...over,
  }
}
