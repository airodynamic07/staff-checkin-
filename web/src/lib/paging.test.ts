import { expect, it, vi } from 'vitest'
import { fetchAllPages } from './paging'

it('keeps fetching pages until a short page comes back', async () => {
  const rows = Array.from({ length: 2500 }, (_, i) => i)
  const fetchPage = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + 1000)), error: null }))
  await expect(fetchAllPages(fetchPage)).resolves.toHaveLength(2500)
  expect(fetchPage.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
})

it('stops on error', async () => {
  const fetchPage = vi.fn(async () => ({ data: null, error: { message: 'boom' } }))
  await expect(fetchAllPages(fetchPage)).rejects.toMatchObject({ message: 'boom' })
})
