import { useTranslation } from 'react-i18next'

export function DateRange({ from, to, onChange }: { from: string; to: string; onChange(from: string, to: string): void }) {
  const { t } = useTranslation()
  return (
    <>
      <label>
        {t('app.from')}
        <input type="date" value={from} max={to} onChange={(e) => e.target.value && onChange(e.target.value, to)} />
      </label>
      <label>
        {t('app.to')}
        <input type="date" value={to} min={from} onChange={(e) => e.target.value && onChange(from, e.target.value)} />
      </label>
    </>
  )
}
