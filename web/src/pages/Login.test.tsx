import { expect, it } from 'vitest'
import { safeNext } from './Login'

it('safeNext only allows in-app paths', () => {
  expect(safeNext('/scan/sitea1')).toBe('/scan/sitea1')
  expect(safeNext(null)).toBe('/')
  expect(safeNext('https://evil.example')).toBe('/')
  expect(safeNext('//evil.example')).toBe('/')
})
