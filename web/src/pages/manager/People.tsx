import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { inviteUser, listProfiles, updateProfile } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { errorMessage } from '../../lib/errors'
import type { Profile, Role } from '../../lib/types'

export default function People() {
  const { t } = useTranslation()
  const { profile: me } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    listProfiles().then(setPeople).catch((e) => setError(errorMessage(t, e)))
  }, [t])
  useEffect(load, [load])

  async function invite(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await inviteUser(email.trim(), name.trim(), role)
      setNotice(t('people.inviteSent', { email: email.trim() }))
      setEmail('')
      setName('')
      setRole('staff')
      load()
    } catch (err) {
      setError(errorMessage(t, err))
    } finally {
      setBusy(false)
    }
  }

  async function change(p: Profile, patch: Partial<Pick<Profile, 'role' | 'active' | 'full_name'>>) {
    setError('')
    try {
      await updateProfile(p.id, patch)
      load()
    } catch (err) {
      setError(errorMessage(t, err))
    }
  }

  return (
    <div className="stack">
      <h1>{t('nav.people')}</h1>
      <form onSubmit={invite} className="card stack">
        <h2 style={{ margin: 0 }}>{t('people.invite')}</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label style={{ flex: 2, minWidth: 200 }}>{t('people.email')}<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label style={{ flex: 2, minWidth: 160 }}>{t('people.name')}<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label style={{ flex: 1, minWidth: 120 }}>
            {t('people.role')}
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="staff">{t('people.roles.staff')}</option>
              <option value="manager">{t('people.roles.manager')}</option>
            </select>
          </label>
          <button className="primary" disabled={busy}>{t('people.invite')}</button>
        </div>
        {notice && <p className="notice" role="status">{notice}</p>}
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>{t('people.name')}</th><th>{t('people.role')}</th><th>{t('people.active')}</th></tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const self = p.id === me?.id
              return (
                <tr key={p.id} className={p.active ? '' : 'muted'}>
                  <td>{p.full_name}{self && <span className="muted"> ({t('people.you')})</span>}</td>
                  <td>
                    <select value={p.role} disabled={self} onChange={(e) => void change(p, { role: e.target.value as Role })} aria-label={t('people.role')}>
                      <option value="staff">{t('people.roles.staff')}</option>
                      <option value="manager">{t('people.roles.manager')}</option>
                    </select>
                  </td>
                  <td>
                    <button disabled={self} onClick={() => void change(p, { active: !p.active })}>
                      {t(p.active ? 'people.deactivate' : 'people.activate')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
