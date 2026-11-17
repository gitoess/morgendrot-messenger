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

  it('blendet localhost aus', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/120.0' })
    vi.stubGlobal('window', { location: { hostname: '127.0.0.1' } })
    expect(shouldShowDashboardPwaInstallCard()).toBe(false)
  })

  it('zeigt im normalen Browser auf öffentlichem Host', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/120.0' })
    vi.stubGlobal('window', { location: { hostname: 'messenger.example.com' } })
    expect(shouldShowDashboardPwaInstallCard()).toBe(true)
  })
})
