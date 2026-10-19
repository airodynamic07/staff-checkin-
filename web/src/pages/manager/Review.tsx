import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { VisitBadges } from '../../components/VisitBadges'
import { VisitEditDialog } from '../../components/VisitEditDialog'
import { listUnreviewedAutoClosed } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { durationMinutes, formatDate, formatDuration, formatTime } from '../../lib/time'
import type { Lang, VisitFull } from '../../lib/types'

export default function Review() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const [visits, setVisits] = useState<VisitFull[] | null>(null)
  const [editing, setEditing] = useState<VisitFull | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    listUnreviewedAutoClosed().then(setVisits).catch((e) => setError(errorMessage(t, e)))
  }, [t])
  useEffect(load, [load])

  return (
    <div className="stack">
      <h1>{t('nav.review')}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {!visits && !error && <p className="muted">{t('app.loading')}</p>}
      {visits?.length === 0 && <p className="muted">{t('manager.reviewEmpty')}</p>}
      <ul className="list">
        {visits?.map((v) => (
          <li key={v.id} className="card row">
            <div className="stack" style={{ gap: '.2rem' }}>
              <strong>{v.profile.full_name} · <span className="dot" style={{ background: v.project.color }} />{v.project.name}</strong>
              <span className="muted">
                {formatDate(v.check_in_at, lang)} · {formatTime(v.check_in_at, lang)} – {v.check_out_at && formatTime(v.check_out_at, lang)} ·{' '}
                {formatDuration(durationMinutes(v))}
              </span>
              <span>{v.task}</span>
              <VisitBadges visit={v} />
            </div>
            <span className="spacer" />
            <button className="primary" onClick={() => setEditing(v)}>{t('manager.editVisit')}</button>
          </li>
        ))}
      </ul>
      {editing && (
        <VisitEditDialog
          visit={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
