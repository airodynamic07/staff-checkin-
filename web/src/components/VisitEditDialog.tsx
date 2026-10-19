import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { updateVisit } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { fromBangkokInput, toBangkokInput } from '../lib/time'
import type { VisitFull } from '../lib/types'
import { VisitBadges } from './VisitBadges'

function GpsLink({ lat, lng, label }: { lat: number | null; lng: number | null; label: string }) {
  const { t } = useTranslation()
  return (
    <div>
      {label}:{' '}
      {lat != null && lng != null ? (
        <a href={`https://maps.google.com/?q=${lat},${lng}`} target="_blank" rel="noreferrer">
          {t('visit.map')} ({lat.toFixed(5)}, {lng.toFixed(5)})
        </a>
      ) : (
        <span className="muted">{t('visit.noGps')}</span>
      )}
    </div>
  )
}

interface Props {
  visit: VisitFull
  onSaved(): void
  onClose(): void
}

export function VisitEditDialog({ visit, onSaved, onClose }: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const [checkIn, setCheckIn] = useState(toBangkokInput(visit.check_in_at))
  const [checkOut, setCheckOut] = useState(visit.check_out_at ? toBangkokInput(visit.check_out_at) : '')
  const [task, setTask] = useState(visit.task)
  const [workDone, setWorkDone] = useState(visit.work_done ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (!d || d.open) return
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateVisit(visit.id, fromBangkokInput(checkIn), checkOut ? fromBangkokInput(checkOut) : null, task, workDone)
      onSaved()
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <form onSubmit={save} className="stack">
        <h2 style={{ margin: 0 }}>
          <span className="dot" style={{ background: visit.project.color }} />
          {visit.profile.full_name} · {visit.project.name}
        </h2>
        <VisitBadges visit={visit} />
        <label>
          {t('visit.checkIn')}
          <input type="datetime-local" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
        </label>
        <label>
          {t('visit.checkOut')}
          <input type="datetime-local" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </label>
        <label>
          {t('visit.task')}
          <textarea value={task} onChange={(e) => setTask(e.target.value)} required />
        </label>
        <label>
          {t('visit.workDone')}
          <textarea value={workDone} onChange={(e) => setWorkDone(e.target.value)} />
        </label>
        <GpsLink lat={visit.in_lat} lng={visit.in_lng} label={t('visit.gpsIn')} />
        <GpsLink lat={visit.out_lat} lng={visit.out_lng} label={t('visit.gpsOut')} />
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <span className="spacer" />
          <button type="button" onClick={onClose}>{t('app.cancel')}</button>
          <button className="primary" disabled={busy}>{t('app.save')}</button>
        </div>
      </form>
    </dialog>
  )
}
