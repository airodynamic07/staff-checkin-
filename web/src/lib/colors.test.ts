import { expect, it } from 'vitest'
import { nextColor, PALETTE } from './colors'

it('picks the first unused colour, cycling when all are used', () => {
  expect(PALETTE).toHaveLength(10)
  expect(new Set(PALETTE).size).toBe(10)
  expect(nextColor([])).toBe(PALETTE[0])
  expect(nextColor([PALETTE[0], PALETTE[2]])).toBe(PALETTE[1])
  expect(nextColor([PALETTE[0].toUpperCase()])).toBe(PALETTE[1])
  expect(nextColor([...PALETTE, PALETTE[0]])).toBe(PALETTE[1])
})
