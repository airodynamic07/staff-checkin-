import { expect, it } from 'vitest'
import en from './en.json'
import th from './th.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

it('English and Thai have the same keys', () => {
  expect(keys(th).sort()).toEqual(keys(en).sort())
})
