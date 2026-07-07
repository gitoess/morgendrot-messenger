import { describe, expect, it, vi, afterEach } from 'vitest'
import { releaseStuckModalPointerEvents, purgeOrphanRadixOverlays } from './release-modal-pointer-events'

describe('releaseStuckModalPointerEvents', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears body pointer-events and scroll lock when no dialog open', () => {
    document.body.style.pointerEvents = 'none'
    document.body.setAttribute('data-scroll-locked', '')
    releaseStuckModalPointerEvents({ force: true })
    expect(document.body.style.pointerEvents).toBe('')
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
  })

  it('clears body pointer-events lock even while native modal overlay is open', () => {
    const overlay = document.createElement('div')
    overlay.setAttribute('data-morgendrot-native-modal-overlay', '')
    const panel = document.createElement('div')
    panel.setAttribute('data-morgendrot-native-modal-panel', '')
    overlay.appendChild(panel)
    document.body.appendChild(overlay)
    document.body.style.pointerEvents = 'none'
    releaseStuckModalPointerEvents({ force: true })
    expect(document.body.style.pointerEvents).toBe('')
    overlay.remove()
  })

  it('removes orphan radix overlays when nothing is open', () => {
    const overlay = document.createElement('div')
    overlay.setAttribute('data-slot', 'sheet-overlay')
    document.body.appendChild(overlay)
    purgeOrphanRadixOverlays()
    expect(document.body.contains(overlay)).toBe(false)
  })
})
