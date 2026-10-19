import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPosition } from './geo'

function mockGeolocation(impl: Geolocation['getCurrentPosition']) {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: impl } })
}

describe('getPosition', () => {
  afterEach(() => vi.useRealTimers())

  it('returns the position', async () => {
    mockGeolocation((ok) => ok({ coords: { latitude: 13.75, longitude: 100.5, accuracy: 12 } } as GeolocationPosition))
    await expect(getPosition()).resolves.toEqual({ lat: 13.75, lng: 100.5, accuracy: 12 })
  })

  it('resolves null when the user refuses location', async () => {
    mockGeolocation((_ok, err) => err?.({ code: 1, message: 'denied' } as GeolocationPositionError))
    await expect(getPosition()).resolves.toBeNull()
  })

  it('resolves null after the timeout when the phone never answers', async () => {
    vi.useFakeTimers()
    mockGeolocation(() => undefined)
    const p = getPosition(10000)
    vi.advanceTimersByTime(10000)
    await expect(p).resolves.toBeNull()
  })

  it('resolves null when geolocation is missing', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined })
    await expect(getPosition()).resolves.toBeNull()
  })
})
