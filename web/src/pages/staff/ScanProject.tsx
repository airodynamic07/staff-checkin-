import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { VisitForm } from '../../components/VisitForm'
import { getOpenVisit, getProjectByCode, scanIn, scanOut } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { getPosition } from '../../lib/geo'
import { durationMinutes, formatDuration } from '../../lib/time'
import type { Project, VisitWithProject } from '../../lib/types'

export default function ScanProject() {
  const { code = '' } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [open, setOpen] = useState<VisitWithProject | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([getProjectByCode(code), getOpenVisit()])
      .then(([p, o]) => {
        if (cancelled) return
        if (!p) {
          setError(t('errors.unknown_project'))
          setState('error')
          return
        }
        if (p.archived) {
          setError(t('errors.archived_project'))
          setState('error')
          return
        }
        setProject(p)
        setOpen(o)
        setState('ready')
      })
      .catch((e) => {
        if (cancelled) return
        setError(errorMessage(t, e))
        setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [code, t])

  if (state === 'loading') return <p className="center muted">{t('app.loading')}</p>
  if (state === 'error' || !project) return <p className="error" role="alert">{error}</p>

  const here = open && open.project_id === project.id

  return here ? (
    <VisitForm
      mode="out"
      project={project}
      initialTask={open.task}
      onSubmit={async (task, workDone) => {
        const done = await scanOut(open.id, task, workDone ?? '', await getPosition())
        navigate('/', {
          replace: true,
          state: { notice: t('scan.checkedOut', { project: project.name, duration: formatDuration(durationMinutes(done)) }) },
        })
      }}
    />
  ) : (
    <VisitForm
      mode="in"
      project={project}
      switchingFrom={open?.project}
      onSubmit={async (task) => {
        const result = await scanIn(code, task, await getPosition())
        if (result.status === 'already_in') {
          // Checked in from another tab or device meanwhile: show the check-out form.
          setOpen({ ...result.visit, project })
          return
        }
        navigate('/', { replace: true, state: { notice: t('scan.checkedIn', { project: project.name }) } })
      }}
    />
  )
}
