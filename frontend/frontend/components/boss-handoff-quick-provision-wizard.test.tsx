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

vi.mock('@/frontend/lib/handoff-provision-new-device', () => ({
  provisionNewHandoffDevice: vi.fn(),
  HANDOFF_SEED_QR_SECONDS: 60,
}))

vi.mock('@/frontend/lib/handoff-export-download', () => ({
  downloadHandoffZipExport: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@/frontend/lib/handoff-last-preset', () => ({
  writeHandoffLastPresetId: vi.fn(),
}))

vi.mock('@/frontend/lib/handoff-export-defaults', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/frontend/lib/handoff-export-defaults')>()
  return {
    ...mod,
    fetchHandoffCurrentIdsDefaults: vi.fn().mockResolvedValue({}),
  }
})

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

  it('bleibt auf aktuellem Schritt bei Status-Poll (apiSnapshot-Update)', () => {
    const snapshotA = { myAddressFull: `0x${'a'.repeat(64)}`, role: 'boss' } as never
    const snapshotB = { myAddressFull: `0x${'a'.repeat(64)}`, role: 'boss', connected: true } as never
    const { rerender } = render(
      <BossHandoffQuickProvisionWizard open onOpenChange={vi.fn()} apiSnapshot={snapshotA} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Weiter/i }))
    expect(screen.getByText(/Rechte \(optional\)/i)).toBeInTheDocument()

    rerender(<BossHandoffQuickProvisionWizard open onOpenChange={vi.fn()} apiSnapshot={snapshotB} />)

    expect(screen.getByText(/Rechte \(optional\)/i)).toBeInTheDocument()
    expect(screen.queryByText(/Wer soll eingerichtet werden/i)).not.toBeInTheDocument()
  })

  it('bietet auf dem letzten Schritt Nur ZIP (eigene Wallet)', () => {
    render(
      <BossHandoffQuickProvisionWizard
        open
        onOpenChange={vi.fn()}
        apiSnapshot={{ myAddressFull: `0x${'b'.repeat(64)}` } as never}
      />
    )
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Weiter/i }))
    }
    expect(screen.getByText(/Handoff ausliefern/i)).toBeInTheDocument()
    expect(screen.getByText(/Nur ZIP \(eigene Wallet\)/i)).toBeInTheDocument()
    expect(screen.getByText(/ZIP \+ Seed \+ QR \(Team-Wallet\)/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Neue Gruppe/i })).toBeInTheDocument()
  })
})
