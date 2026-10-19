export interface Position {
  lat: number
  lng: number
  accuracy: number
}

/** Current phone location, or null if refused, unavailable or slower than timeoutMs. Never rejects. */
export function getPosition(timeoutMs = 10000): Promise<Position | null> {
  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined
    if (!geo) return resolve(null)
    const timer = setTimeout(() => resolve(null), timeoutMs)
    try {
      geo.getCurrentPosition(
        (p) => {
          clearTimeout(timer)
          resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy })
        },
        () => {
          clearTimeout(timer)
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
      )
    } catch {
      clearTimeout(timer)
      resolve(null)
    }
  })
}
