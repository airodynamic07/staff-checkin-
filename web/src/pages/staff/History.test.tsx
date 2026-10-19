import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import type { Project, VisitWithProject } from '../../lib/types'

const listMyVisits = vi.fn()
vi.mock('../../lib/api', async (orig) => ({ ...(await orig<object>()), listMyVisits: (...a: unknown[]) => listMyVisits(...a) }))

const site: Project = { id: 'p', code: 'sitea1', name: 'Site A', address: null, lat: null, lng: null, color: '#f00', archived: false }
function v(id: string, inAt: string, outAt: string, auto: VisitWithProject['auto_closed'] = null): VisitWithProject {
  return {
    id, user_id: 'u', project_id: 'p', check_in_at: inAt, check_out_at: outAt, task: `task ${id}`, work_done: null,
    in_lat: null, in_lng: null, in_accuracy_m: null, out_lat: null, out_lng: null, out_accuracy_m: null,
    auto_closed: auto, edited_by: null, edited_at: null, project: site,
  }
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  listMyVisits.mockResolvedValue([
    v('1', '2026-10-19T01:00:00Z', '2026-10-19T06:00:00Z'), // Mon 5h
    v('2', '2026-10-20T02:00:00Z', '2026-10-20T06:30:00Z', 'end_of_day'), // Tue 4h30
  ])
})

it('shows days with totals and flags auto-closed visits', async () => {
  const { default: History } = await import('./History')
  render(<MemoryRouter><History initialDate="2026-10-21" /></MemoryRouter>)
  expect(await screen.findByText('Mon 19 Oct 2026')).toBeInTheDocument()
  expect(screen.getByText('Tue 20 Oct 2026')).toBeInTheDocument()
  expect(screen.getByText(/Week total: 9h 30m/)).toBeInTheDocument()
  expect(screen.getByText('Auto-closed at end of day')).toBeInTheDocument()
  expect(listMyVisits).toHaveBeenCalledWith('2026-10-19', '2026-10-25')
})
