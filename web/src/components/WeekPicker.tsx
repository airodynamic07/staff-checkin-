import { useTranslation } from 'react-i18next'
import { addDays, bangkokDate, formatDate, weekRange } from '../lib/time'
import type { Lang } from '../lib/types'

/** Prev / this / next week buttons; `start` is the Monday 'YYYY-MM-DD'. */
export function WeekPicker({ start, onChange }: { start: string; onChange(start: string): void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const end = addDays(start, 6)
  const label = `${formatDate(`${start}T05:00:00Z`, lang)} – ${formatDate(`${end}T05:00:00Z`, lang)}`
  return (
    <div className="row">
      <button type="button" aria-label={t('app.prevWeek')} onClick={() => onChange(addDays(start, -7))}>‹</button>
      <strong>{label}</strong>
      <button type="button" aria-label={t('app.nextWeek')} onClick={() => onChange(addDays(start, 7))}>›</button>
      <button type="button" onClick={() => onChange(weekRange(bangkokDate(new Date())).start)}>{t('app.thisWeek')}</button>
    </div>
  )
}
