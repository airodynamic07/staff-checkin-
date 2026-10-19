import { expect, it } from 'vitest'
import { anna, makeVisit, somchai } from './fixtures'
import { summarizeProject } from './summary'

it('groups by person and task (case/space-insensitive), ignores open visits', () => {
  const s = summarizeProject([
    makeVisit({ id: '1', task: 'Paint wall', check_in_at: '2026-10-19T01:00:00Z', check_out_at: '2026-10-19T03:00:00Z' }),
    makeVisit({ id: '2', task: 'paint wall ', check_in_at: '2026-10-20T01:00:00Z', check_out_at: '2026-10-20T01:30:00Z' }),
    makeVisit({ id: '3', task: 'Tiles', user_id: anna.id, profile: anna, check_in_at: '2026-10-19T01:00:00Z', check_out_at: '2026-10-19T02:00:00Z' }),
    makeVisit({ id: '4', task: 'Open', check_out_at: null }),
  ])
  expect(s.rows).toEqual([
    { userId: anna.id, name: 'Anna', task: 'Tiles', minutes: 60 },
    { userId: somchai.id, name: 'สมชาย', task: 'Paint wall', minutes: 150 },
  ])
  expect(s.perPerson).toEqual([
    { userId: anna.id, name: 'Anna', minutes: 60 },
    { userId: somchai.id, name: 'สมชาย', minutes: 150 },
  ])
  expect(s.totalMinutes).toBe(210)
})
