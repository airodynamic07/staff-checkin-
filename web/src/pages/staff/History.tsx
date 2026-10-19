import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { VisitBadges } from '../../components/VisitBadges'
import { WeekPicker } from '../../components/WeekPicker'
import { listMyVisits } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { addDays, bangkokDate, durationMinutes, formatDate, formatDuration, formatTime, groupVisitsByDay, weekRange } from '../../lib/time'
import type { Lang, VisitWithProject } from '../../lib/types'
import { useNow } from '../../lib/useNow'

export default function History({ initialDate }: { initialDate?: string }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const now = useNow()
  const [start, setStart] = useState(() => weekRange(initialDate ?? bangkokDate(new Date())).start)
  const [visits, setVisits] = useState<VisitWithProject[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setVisits(null)
    listMyVisits(start, addDays(start, 6))
      .then((v) => !cancelled && setVisits(v))
      .catch((e) => !cancelled && setError(errorMessage(t, e)))
    return () => {
      cancelled = true
    }
  }, [start, t])

  const days = visits ? groupVisitsByDay(visits, now) : []
  const weekTotal = days.reduce((s, d) => s + d.totalMinutes, 0)

  return (
    <div className="stack">
      <h1>{t('history.title')}</h1>
      <WeekPicker start={start} onChange={setStart} />
      {error && <p className="error" role="alert">{error}</p>}
      {!visits && !error && <p className="muted">{t('app.loading')}</p>}
      {visits && days.length === 0 && <p className="muted">{t('app.none')}</p>}
      {days.map((day) => (
        <section key={day.date}>
          <h3 className="row">
            <span>{formatDate(day.visits[0].check_in_at, lang)}</span>
            <span className="spacer" />
            <span className="muted">{t('history.dayTotal')}: {formatDuration(day.totalMinutes)}</span>
          </h3>
          <ul className="list">
            {day.visits.map((v) => (
              <li key={v.id} className="card">
                <div className="row">
                  <span><span className="dot" style={{ background: v.project.color }} /><strong>{v.project.name}</strong></span>
                  <span className="spacer" />
                  <span>{formatDuration(durationMinutes(v, now))}</span>
                </div>
                <div className="muted">
                  {formatTime(v.check_in_at, lang)} – {v.check_out_at ? formatTime(v.check_out_at, lang) : t('history.open')}
                </div>
                <div>{v.task}</div>
                {v.work_done && <div className="muted">{v.work_done}</div>}
                <VisitBadges visit={v} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {visits && days.length > 0 && <p><strong>{t('history.weekTotal')}: {formatDuration(weekTotal)}</strong></p>}
    </div>
  )
}
