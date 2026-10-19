// Time helpers. Every date and clock time the app shows is in Bangkok time.
import type { Lang, Visit } from './types'

export const TZ = 'Asia/Bangkok'
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000 // UTC+7, no daylight saving

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })

/** 'YYYY-MM-DD' of the instant in Bangkok. */
export function bangkokDate(iso: string | Date): string {
  return ymd.format(typeof iso === 'string' ? new Date(iso) : iso)
}

/** UTC instant of 00:00 Bangkok time on the given 'YYYY-MM-DD'. */
export function bangkokMidnight(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00Z`) - BANGKOK_OFFSET_MS)
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function durationMinutes(v: Pick<Visit, 'check_in_at' | 'check_out_at'>, now: Date = new Date()): number {
  const end = v.check_out_at ? Date.parse(v.check_out_at) : now.getTime()
  return Math.max(0, Math.round((end - Date.parse(v.check_in_at)) / 60000))
}

export function formatDuration(min: number): string {
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`
}

export function formatTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(iso))
}

export function formatDate(iso: string, lang: Lang): string {
  const opts: Intl.DateTimeFormatOptions = { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  if (lang === 'th') return new Intl.DateTimeFormat('th-TH', opts).format(new Date(iso))
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', opts).formatToParts(new Date(iso)).map((p) => [p.type, p.value]))
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`
}

/** Visits grouped by their Bangkok check-in date, newest day first. */
export function groupVisitsByDay<V extends Visit>(visits: V[], now: Date = new Date()) {
  const byDay = new Map<string, V[]>()
  for (const v of visits) {
    const day = bangkokDate(v.check_in_at)
    byDay.set(day, [...(byDay.get(day) ?? []), v])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, vs]) => {
      const sorted = vs.sort((a, b) => a.check_in_at.localeCompare(b.check_in_at))
      return { date, visits: sorted, totalMinutes: sorted.reduce((s, v) => s + durationMinutes(v, now), 0) }
    })
}

/** Monday–Sunday week containing the given 'YYYY-MM-DD'. */
export function weekRange(date: string): { start: string; end: string } {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
  const start = addDays(date, -((dow + 6) % 7))
  return { start, end: addDays(start, 6) }
}

/** ISO instant → 'YYYY-MM-DDTHH:mm' in Bangkok, for <input type="datetime-local">. */
export function toBangkokInput(iso: string): string {
  return new Date(Date.parse(iso) + BANGKOK_OFFSET_MS).toISOString().slice(0, 16)
}

/** 'YYYY-MM-DDTHH:mm' typed in Bangkok time → ISO instant. */
export function fromBangkokInput(value: string): string {
  return new Date(Date.parse(`${value}:00Z`) - BANGKOK_OFFSET_MS).toISOString()
}
