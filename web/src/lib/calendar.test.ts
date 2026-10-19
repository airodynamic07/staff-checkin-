import { expect, it } from 'vitest'
import { toCalendarEvents } from './calendar'
import type { VisitFull } from './types'

const base: VisitFull = {
  id: 'v1', user_id: 'u', project_id: 'p', check_in_at: '2026-10-19T01:00:00Z', check_out_at: '2026-10-19T05:00:00Z',
  task: 'Install tiles', work_done: null, in_lat: null, in_lng: null, in_accuracy_m: null, out_lat: null, out_lng: null,
  out_accuracy_m: null, auto_closed: null, edited_by: null, edited_at: null,
  project: { id: 'p', code: 'sitea1', name: 'Site A', address: null, lat: null, lng: null, color: '#e11d48', archived: false },
  profile: { id: 'u', full_name: 'Somchai', role: 'staff', language: 'th', active: true },
}

it('maps a visit to a coloured event', () => {
  const [e] = toCalendarEvents([base])
  expect(e).toMatchObject({
    id: 'v1', title: 'Site A · Install tiles', start: base.check_in_at, end: base.check_out_at,
    backgroundColor: '#e11d48', borderColor: '#e11d48', classNames: [],
  })
})

it('an open visit ends now', () => {
  const now = new Date('2026-10-19T03:00:00Z')
  const [e] = toCalendarEvents([{ ...base, check_out_at: null }], now)
  expect(e.end).toBe(now.toISOString())
})

it('flags unedited auto-closed visits only', () => {
  const [flagged, fixed] = toCalendarEvents([
    { ...base, id: 'a', auto_closed: 'end_of_day' },
    { ...base, id: 'b', auto_closed: 'end_of_day', edited_at: '2026-10-20T01:00:00Z' },
  ])
  expect(flagged.classNames).toEqual(['flagged'])
  expect(fixed.classNames).toEqual([])
})

it('widens the visible hours to fit visits outside 06:00–22:00 Bangkok', async () => {
  const { visibleHours } = await import('./calendar')
  expect(visibleHours([base])).toEqual({ min: '06:00', max: '22:00' }) // 08:00–12:00
  expect(visibleHours([{ ...base, check_in_at: '2026-10-19T16:30:00Z', check_out_at: '2026-10-19T16:50:00Z' }])).toEqual({ min: '00:00', max: '24:00' }) // 23:30
  expect(visibleHours([{ ...base, check_in_at: '2026-10-18T22:00:00Z', check_out_at: '2026-10-19T01:00:00Z' }])).toEqual({ min: '00:00', max: '24:00' }) // 05:00
})
