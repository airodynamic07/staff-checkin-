import { useTranslation } from 'react-i18next'
import type { Visit } from '../lib/types'

export function VisitBadges({ visit }: { visit: Visit }) {
  const { t } = useTranslation()
  return (
    <>
      {visit.auto_closed && (
        <span className={visit.edited_at ? 'badge ok' : 'badge'}>
          {t(`visit.autoClosed.${visit.auto_closed}`)}
          {visit.edited_at ? ` · ${t('visit.fixed')}` : ''}
        </span>
      )}
      {!visit.auto_closed && visit.edited_at && <span className="badge ok">{t('visit.edited')}</span>}
    </>
  )
}
