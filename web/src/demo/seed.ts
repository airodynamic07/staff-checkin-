// Sample data for the demo: four staff, a manager, three sites in Bangkok and
// two weeks of visits ending today. Everything is invented.
import { addDays, bangkokDate, weekRange } from '../lib/time'
import type { FakeState, Row } from './fakeSupabase'

const PASSWORD = 'demo1234'

export const DEMO_STAFF_EMAIL = 'somchai@demo.example'
export const DEMO_MANAGER_EMAIL = 'malee@demo.example'
export const DEMO_PASSWORD = PASSWORD

/** ISO instant for a Bangkok date + 'HH:mm'. */
function at(date: string, hhmm: string): string {
  return new Date(Date.parse(`${date}T${hhmm}:00+07:00`)).toISOString()
}

export function demoSeed(today = bangkokDate(new Date())): FakeState {
  const users = [
    { id: 'u-somchai', email: DEMO_STAFF_EMAIL, password: PASSWORD },
    { id: 'u-malee', email: DEMO_MANAGER_EMAIL, password: PASSWORD },
    { id: 'u-niran', email: 'niran@demo.example', password: PASSWORD },
    { id: 'u-pim', email: 'pim@demo.example', password: PASSWORD },
    { id: 'u-arthit', email: 'arthit@demo.example', password: PASSWORD },
  ]
  const profiles: Row[] = [
    { id: 'u-somchai', full_name: 'สมชาย ใจดี (Somchai)', role: 'staff', language: 'th', active: true },
    { id: 'u-malee', full_name: 'มาลี ศรีสุข (Malee)', role: 'manager', language: 'th', active: true },
    { id: 'u-niran', full_name: 'นิรันดร์ แก้วมณี (Niran)', role: 'staff', language: 'th', active: true },
    { id: 'u-pim', full_name: 'พิมพ์ชนก รุ่งเรือง (Pim)', role: 'staff', language: 'th', active: true },
    { id: 'u-arthit', full_name: 'อาทิตย์ บุญมา (Arthit)', role: 'staff', language: 'th', active: true },
  ]
  const projects: Row[] = [
    { id: 'p-sukhumvit', code: 'skv21a', name: 'Sukhumvit 21 Condo', address: 'Sukhumvit Soi 21, Watthana, Bangkok', lat: 13.7383, lng: 100.5622, color: '#2563eb', archived: false },
    { id: 'p-rama9', code: 'rm9off', name: 'Rama 9 Office Fit-out', address: 'Rama IX Rd, Huai Khwang, Bangkok', lat: 13.7576, lng: 100.5653, color: '#e11d48', archived: false },
    { id: 'p-bangna', code: 'bnwh04', name: 'Bang Na Warehouse', address: 'Bang Na-Trat Rd km 4, Bangkok', lat: 13.6672, lng: 100.6422, color: '#16a34a', archived: false },
  ]

  // [person, project, start, end, task, work done]
  const plan: [string, string, string, string, string, string | null][] = [
    ['u-somchai', 'p-sukhumvit', '08:05', '12:00', 'ปูกระเบื้องห้องน้ำชั้น 3 (Bathroom tiles, floor 3)', 'เสร็จ 2 ห้อง'],
    ['u-somchai', 'p-rama9', '13:10', '17:20', 'ติดตั้งฝ้าเพดาน (Ceiling panels)', 'Meeting room done'],
    ['u-niran', 'p-rama9', '08:30', '17:30', 'เดินสายไฟ (Electrical wiring)', 'Zone B finished'],
    ['u-pim', 'p-bangna', '07:45', '16:00', 'ตรวจรับวัสดุ (Receive materials)', 'Steel delivery checked'],
    ['u-arthit', 'p-sukhumvit', '09:00', '15:30', 'ทาสีผนัง (Paint walls)', 'Units 301–304'],
  ]

  const visits: Row[] = []
  const thisWeek = weekRange(today).start
  let n = 0
  for (let d = addDays(thisWeek, -7); d < today; d = addDays(d, 1)) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay()
    if (dow === 0) continue // Sunday off
    for (const [user, project, start, end, task, done] of plan) {
      if (dow === 6 && user !== 'u-pim') continue // only Pim works Saturdays
      n++
      visits.push({
        id: `v-${n}`, user_id: user, project_id: project, check_in_at: at(d, start), check_out_at: at(d, end),
        task, work_done: done, in_lat: 13.74 + (n % 7) * 0.001, in_lng: 100.56 + (n % 5) * 0.001, in_accuracy_m: 12,
        out_lat: 13.74 + (n % 7) * 0.001, out_lng: 100.56 + (n % 5) * 0.001, out_accuracy_m: 15,
        auto_closed: null, edited_by: null, edited_at: null,
      })
    }
  }
  // Yesterday Arthit forgot to scan out: closed automatically at 23:59 and waiting for review.
  const forgot = [...visits].reverse().find((v) => v.user_id === 'u-arthit')
  if (forgot) Object.assign(forgot, { check_out_at: at(bangkokDate(String(forgot.check_in_at)), '23:59'), work_done: null, auto_closed: 'end_of_day', out_lat: null, out_lng: null })

  // Right now Niran and Pim are on site (Somchai is free so you can try checking in).
  const now = Date.now()
  visits.push(
    { id: 'v-open-1', user_id: 'u-niran', project_id: 'p-rama9', check_in_at: new Date(now - 3.2 * 3600e3).toISOString(), check_out_at: null, task: 'เดินสายไฟ (Electrical wiring)', work_done: null, in_lat: 13.7577, in_lng: 100.5652, in_accuracy_m: 10, out_lat: null, out_lng: null, out_accuracy_m: null, auto_closed: null, edited_by: null, edited_at: null },
    { id: 'v-open-2', user_id: 'u-pim', project_id: 'p-bangna', check_in_at: new Date(now - 1.5 * 3600e3).toISOString(), check_out_at: null, task: 'นับสต็อก (Stock count)', work_done: null, in_lat: 13.6671, in_lng: 100.6421, in_accuracy_m: 18, out_lat: null, out_lng: null, out_accuracy_m: null, auto_closed: null, edited_by: null, edited_at: null },
  )
  return { users, profiles, projects, visits }
}
