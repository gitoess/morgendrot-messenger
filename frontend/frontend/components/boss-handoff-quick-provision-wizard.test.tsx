import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BossHandoffQuickProvisionWizard } from './boss-handoff-quick-provision-wizard'

vi.mock('@/frontend/lib/handoff-provision-registry-access', () => ({
  useHandoffProvisionRegistryAccess: () => ({
    registryExists: true,
    registryUnlocked: true,
    masterPassword: '',
    setMasterPassword: vi.fn(),
    masterPasswordConfirm: '',
    setMasterPasswordConfirm: vi.fn(),
    unlockPassword: '',
    setUnlockPassword: vi.fn(),
    activeMasterPassword: () => 'test-master-password',
    initRegistry: vi.fn(),
    unlockRegistry: vi.fn(),
  }),
}))

describe('BossHandoffQuickProvisionWizard', () => {
  it('zeigt Schritt 1 mit Presets und 5 Schritte gesamt', () => {
    render(
      <BossHandoffQuickProvisionWizard
        open
        onOpenChange={vi.fn()}
        apiSnapshot={{ myAddressFull: `0x${'b'.repeat(64)}` } as never}
      />
    )
    expect(screen.getByText(/Schnell-Assistent — Handoff/i)).toBeInTheDocument()
    expect(screen.getByText(/Schritt 1 von 5/i)).toBeInTheDocument()
    expect(screen.getByText(/Wer soll eingerichtet werden/i)).toBeInTheDocument()
    expect(screen.getByText(/Experten-Assistent/i)).toBeInTheDocument()
  })

  it('bietet Überspringen auf Rechte-Schritt', () => {
    render(
      <BossHandoffQuickProvisionWizard
        open
        onOpenChange={vi.fn()}
        apiSnapshot={{ myAddressFull: `0x${'b'.repeat(64)}` } as never}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Weiter/i }))
    expect(screen.getByText(/Rechte \(optional\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Überspringen/i })).toBeInTheDocument()
  })
})
