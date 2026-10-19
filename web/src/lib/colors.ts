// Distinct project colours for timetable blocks.
export const PALETTE = [
  '#2563eb', '#e11d48', '#16a34a', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569',
]

export function nextColor(used: string[]): string {
  const taken = new Set(used.map((c) => c.toLowerCase()))
  return PALETTE.find((c) => !taken.has(c)) ?? PALETTE[used.length % PALETTE.length]
}
