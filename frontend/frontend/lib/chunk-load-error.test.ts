import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { hardReloadAfterChunkFailure, isChunkLoadErrorMessage, isChunkLoadErrorUnknown } from './chunk-load-error'

describe('hardReloadAfterChunkFailure', () => {
  const replace = vi.fn()
  const unregister = vi.fn()
  const getRegistrations = vi.fn(async () => [{ unregister }])
  const cacheKeys = vi.fn(async () => ['cache-a'])
  const cacheDelete = vi.fn(async () => true)
  const prevLocation = window.location
  const prevCaches = window.caches
  const prevSw = navigator.serviceWorker

  beforeEach(() => {
    replace.mockReset()
    unregister.mockReset()
    getRegistrations.mockClear()
    cacheKeys.mockClear()
    cacheDelete.mockClear()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { replace },
    })
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys: cacheKeys, delete: cacheDelete },
    })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistrations },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: prevLocation })
    Object.defineProperty(window, 'caches', { configurable: true, value: prevCaches })
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: prevSw })
  })

  it('entfernt SW + Caches und ersetzt die URL', async () => {
    await hardReloadAfterChunkFailure()
    expect(getRegistrations).toHaveBeenCalled()
    expect(unregister).toHaveBeenCalled()
    expect(cacheKeys).toHaveBeenCalled()
    expect(cacheDelete).toHaveBeenCalledWith('cache-a')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(String(replace.mock.calls[0]?.[0])).toMatch(/^\/?\?reload=\d+$/)
  })

  it('erkennt missing-Chunk-URLs', () => {
    expect(
      isChunkLoadErrorMessage(
        'Loading chunk _app-pages-browser_frontend_components_messenger-dashboard_tsx failed. (missing: http://127.0.0.1:3341/_next/static/chunks/foo.js)'
      )
    ).toBe(true)
  })

  it('erkennt DOM-Event-Ablehnungen (Next zeigt sonst [object Event])', () => {
    const script = document.createElement('script')
    script.src = 'http://127.0.0.1:3341/_next/static/chunks/messenger-dashboard.js'
    const ev = new Event('error')
    Object.defineProperty(ev, 'target', { value: script })
    expect(isChunkLoadErrorUnknown(ev)).toBe(true)
    expect(isChunkLoadErrorUnknown(new Error('[object Event]'))).toBe(false)
    expect(isChunkLoadErrorUnknown('[object Event]')).toBe(true)
  })
})
