import { expect, it } from 'vitest'
import i18n from '../i18n'
import { buildExportRows, toCsv } from './export'
import { makeVisit } from './fixtures'

it('builds one translated header row and one row per visit', async () => {
  await i18n.changeLanguage('en')
  const rows = buildExportRows([
    makeVisit({ work_done: 'Bathroom', in_lat: 13.75, in_lng: 100.5, auto_closed: 'end_of_day' }),
  ], 'en')
  expect(rows[0]).toEqual(['Date', 'Staff', 'Project', 'Check-in', 'Check-out', 'Hours', 'Task', 'Work done', 'Auto-closed', 'GPS in', 'GPS out'])
  expect(rows[1]).toEqual(['2026-10-19', 'สมชาย', 'Site A', '08:00', '15:05', '7.08', 'Install tiles', 'Bathroom', 'Auto-closed at end of day', '13.75,100.5', ''])
})

it('dates a midnight-crossing visit by check-in and shows full check-out date', async () => {
  await i18n.changeLanguage('en')
  const [, row] = buildExportRows([makeVisit({ check_in_at: '2026-10-19T15:00:00Z', check_out_at: '2026-10-19T18:30:00Z' })], 'en')
  expect(row.slice(0, 6)).toEqual(['2026-10-19', 'สมชาย', 'Site A', '22:00', '2026-10-20 01:30', '3.50'])
})

it('toCsv starts with a BOM so Excel reads Thai, and quotes properly', () => {
  const csv = toCsv([['งาน', 'note'], ['ปูกระเบื้อง', 'a,"b"'], ['line\nbreak', 'x']])
  expect(csv.startsWith('﻿')).toBe(true)
  expect(csv).toBe('﻿งาน,note\r\nปูกระเบื้อง,"a,""b"""\r\n"line\nbreak",x\r\n')
})

it('toCsv neutralises spreadsheet formulas but keeps negative numbers', () => {
  expect(toCsv([['=HYPERLINK("x")', '+1', '-cmd', '@SUM', '-12.5']])).toBe('\uFEFF"\'=HYPERLINK(""x"")",\'+1,\'-cmd,\'@SUM,-12.5\r\n')
})

it('toXlsx keeps Thai text and writes hours as numbers', async () => {
  const { toXlsx } = await import('./export')
  const XLSX = await import('xlsx')
  const blob = await toXlsx([['งาน', 'b', 'c', 'd', 'e', 'ชั่วโมง'], ['ปูกระเบื้อง', '', '', '', '', '7.08']])
  const book = XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array' })
  const sheet = book.Sheets[book.SheetNames[0]]
  expect(sheet.A2.v).toBe('ปูกระเบื้อง')
  expect(sheet.F2.v).toBe(7.08)
  expect(sheet.F2.t).toBe('n')
})
