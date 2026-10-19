import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { FakeSupabase } from './fake-supabase'

async function logIn(page: Page, email: string) {
  await page.getByLabel(/Email|อีเมล/).fill(email)
  await page.getByLabel(/^Password$|^รหัสผ่าน$/).fill('password123')
  await page.getByRole('button', { name: /Log in|เข้าสู่ระบบ/ }).click()
}

test('staff checks in and out by QR link; manager sees the timetable and exports it', async ({ page }) => {
  const backend = new FakeSupabase()
  await backend.install(page)

  // Staff opens the QR link while logged out → login → back to the scan page.
  await page.goto('/scan/sitea1')
  await expect(page).toHaveURL(/\/login\?next=%2Fscan%2Fsitea1/)
  await logIn(page, 'staff@example.com')
  await expect(page.getByRole('heading', { name: 'Check in at Site A' })).toBeVisible()

  await page.getByLabel('What are you working on?').fill('Install tiles')
  await page.getByRole('button', { name: 'Check in' }).click()
  await expect(page.getByRole('status')).toHaveText('Checked in at Site A.')
  await expect(page.getByText('Checked in at Site A')).toHaveCount(2)
  expect(backend.visits[0]).toMatchObject({ task: 'Install tiles', in_lat: 13.7563, in_lng: 100.5018 })

  // Scanning the same QR again shows the check-out form with the task filled in.
  await page.goto('/scan/sitea1')
  await expect(page.getByRole('heading', { name: 'Check out of Site A' })).toBeVisible()
  await expect(page.getByLabel('What are you working on?')).toHaveValue('Install tiles')
  await page.getByLabel('What did you do?').fill('Bathroom floor done')
  await page.getByRole('button', { name: 'Check out' }).click()
  await expect(page.getByRole('status')).toHaveText('Checked out of Site A. You stayed 2h 15m.')
  await expect(page.getByText('You are not checked in.')).toBeVisible()

  // Staff history lists the visit.
  await page.getByRole('link', { name: 'My history' }).click()
  await expect(page.getByText('Install tiles')).toBeVisible()
  await expect(page.getByText(/Week total: 2h 15m/)).toBeVisible()

  // Thai switch translates the screen.
  await page.getByRole('button', { name: 'ไทย' }).click()
  await expect(page.getByRole('heading', { name: 'ประวัติของฉัน' })).toBeVisible()
  await page.getByRole('button', { name: 'EN' }).click()

  // Staff cannot open manager pages.
  await page.goto('/manager/timetable')
  await expect(page).toHaveURL(/\/$/)

  // Manager: timetable shows the visit block.
  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.goto('/login?next=%2Fmanager%2Ftimetable%3Fstaff%3Du-staff')
  await logIn(page, 'manager@example.com')
  await expect(page.getByRole('heading', { name: 'Timetable' })).toBeVisible()
  await expect(page.locator('.fc-event', { hasText: 'Site A · Install tiles' })).toBeVisible()
  await expect(page.getByText('Total: 2h 15m')).toBeVisible()

  // Clicking the block opens the edit dialog with GPS.
  await page.locator('.fc-event', { hasText: 'Install tiles' }).click()
  await expect(page.getByRole('link', { name: /Map/ }).first()).toHaveAttribute('href', 'https://maps.google.com/?q=13.7563,100.5018')
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Export CSV contains the visit.
  await page.getByRole('link', { name: 'Export' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download CSV' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^checkins_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = await readFile((await download.path())!, 'utf8')
  expect(csv.charCodeAt(0)).toBe(0xfeff)
  expect(csv).toContain('Somchai,Site A')
  expect(csv).toContain('2.25,Install tiles,Bathroom floor done')
})
