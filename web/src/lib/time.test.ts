import { describe, expect, it } from 'vitest'
import {
  bangkokDate,
  durationMinutes,
  formatDate,
  formatDuration,
  formatTime,
  groupVisitsByDay,
  weekRange,
} from './time'
import type { Visit } from './types'

function visit(id: string, check_in_at: string, check_out_at: string | null): Visit {
  return {
    id, user_id: 'u', project_id: 'p', check_in_at, check_out_at, task: 't', work_done: null,
    in_lat: null, in_lng: null, in_accuracy_m: null, out_lat: null, out_lng: null, out_accuracy_m: null,
    auto_closed: null, edited_by: null, edited_at: null,
  }
}

describe('time helpers (Asia/Bangkok)', () => {
  it('bangkokDate rolls over at Bangkok midnight', () => {
    expect(bangkokDate('2026-10-19T16:59:00Z')).toBe('2026-10-19')
    expect(bangkokDate('2026-10-19T17:30:00Z')).toBe('2026-10-20')
  })

  it('durationMinutes for closed and open visits', () => {
    expect(durationMinutes(visit('a', '2026-10-19T01:00:00Z', '2026-10-19T08:05:00Z'))).toBe(425)
    expect(durationMinutes(visit('a', '2026-10-19T01:00:00Z', null), new Date('2026-10-19T02:30:00Z'))).toBe(90)
  })

  it('formatDuration', () => {
    expect(formatDuration(425)).toBe('7h 05m')
    expect(formatDuration(0)).toBe('0h 00m')
  })

  it('formatTime shows Bangkok clock time', () => {
    expect(formatTime('2026-10-19T01:12:00Z', 'en')).toBe('08:12')
    expect(formatTime('2026-10-19T01:12:00Z', 'th')).toBe('08:12')
  })

  it('formatDate uses Buddhist-era year in Thai', () => {
    expect(formatDate('2026-10-19T03:00:00Z', 'en')).toBe('Mon 19 Oct 2026')
    expect(formatDate('2026-10-19T03:00:00Z', 'th')).toContain('2569')
  })

  it('groupVisitsByDay puts a visit crossing midnight on its check-in day', () => {
    const late = visit('late', '2026-10-19T15:00:00Z', '2026-10-19T18:30:00Z') // 22:00 → 01:30 Bangkok
    const next = visit('next', '2026-10-20T02:00:00Z', '2026-10-20T03:00:00Z')
    const days = groupVisitsByDay([late, next])
    expect(days.map((d) => d.date)).toEqual(['2026-10-20', '2026-10-19'])
    expect(days[1].visits.map((v) => v.id)).toEqual(['late'])
    expect(days[1].totalMinutes).toBe(210)
  })

  it('weekRange is Monday to Sunday', () => {
    expect(weekRange('2026-10-21')).toEqual({ start: '2026-10-19', end: '2026-10-25' })
    expect(weekRange('2026-10-25')).toEqual({ start: '2026-10-19', end: '2026-10-25' })
    expect(weekRange('2026-10-19')).toEqual({ start: '2026-10-19', end: '2026-10-25' })
  })
})
