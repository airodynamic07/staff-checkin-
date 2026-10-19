import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitch } from '../../components/LanguageSwitch'
import { updateProfile } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { errorMessage } from '../../lib/errors'

export default function Settings() {
  const { t } = useTranslation()
  const { profile, session, refreshProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [message, setMessage] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!profile || name.trim() === '') return
    try {
      await updateProfile(profile.id, { full_name: name.trim() })
      await refreshProfile()
      setMessage(t('app.save') + ' ✓')
    } catch (err) {
      setMessage(errorMessage(t, err))
    }
  }

  return (
    <div className="stack">
      <h1>{t('settings.title')}</h1>
      <p className="muted">{session?.user.email}</p>
      <form onSubmit={save} className="stack card">
        <label>
          {t('settings.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <button className="primary">{t('app.save')}</button>
        {message && <p role="status">{message}</p>}
      </form>
      <div className="row">
        <span>{t('app.language')}</span>
        <LanguageSwitch />
      </div>
      <button className="danger" onClick={() => void signOut()}>{t('app.logout')}</button>
    </div>
  )
}
