import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useChatViewApiStatusPoll } from '@/frontend/hooks/use-chat-view-api-status-poll'

const fetchStatus = vi.fn()

vi.mock('@/frontend/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/frontend/lib/api')>()
  return {
    ...actual,
    fetchStatus: (...args: unknown[]) => fetchStatus(...args),
    readBootstrapCachedApiStatus: () => null,
  }
})

describe('useChatViewApiStatusPoll', () => {
  beforeEach(() => {
    fetchStatus.mockReset()
    fetchStatus.mockResolvedValue({
      backendOnline: true,
      backendRunning: true,
      connected: true,
      pollClockHint: {
        okAtMs: Date.now(),
        httpDateUtcMs: Date.parse('Wed, 01 Jan 2026 00:00:00 GMT'),
      },
    })
  })

  it('zeigt Geräte-Uhr-Warnung erst nach abgeschlossenem Status-Poll', async () => {
    const { result } = renderHook(() =>
      useChatViewApiStatusPoll({
        runMirrorDrain: vi.fn(async () => {}),
        localPackageId: '',
        probeGeolocationForDeviceTime: false,
      })
    )

    expect(result.current.deviceTimeTrustWarn).toBe(false)

    await waitFor(() => {
      expect(result.current.deviceTimeTrustWarn).toBe(false)
    })
    expect(fetchStatus).toHaveBeenCalled()
  })

  it('warnt nach Poll ohne Referenzzeit', async () => {
    fetchStatus.mockResolvedValue({
      backendOnline: true,
      backendRunning: true,
      connected: true,
      pollClockHint: { okAtMs: Date.now(), httpDateUtcMs: null },
    })

    const { result } = renderHook(() =>
      useChatViewApiStatusPoll({
        runMirrorDrain: vi.fn(async () => {}),
        localPackageId: '',
        probeGeolocationForDeviceTime: false,
      })
    )

    await waitFor(() => {
      expect(result.current.deviceTimeTrustWarn).toBe(true)
    })
  })
})
