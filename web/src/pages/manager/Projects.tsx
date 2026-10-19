import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { listProjects, saveProject, type ProjectInput } from '../../lib/api'
import { nextColor } from '../../lib/colors'
import { errorMessage } from '../../lib/errors'
import type { Project } from '../../lib/types'

type Draft = { id?: string; name: string; address: string; lat: string; lng: string; color: string }

function toDraft(p: Project): Draft {
  return { id: p.id, name: p.name, address: p.address ?? '', lat: p.lat?.toString() ?? '', lng: p.lng?.toString() ?? '', color: p.color }
}

function toInput(d: Draft): ProjectInput {
  const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s))
  return { name: d.name.trim(), address: d.address.trim() || null, lat: num(d.lat), lng: num(d.lng), color: d.color }
}

export default function Projects() {
  const { t } = useTranslation()
  const [projects, setProjects] = useState<Project[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    listProjects(true).then(setProjects).catch((e) => setError(errorMessage(t, e)))
  }, [t])
  useEffect(load, [load])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    try {
      await saveProject({ ...toInput(draft), id: draft.id })
      setDraft(null)
      load()
    } catch (err) {
      setError(errorMessage(t, err))
    }
  }

  async function setArchived(p: Project, archived: boolean) {
    try {
      await saveProject({ ...toInput(toDraft(p)), id: p.id, archived })
      load()
    } catch (err) {
      setError(errorMessage(t, err))
    }
  }

  const visible = projects.filter((p) => showArchived || !p.archived)

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>{t('nav.projects')}</h1>
        <span className="spacer" />
        <label className="inline">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          {t('projects.showArchived')}
        </label>
        <button
          className="primary"
          onClick={() => setDraft({ name: '', address: '', lat: '', lng: '', color: nextColor(projects.filter((p) => !p.archived).map((p) => p.color)) })}
        >
          {t('projects.add')}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {draft && (
        <form onSubmit={save} className="card stack">
          <h2 style={{ margin: 0 }}>{t(draft.id ? 'projects.edit' : 'projects.add')}</h2>
          <label>{t('projects.name')}<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
          <label>{t('projects.address')}<input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></label>
          <div className="row">
            <label style={{ flex: 1 }}>{t('projects.lat')}<input inputMode="decimal" value={draft.lat} onChange={(e) => setDraft({ ...draft, lat: e.target.value })} /></label>
            <label style={{ flex: 1 }}>{t('projects.lng')}<input inputMode="decimal" value={draft.lng} onChange={(e) => setDraft({ ...draft, lng: e.target.value })} /></label>
            <label>{t('projects.color')}<input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} style={{ width: 64, padding: 2 }} /></label>
          </div>
          <div className="row">
            <span className="spacer" />
            <button type="button" onClick={() => setDraft(null)}>{t('app.cancel')}</button>
            <button className="primary">{t('app.save')}</button>
          </div>
        </form>
      )}
      {visible.length === 0 && <p className="muted">{t('app.none')}</p>}
      <ul className="list">
        {visible.map((p) => (
          <li key={p.id} className="card row">
            <span className="dot" style={{ background: p.color }} />
            <div className="stack" style={{ gap: '.1rem' }}>
              <strong>{p.name} {p.archived && <span className="badge">{t('projects.archived')}</span>}</strong>
              <span className="muted">{t('projects.code')}: {p.code}{p.address ? ` · ${p.address}` : ''}</span>
            </div>
            <span className="spacer" />
            {!p.archived && <Link to={`/manager/projects/${p.id}/qr`}><button>{t('projects.printQr')}</button></Link>}
            <button onClick={() => setDraft(toDraft(p))}>{t('projects.edit')}</button>
            <button onClick={() => void setArchived(p, !p.archived)}>{t(p.archived ? 'projects.unarchive' : 'projects.archive')}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
