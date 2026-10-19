import { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { projectCodeFromQr } from '../../lib/qr'

const READER_ID = 'qr-reader'

export default function Scan() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const handled = useRef(false)

  useEffect(() => {
    const scanner = new Html5Qrcode(READER_ID, false)
    let started = false
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          if (handled.current) return
          const code = projectCodeFromQr(text)
          if (!code) {
            setError(t('scan.notAProjectCode'))
            return
          }
          handled.current = true
          navigate(`/scan/${code}`)
        },
        () => undefined,
      )
      .then(() => {
        started = true
      })
      .catch(() => setError(t('scan.cameraDenied')))
    return () => {
      if (started) void scanner.stop().catch(() => undefined)
    }
  }, [navigate, t])

  return (
    <div className="stack">
      <h1>{t('scan.title')}</h1>
      <div id={READER_ID} style={{ width: '100%', maxWidth: 420, margin: '0 auto' }} />
      {error && <p className="warning" role="alert">{error}</p>}
    </div>
  )
}
