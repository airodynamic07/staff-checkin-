import type { EventInput } from '@fullcalendar/core'
import type { VisitWithProject } from './types'

export function toCalendarEvents(visits: VisitWithProject[], now: Date = new Date()): EventInput[] {
  return visits.map((v) => ({
    id: v.id,
    title: `${v.project.name} · ${v.task}`,
    start: v.check_in_at,
    end: v.check_out_at ?? now.toISOString(),
    backgroundColor: v.project.color,
    borderColor: v.project.color,
    classNames: v.auto_closed && !v.edited_at ? ['flagged'] : [],
  }))
}
