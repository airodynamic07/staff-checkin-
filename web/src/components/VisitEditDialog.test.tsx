import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { ApiError } from '../lib/api'
import type { VisitFull } from '../lib/types'

const updateVisit = vi.fn()
vi.mock('../lib/api', async (orig) => ({ ...(await orig<object>()), updateVisit: (...a: unknown[]) => updateVisit(...a) }))

const visit: VisitFull = {
  id: 'v1', user_id: 'u', project_id: 'p', check_in_at: '2026-10-19T00:30:00Z', check_out_at: '2026-10-19T16:59:00Z',
  task: 'Install tiles', work_done: null, in_lat: 13.75, in_lng: 100.5, in_accuracy_m: 10, out_lat: null, out_lng: null,
  out_accuracy_m: null, auto_closed: 'end_of_day', edited_by: null, edited_at: null,
  project: { id: 'p', code: 'sitea1', name: 'Site A', address: null, lat: null, lng: null, color: '#f00', archived: false },
  profile: { id: 'u', full_name: 'Somchai', role: 'staff', language: 'th', active: true },
}

beforeEach(async () => {
  await i18n.changeLanguage('en')
  updateVisit.mockReset()
})

it('shows Bangkok times and saves them as UTC', async () => {
  updateVisit.mockResolvedValue({})
  const onSaved = vi.fn()
  const { VisitEditDialog } = await import('./VisitEditDialog')
  render(<VisitEditDialog visit={visit} onSaved={onSaved} onClose={vi.fn()} />)
  expect(screen.getByLabelText('Check-in')).toHaveValue('2026-10-19T07:30')
  expect(screen.getByLabelText('Check-out')).toHaveValue('2026-10-19T23:59')
  fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: '2026-10-19T17:00' } })
  fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: '2026-10-19T08:00' } })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(updateVisit).toHaveBeenCalledWith('v1', '2026-10-19T01:00:00.000Z', '2026-10-19T10:00:00.000Z', 'Install tiles', '')
  expect(onSaved).toHaveBeenCalled()
  expect(screen.getByRole('link', { name: /Map/ })).toHaveAttribute('href', 'https://maps.google.com/?q=13.75,100.5')
})

it('shows the bad_times message from the server', async () => {
  updateVisit.mockRejectedValue(new ApiError('bad_times'))
  const { VisitEditDialog } = await import('./VisitEditDialog')
  render(<VisitEditDialog visit={visit} onSaved={vi.fn()} onClose={vi.fn()} />)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Check-out must be after check-in.')
})
