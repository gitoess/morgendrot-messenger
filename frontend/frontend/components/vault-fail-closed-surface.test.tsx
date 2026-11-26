import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VaultFailClosedSurface } from '@/frontend/components/vault-fail-closed-surface'

describe('VaultFailClosedSurface', () => {
  it('ohne active: kein Scrim', () => {
    render(
      <VaultFailClosedSurface active={false}>
        <button type="button">Inhalt</button>
      </VaultFailClosedSurface>
    )
    expect(screen.queryByTestId('vault-fail-closed-scrim')).toBeNull()
    expect(screen.getByRole('button', { name: 'Inhalt' })).toBeTruthy()
  })

  it('active: Scrim + Unlock-Fallback klickbar', () => {
    const onUnlock = vi.fn()
    render(
      <VaultFailClosedSurface active onRequestUnlock={onUnlock}>
        <button type="button">Inhalt</button>
      </VaultFailClosedSurface>
    )
    expect(screen.getByTestId('vault-fail-closed-scrim')).toBeTruthy()
    fireEvent.click(screen.getByTestId('vault-fail-closed-unlock'))
    expect(onUnlock).toHaveBeenCalledTimes(1)
  })

  it('Soft-Pause: Scrim ohne Unlock-CTA', () => {
    render(
      <VaultFailClosedSurface active unlockCta={false} onRequestUnlock={() => {}}>
        <span>Inhalt</span>
      </VaultFailClosedSurface>
    )
    expect(screen.getByTestId('vault-fail-closed-scrim')).toBeTruthy()
    expect(screen.queryByTestId('vault-fail-closed-unlock')).toBeNull()
  })
})
