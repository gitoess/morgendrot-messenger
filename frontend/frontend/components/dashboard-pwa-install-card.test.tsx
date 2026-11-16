import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardPwaInstallCard } from './dashboard-pwa-install-card'

vi.mock('@/frontend/lib/capacitor-platform', () => ({
  isCapacitorNativePlatform: () => false,
}))

describe('DashboardPwaInstallCard', () => {
  const matchMediaMock = vi.fn()

  beforeEach(() => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    Object.assign(window, { matchMedia: matchMediaMock })
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'messenger.example.com' },
    })
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: false,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('zeigt Titel und Hinweis wenn nicht standalone (öffentlicher Host)', () => {
    render(<DashboardPwaInstallCard />)
    expect(screen.getByRole('heading', { name: /App installieren/i })).toBeInTheDocument()
    expect(screen.getByText(/Für besten Offline-Betrieb/i)).toBeInTheDocument()
  })

  it('blendet Karte auf localhost aus', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { hostname: 'localhost' },
    })
    const { container } = render(<DashboardPwaInstallCard />)
    expect(container.querySelector('#dashboard-pwa-install')).toBeNull()
  })

  it('blendet Karte aus wenn display-mode standalone', () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const { container } = render(<DashboardPwaInstallCard />)
    expect(container.querySelector('#dashboard-pwa-install')).toBeNull()
  })
})
