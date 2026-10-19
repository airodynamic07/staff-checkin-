import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SetPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError(t('login.passwordTooShort'))
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(t('errors.generic'))
    else navigate('/', { replace: true })
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{t('login.setPasswordTitle')}</h1>
        <form onSubmit={submit} className="stack">
          <label>
            {t('login.newPassword')}
            <input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={busy}>{t('login.setPasswordSubmit')}</button>
        </form>
      </div>
    </div>
  )
}
