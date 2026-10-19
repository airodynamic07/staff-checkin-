import { useTranslation } from 'react-i18next'
import { applyLanguage } from '../i18n'
import { updateProfile } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Lang } from '../lib/types'

export function LanguageSwitch() {
  const { i18n, t } = useTranslation()
  const { profile } = useAuth()
  const current = (i18n.language === 'en' ? 'en' : 'th') as Lang

  async function choose(lang: Lang) {
    await applyLanguage(lang)
    if (profile) await updateProfile(profile.id, { language: lang }).catch(() => undefined)
  }

  return (
    <div className="lang-switch" role="group" aria-label={t('app.language')}>
      {(['th', 'en'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          className={lang === current ? 'active' : ''}
          aria-pressed={lang === current}
          onClick={() => void choose(lang)}
        >
          {lang === 'th' ? 'ไทย' : 'EN'}
        </button>
      ))}
    </div>
  )
}
