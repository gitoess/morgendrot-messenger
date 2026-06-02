import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { DashboardPwaInstallCard } from './dashboard-pwa-install-card'

describe('DashboardPwaInstallCard', () => {
  const matchMediaMock = vi.fn()

  beforeEach(() => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('matchMedia', matchMediaMock)
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: false,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('zeigt Titel und Hinweis wenn nicht standalone', async () => {
    render(<DashboardPwaInstallCard />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /App installieren/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/Für besten Offline-Betrieb/i)).toBeInTheDocument()
  })

  it('blendet Karte aus wenn display-mode standalone', async () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const { container } = render(<DashboardPwaInstallCard />)
    await waitFor(() => {
      expect(container.querySelector('#dashboard-pwa-install')).toBeNull()
    })
  })
})
