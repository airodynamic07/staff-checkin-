import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateRange } from '../../components/DateRange'
import { listProjects, listVisits } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { summarizeProject, type ProjectSummary as Summary } from '../../lib/summary'
import { bangkokDate, formatDuration, weekRange } from '../../lib/time'
import type { Project } from '../../lib/types'

export default function ProjectSummary() {
  const { t } = useTranslation()
  const week = weekRange(bangkokDate(new Date()))
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [from, setFrom] = useState(week.start)
  const [to, setTo] = useState(week.end)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listProjects(true).then(setProjects).catch((e) => setError(errorMessage(t, e)))
  }, [t])

  useEffect(() => {
    if (!projectId) {
      setSummary(null)
      return
    }
    let cancelled = false
    listVisits({ from, to, projectId })
      .then((v) => !cancelled && setSummary(summarizeProject(v)))
      .catch((e) => !cancelled && setError(errorMessage(t, e)))
    return () => {
      cancelled = true
    }
  }, [projectId, from, to, t])

  return (
    <div className="stack">
      <h1>{t('nav.projectSummary')}</h1>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label style={{ minWidth: 220 }}>
          {t('manager.project')}
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('manager.pickProject')}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.archived ? ` (${t('projects.archived')})` : ''}</option>)}
          </select>
        </label>
        <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {summary && summary.rows.length === 0 && <p className="muted">{t('app.none')}</p>}
      {summary && summary.rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('manager.person')}</th><th>{t('visit.task')}</th><th className="num">{t('manager.hours')}</th></tr>
              </thead>
              <tbody>
                {summary.rows.map((r) => (
                  <tr key={`${r.userId}-${r.task}`}><td>{r.name}</td><td>{r.task}</td><td className="num">{formatDuration(r.minutes)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>{t('manager.perPerson')}</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {summary.perPerson.map((p) => (
                  <tr key={p.userId}><td>{p.name}</td><td className="num">{formatDuration(p.minutes)}</td></tr>
                ))}
                <tr><th>{t('manager.grandTotal')}</th><th className="num">{formatDuration(summary.totalMinutes)}</th></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
