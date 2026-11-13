import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardMessengerBossHeader } from '@/frontend/components/dashboard-messenger-boss-header'

describe('DashboardMessengerBossHeader peer switch', () => {
  it('shows Einsatzleitung peer when on Nachrichten (no redundant title)', () => {
    const onPeer = vi.fn()
    render(
      <DashboardMessengerBossHeader
        role="boss"
        onOpenSettings={vi.fn()}
        subNav={{
          viewTitle: 'Nachrichten',
          onBack: vi.fn(),
          onGoHome: vi.fn(),
          peerSwitch: { label: 'Einsatzleitung', onClick: onPeer },
        }}
      />
    )
    expect(screen.queryByText('Nachrichten')).not.toBeInTheDocument()
    const btn = screen.getByRole('button', { name: 'Einsatzleitung' })
    btn.click()
    expect(onPeer).toHaveBeenCalledTimes(1)
  })

  it('shows Nachrichten peer when on Einsatzleitung', () => {
    render(
      <DashboardMessengerBossHeader
        role="boss"
        onOpenSettings={vi.fn()}
        subNav={{
          viewTitle: 'Einsatzleitung',
          onBack: vi.fn(),
          onGoHome: vi.fn(),
          peerSwitch: { label: 'Nachrichten', onClick: vi.fn() },
        }}
      />
    )
    expect(screen.getByRole('button', { name: 'Nachrichten' })).toBeInTheDocument()
    expect(screen.queryByText(/^Einsatzleitung$/)).not.toBeInTheDocument()
  })

  it('keeps static title for settings without peer', () => {
    render(
      <DashboardMessengerBossHeader
        role="boss"
        onOpenSettings={vi.fn()}
        subNav={{
          viewTitle: 'Einstellungen',
          onBack: vi.fn(),
          onGoHome: vi.fn(),
          peerSwitch: null,
        }}
      />
    )
    expect(screen.getByText('Einstellungen')).toBeInTheDocument()
  })

  it('settings: title plus Nachrichten and Einsatzleitung peers', () => {
    render(
      <DashboardMessengerBossHeader
        role="boss"
        onOpenSettings={vi.fn()}
        subNav={{
          viewTitle: 'Einstellungen',
          onBack: vi.fn(),
          onGoHome: vi.fn(),
          peerSwitches: [
            { label: 'Nachrichten', onClick: vi.fn() },
            { label: 'Einsatzleitung', onClick: vi.fn() },
          ],
        }}
      />
    )
    expect(screen.getByText('Einstellungen')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nachrichten' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Einsatzleitung' })).toBeInTheDocument()
  })
})
