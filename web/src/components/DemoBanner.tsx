import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IS_DEMO, resetDemo } from '../demo'
import { supabase } from '../lib/supabase'

export function DemoBanner() {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  if (!IS_DEMO) return null
  return (
    <div className="demo-banner" role="note">
      <span>{t('demo.banner')}</span>
      {confirming ? (
        <span className="row">
          <button
            type="button"
            className="danger"
            onClick={async () => {
              resetDemo()
              await supabase.auth.signOut()
              window.location.reload()
            }}
          >
            {t('demo.resetConfirm')}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>{t('app.cancel')}</button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>{t('demo.reset')}</button>
      )}
    </div>
  )
}
