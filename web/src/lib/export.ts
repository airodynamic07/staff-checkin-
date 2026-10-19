import i18n from '../i18n'
import { bangkokDate, durationMinutes, formatTime } from './time'
import type { Lang, VisitFull } from './types'

const COLUMNS = ['date', 'staff', 'project', 'check_in', 'check_out', 'hours', 'task', 'work_done', 'auto_closed', 'in_gps', 'out_gps'] as const

function gps(lat: number | null, lng: number | null): string {
  return lat != null && lng != null ? `${lat},${lng}` : ''
}

export function buildExportRows(visits: VisitFull[], lang: Lang): string[][] {
  const t = i18n.getFixedT(lang)
  const header = COLUMNS.map((c) => t(`export.${c}`))
  const rows = visits.map((v) => {
    const day = bangkokDate(v.check_in_at)
    let out = ''
    if (v.check_out_at) {
      const outDay = bangkokDate(v.check_out_at)
      out = outDay === day ? formatTime(v.check_out_at, lang) : `${outDay} ${formatTime(v.check_out_at, lang)}`
    }
    return [
      day,
      v.profile.full_name,
      v.project.name,
      formatTime(v.check_in_at, lang),
      out,
      v.check_out_at ? (durationMinutes(v) / 60).toFixed(2) : '',
      v.task,
      v.work_done ?? '',
      v.auto_closed ? t(`visit.autoClosed.${v.auto_closed}`) : '',
      gps(v.in_lat, v.in_lng),
      gps(v.out_lat, v.out_lng),
    ]
  })
  return [header, ...rows]
}

/** Stop spreadsheet apps from running cell text as a formula. */
function neutralise(value: string): string {
  if (/^[=+@\t\r]/.test(value) || (/^-/.test(value) && !/^-[\d.,]+$/.test(value))) return `'${value}`
  return value
}

export function toCsv(rows: string[][]): string {
  const cell = (raw: string) => {
    const v = neutralise(raw)
    return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
  }
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export async function toXlsx(rows: string[][]): Promise<Blob> {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((r, i) => (i === 0 ? r : r.map((c, j) => (j === 5 && c !== '' ? Number(c) : c)))))
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Check-ins')
  const data = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
