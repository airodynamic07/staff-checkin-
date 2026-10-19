import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateRange } from '../../components/DateRange'
import { listProfiles, listProjects, listVisits } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { buildExportRows, downloadBlob, toCsv, toXlsx } from '../../lib/export'
import { bangkokDate, weekRange } from '../../lib/time'
import type { Lang, Profile, Project } from '../../lib/types'

export default function Export() {
  const { t, i18n } = useTranslation()
  const week = weekRange(bangkokDate(new Date()))
  const [from, setFrom] = useState(week.start)
  const [to, setTo] = useState(week.end)
  const [userId, setUserId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [people, setPeople] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([listProfiles(), listProjects(true)])
      .then(([pe, pr]) => { setPeople(pe); setProjects(pr) })
      .catch((e) => setError(errorMessage(t, e)))
  }, [t])

  async function download(kind: 'csv' | 'xlsx') {
    setBusy(true)
    setError('')
    try {
      const visits = await listVisits({ from, to, userId: userId || undefined, projectId: projectId || undefined })
      const rows = buildExportRows(visits, i18n.language as Lang)
      const blob = kind === 'csv' ? new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }) : await toXlsx(rows)
      downloadBlob(blob, `checkins_${from}_${to}.${kind}`)
    } catch (e) {
      setError(errorMessage(t, e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <h1>{t('nav.export')}</h1>
      <div className="card stack">
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <DateRange from={from} to={to} onChange={(f, tt) => { setFrom(f); setTo(tt) }} />
        </div>
        <label>
          {t('manager.staff')}
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">{t('app.all')}</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </label>
        <label>
          {t('manager.project')}
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">{t('app.all')}</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row">
          <button className="primary" disabled={busy} onClick={() => void download('xlsx')}>{t('manager.downloadXlsx')}</button>
          <button disabled={busy} onClick={() => void download('csv')}>{t('manager.downloadCsv')}</button>
        </div>
      </div>
    </div>
  )
}
