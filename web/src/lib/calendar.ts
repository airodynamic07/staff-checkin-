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

const DEFAULT_MIN_HOUR = 6
const DEFAULT_MAX_HOUR = 22

function bangkokHourMinutes(iso: string): number {
  const d = new Date(Date.parse(iso) + 7 * 60 * 60 * 1000)
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

/** Time-grid range: 06:00–22:00, or the whole day if any visit falls outside it. */
export function visibleHours(visits: VisitWithProject[], now: Date = new Date()): { min: string; max: string } {
  const outside = visits.some((v) => {
    const end = v.check_out_at ?? now.toISOString()
    const spansMidnight = Date.parse(end) - Date.parse(v.check_in_at) >= 24 * 60 * 60 * 1000
      || bangkokHourMinutes(end) < bangkokHourMinutes(v.check_in_at)
    return spansMidnight
      || bangkokHourMinutes(v.check_in_at) < DEFAULT_MIN_HOUR * 60
      || bangkokHourMinutes(end) > DEFAULT_MAX_HOUR * 60
  })
  return outside ? { min: '00:00', max: '24:00' } : { min: '06:00', max: '22:00' }
}
