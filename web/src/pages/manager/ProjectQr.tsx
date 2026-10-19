import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { getProject } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { projectQrUrl } from '../../lib/qr'
import { APP_URL } from '../../lib/supabase'
import type { Project } from '../../lib/types'

export default function ProjectQr() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const [project, setProject] = useState<Project | null>(null)
  const [image, setImage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getProject(id)
      .then(async (p) => {
        if (!p) return setError(t('errors.unknown_project'))
        setProject(p)
        setImage(await QRCode.toDataURL(projectQrUrl(APP_URL, p.code), { width: 1024, margin: 2, errorCorrectionLevel: 'M' }))
      })
      .catch((e) => setError(errorMessage(t, e)))
  }, [id, t])

  if (error) return <p className="error" role="alert">{error}</p>
  if (!project || !image) return <p className="muted">{t('app.loading')}</p>

  return (
    <div className="stack">
      <div className="row no-print">
        <Link to="/manager/projects">‹ {t('app.back')}</Link>
        <span className="spacer" />
        <button className="primary" onClick={() => window.print()}>{t('projects.print')}</button>
      </div>
      <div className="qr-sheet">
        <h1>{project.name}</h1>
        <img src={image} alt={projectQrUrl(APP_URL, project.code)} />
        <p className="qr-caption">{t('projects.qrCaption')}</p>
        <p className="muted">{projectQrUrl(APP_URL, project.code)}</p>
      </div>
    </div>
  )
}
