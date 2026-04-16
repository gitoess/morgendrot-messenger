import { afterEach, describe, expect, it, vi } from 'vitest'
import { prefersFileCameraCapture } from './device-detect'

function stubNav(partial: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>) {
  vi.stubGlobal('navigator', partial as Navigator)
}

describe('prefersFileCameraCapture', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ohne navigator → false', () => {
    vi.stubGlobal('navigator', undefined as unknown as Navigator)
    expect(prefersFileCameraCapture()).toBe(false)
  })

  it('Android-UA → true', () => {
    stubNav({ userAgent: 'Mozilla/5.0 (Linux; Android 12)', maxTouchPoints: 5 })
    expect(prefersFileCameraCapture()).toBe(true)
  })

  it('iPhone-UA → true', () => {
    stubNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)', maxTouchPoints: 5 })
    expect(prefersFileCameraCapture()).toBe(true)
  })

  it('Desktop-UA ohne Touch → false', () => {
    stubNav({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
      maxTouchPoints: 0,
    })
    expect(prefersFileCameraCapture()).toBe(false)
  })

  it('iPadOS-Macintosh-Maske mit Touch → true', () => {
    stubNav({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      maxTouchPoints: 5,
    })
    expect(prefersFileCameraCapture()).toBe(true)
  })
})
