import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BossHandoffQuickProvisionWizard } from './boss-handoff-quick-provision-wizard'

vi.mock('@/frontend/lib/handoff-provision-registry-access', () => ({
  useHandoffProvisionRegistryAccess: () => ({
    registryExists: true,
    registryUnlocked: true,
    activeMasterPassword: () => 'test-master-password',
    initRegistry: vi.fn(),
    unlockRegistry: vi.fn(),
  }),
}))

describe('BossHandoffQuickProvisionWizard', () => {
  it('zeigt Schritt 1 mit Presets', () => {
    render(
      <BossHandoffQuickProvisionWizard open onOpenChange={vi.fn()} apiStatus={{ myAddressFull: `0x${'b'.repeat(64)}` } as never} />
    )
    expect(screen.getByText(/Schnell-Assistent — Handoff/i)).toBeInTheDocument()
    expect(screen.getByText(/Helfer/i)).toBeInTheDocument()
    expect(screen.getByText(/Experten-Assistent/i)).toBeInTheDocument()
  })
})
