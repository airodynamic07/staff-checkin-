import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router-dom'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

/** Only allow redirects to paths inside this app. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

export default function Login() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={safeNext(params.get('next'))} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(t('login.failed'))
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-head">
          <h1>{t('app.name')}</h1>
          <LanguageSwitch />
        </div>
        <form onSubmit={submit} className="stack">
          <label>
            {t('login.email')}
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            {t('login.password')}
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" disabled={busy}>{t('login.submit')}</button>
        </form>
      </div>
    </div>
  )
}
