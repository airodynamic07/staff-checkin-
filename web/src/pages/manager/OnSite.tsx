import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listOpenVisits, subscribeVisits } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { durationMinutes, formatDuration, formatTime } from '../../lib/time'
import type { Lang, VisitFull } from '../../lib/types'
import { useNow } from '../../lib/useNow'

export default function OnSite() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const now = useNow()
  const [visits, setVisits] = useState<VisitFull[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    listOpenVisits().then(setVisits).catch((e) => setError(errorMessage(t, e)))
  }, [t])

  useEffect(() => {
    load()
    return subscribeVisits(load)
  }, [load])

  const byProject = new Map<string, VisitFull[]>()
  for (const v of visits ?? []) byProject.set(v.project_id, [...(byProject.get(v.project_id) ?? []), v])

  return (
    <div className="stack">
      <h1>{t('nav.onSite')}</h1>
      {error && <p className="error" role="alert">{error}</p>}
      {!visits && !error && <p className="muted">{t('app.loading')}</p>}
      {visits?.length === 0 && <p className="muted">{t('manager.onSiteEmpty')}</p>}
      {[...byProject.values()].map((group) => (
        <section key={group[0].project_id} className="card">
          <h2 style={{ marginTop: 0 }}>
            <span className="dot" style={{ background: group[0].project.color }} />
            {group[0].project.name} <span className="muted">({group.length})</span>
          </h2>
          <ul className="list">
            {group.map((v) => (
              <li key={v.id} className="row">
                <strong>{v.profile.full_name}</strong>
                <span className="muted">{t('manager.since', { time: formatTime(v.check_in_at, lang) })}</span>
                <span className="muted">· {formatDuration(durationMinutes(v, now))}</span>
                <span className="spacer" />
                <span>{v.task}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
