// Supabase returns at most 1000 rows per request (PostgREST max_rows), so
// reports fetch page by page until a short page comes back.
export const PAGE_SIZE = 1000

type Page<T> = { data: T[] | null; error: { message?: string } | null }

export async function fetchAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return all
  }
}
