import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  isElectronDesktopShell,
  shouldShowDashboardPwaInstallCard,
} from './should-show-pwa-install'

describe('shouldShowDashboardPwaInstallCard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('blendet Electron und Capacitor aus', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Electron/33.0' })
    expect(isElectronDesktopShell()).toBe(true)
    expect(shouldShowDashboardPwaInstallCard()).toBe(false)
  })

  it('zeigt im normalen Browser', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/120.0' })
    expect(shouldShowDashboardPwaInstallCard()).toBe(true)
  })
})
