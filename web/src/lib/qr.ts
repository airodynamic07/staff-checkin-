const CODE = /^[a-z0-9]{4,32}$/i

/** Project code from scanned QR text: a /scan/<code> link or a bare code. */
export function projectCodeFromQr(text: string): string | null {
  const trimmed = text.trim()
  if (CODE.test(trimmed)) return trimmed
  try {
    const m = new URL(trimmed).pathname.match(/\/scan\/([^/]+)\/?$/)
    return m && CODE.test(m[1]) ? m[1] : null
  } catch {
    return null
  }
}

export function projectQrUrl(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/+$/, '')}/scan/${code}`
}
