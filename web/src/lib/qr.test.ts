import { expect, it } from 'vitest'
import { projectCodeFromQr, projectQrUrl } from './qr'

it('reads the project code from a scanned link', () => {
  expect(projectCodeFromQr('https://checkin.example.com/scan/k7f3qp')).toBe('k7f3qp')
  expect(projectCodeFromQr('https://checkin.example.com/scan/k7f3qp/?x=1')).toBe('k7f3qp')
  expect(projectCodeFromQr('k7f3qp')).toBe('k7f3qp')
  expect(projectCodeFromQr('https://example.com/other/page')).toBeNull()
  expect(projectCodeFromQr('hello world')).toBeNull()
})

it('builds the link printed on the QR code', () => {
  expect(projectQrUrl('https://checkin.example.com/', 'k7f3qp')).toBe('https://checkin.example.com/scan/k7f3qp')
})
