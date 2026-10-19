import { durationMinutes } from './time'
import type { VisitFull } from './types'

export interface ProjectSummary {
  rows: { userId: string; name: string; task: string; minutes: number }[]
  perPerson: { userId: string; name: string; minutes: number }[]
  totalMinutes: number
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

/** Hours per person and task for closed visits. Tasks match ignoring case and outer spaces. */
export function summarizeProject(visits: VisitFull[]): ProjectSummary {
  const rows = new Map<string, ProjectSummary['rows'][number]>()
  const people = new Map<string, ProjectSummary['perPerson'][number]>()
  let totalMinutes = 0
  for (const v of visits) {
    if (!v.check_out_at) continue
    const minutes = durationMinutes(v)
    const key = `${v.user_id}\u0000${v.task.trim().toLowerCase()}`
    const row = rows.get(key) ?? { userId: v.user_id, name: v.profile.full_name, task: v.task.trim(), minutes: 0 }
    row.minutes += minutes
    rows.set(key, row)
    const person = people.get(v.user_id) ?? { userId: v.user_id, name: v.profile.full_name, minutes: 0 }
    person.minutes += minutes
    people.set(v.user_id, person)
    totalMinutes += minutes
  }
  return {
    rows: [...rows.values()].sort((a, b) => byName(a, b) || a.task.localeCompare(b.task)),
    perPerson: [...people.values()].sort(byName),
    totalMinutes,
  }
}
