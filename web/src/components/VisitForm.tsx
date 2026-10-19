import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '../lib/errors'
import type { Project } from '../lib/types'

interface Props {
  mode: 'in' | 'out'
  project: Project
  initialTask?: string
  switchingFrom?: Project
  onSubmit(task: string, workDone?: string): Promise<void>
}

export function VisitForm({ mode, project, initialTask = '', switchingFrom, onSubmit }: Props) {
  const { t } = useTranslation()
  const [task, setTask] = useState(initialTask)
  const [workDone, setWorkDone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(task.trim(), mode === 'out' ? workDone.trim() : undefined)
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="stack card">
      <h2 style={{ margin: 0 }}>
        <span className="dot" style={{ background: project.color }} />
        {t(mode === 'in' ? 'scan.checkInTitle' : 'scan.checkOutTitle', { project: project.name })}
      </h2>
      {switchingFrom && <p className="warning">{t('scan.switchWarning', { project: switchingFrom.name })}</p>}
      <label>
        {t('scan.task')}
        <textarea value={task} onChange={(e) => setTask(e.target.value)} required autoFocus={mode === 'in'} />
      </label>
      {mode === 'out' && (
        <label>
          {t('scan.workDone')}
          <textarea value={workDone} onChange={(e) => setWorkDone(e.target.value)} autoFocus />
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary big" disabled={busy || task.trim() === ''}>
        {busy ? t('scan.gettingLocation') : t(mode === 'in' ? 'scan.checkIn' : 'scan.checkOut')}
      </button>
    </form>
  )
}
