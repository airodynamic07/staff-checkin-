import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import type { Project } from '../lib/types'
import { VisitForm } from './VisitForm'

const siteA: Project = { id: 'a', code: 'sitea1', name: 'Site A', address: null, lat: null, lng: null, color: '#f00', archived: false }
const siteB: Project = { ...siteA, id: 'b', code: 'siteb1', name: 'Site B' }

describe('VisitForm', () => {
  it('check-in: submit disabled until a task is written', async () => {
    await i18n.changeLanguage('en')
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<VisitForm mode="in" project={siteA} onSubmit={onSubmit} />)
    const button = screen.getByRole('button', { name: 'Check in' })
    expect(button).toBeDisabled()
    await userEvent.type(screen.getByLabelText('What are you working on?'), '  ')
    expect(button).toBeDisabled()
    await userEvent.type(screen.getByLabelText('What are you working on?'), 'Install tiles')
    await userEvent.click(button)
    expect(onSubmit).toHaveBeenCalledWith('Install tiles', undefined)
  })

  it('check-out: task pre-filled, work done submitted', async () => {
    await i18n.changeLanguage('en')
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<VisitForm mode="out" project={siteA} initialTask="Install tiles" onSubmit={onSubmit} />)
    expect(screen.getByLabelText('What are you working on?')).toHaveValue('Install tiles')
    await userEvent.type(screen.getByLabelText('What did you do?'), 'Bathroom done')
    await userEvent.click(screen.getByRole('button', { name: 'Check out' }))
    expect(onSubmit).toHaveBeenCalledWith('Install tiles', 'Bathroom done')
  })

  it('warns when checking in will close a visit at another project', async () => {
    await i18n.changeLanguage('en')
    render(<VisitForm mode="in" project={siteA} switchingFrom={siteB} onSubmit={vi.fn()} />)
    expect(screen.getByText('This will check you out of Site B.')).toBeInTheDocument()
  })

  it('shows translated error codes from the server', async () => {
    await i18n.changeLanguage('th')
    const { ApiError } = await import('../lib/api')
    const onSubmit = vi.fn().mockRejectedValue(new ApiError('archived_project'))
    render(<VisitForm mode="in" project={siteA} onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('กำลังทำงานอะไร?'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'ลงเวลาเข้า' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('โครงการนี้ปิดแล้ว')
  })
})
