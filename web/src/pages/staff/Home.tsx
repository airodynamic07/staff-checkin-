import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { VisitForm } from '../../components/VisitForm'
import { getOpenVisit, scanOut } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { getPosition } from '../../lib/geo'
import { durationMinutes, formatDuration, formatTime } from '../../lib/time'
import type { Lang, VisitWithProject } from '../../lib/types'
import { useNow } from '../../lib/useNow'

export default function Home() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const location = useLocation()
  const now = useNow()
  const [open, setOpen] = useState<VisitWithProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState(false)
  const [notice, setNotice] = useState<string>((location.state as { notice?: string } | null)?.notice ?? '')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setOpen(await getOpenVisit())
    } catch (e) {
      setError(errorMessage(t, e))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <p className="center muted">{t('app.loading')}</p>

  return (
    <div className="stack">
      {notice && <p className="notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {open ? (
        checkingOut ? (
          <VisitForm
            mode="out"
            project={open.project}
            initialTask={open.task}
            onSubmit={async (task, workDone) => {
              const done = await scanOut(open.id, task, workDone ?? '', await getPosition())
              setNotice(t('scan.checkedOut', { project: open.project.name, duration: formatDuration(durationMinutes(done)) }))
              setCheckingOut(false)
              setOpen(null)
            }}
          />
        ) : (
          <div className="card stack">
            <h2 style={{ margin: 0 }}>
              <span className="dot" style={{ background: open.project.color }} />
              {t('home.checkedInAt', { project: open.project.name })}
            </h2>
            <p style={{ margin: 0 }}>
              {t('home.since', { time: formatTime(open.check_in_at, lang) })} ·{' '}
              {t('home.elapsed', { duration: formatDuration(durationMinutes(open, now)) })}
            </p>
            <p className="muted" style={{ margin: 0 }}>{t('home.task')}: {open.task}</p>
            <button className="primary big" onClick={() => { setNotice(''); setCheckingOut(true) }}>{t('home.checkOut')}</button>
          </div>
        )
      ) : (
        <p className="muted">{t('home.notCheckedIn')}</p>
      )}
      {!checkingOut && (
        <Link to="/scan" className="no-underline">
          <button className={open ? 'big' : 'primary big'}>{t('home.scan')}</button>
        </Link>
      )}
    </div>
  )
}
