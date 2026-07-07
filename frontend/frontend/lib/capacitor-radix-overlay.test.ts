import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCapacitorRadixOverlayState } from './capacitor-radix-overlay'

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: () => true,
}))

vi.mock('@/frontend/lib/release-modal-pointer-events', () => ({
  scheduleReleaseStuckModalPointerEvents: vi.fn(),
}))

describe('useCapacitorRadixOverlayState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('tracks controlled open state', () => {
    const onOpenChange = vi.fn()
    const { result, rerender } = renderHook(
      ({ open }) => useCapacitorRadixOverlayState({ open, onOpenChange }),
      { initialProps: { open: false } }
    )
    expect(result.current.native).toBe(true)
    expect(result.current.isOpen).toBe(false)
    expect(result.current.radixModal).toBe(false)
    rerender({ open: true })
    expect(result.current.isOpen).toBe(true)
    act(() => result.current.handleOpenChange(false))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
