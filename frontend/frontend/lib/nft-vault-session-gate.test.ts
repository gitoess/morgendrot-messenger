import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/frontend/lib/vault-password-session', () => ({
  hasVaultPasswordSession: vi.fn(),
}))
vi.mock('@/frontend/lib/vault-enc-sidecar', () => ({
  hasVaultEncSidecar: vi.fn(),
}))

import { hasVaultPasswordSession } from '@/frontend/lib/vault-password-session'
import { hasVaultEncSidecar } from '@/frontend/lib/vault-enc-sidecar'
import { nftVaultSessionHint } from '@/frontend/lib/nft-vault-session-gate'

describe('nftVaultSessionHint', () => {
  beforeEach(() => {
    vi.mocked(hasVaultPasswordSession).mockReturnValue(false)
    vi.mocked(hasVaultEncSidecar).mockReturnValue(false)
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('leer wenn Browser-Tresor-Sitzung offen', () => {
    vi.mocked(hasVaultPasswordSession).mockReturnValue(true)
    expect(nftVaultSessionHint()).toBe('')
  })

  it('ehrlich bei Sidecar ohne Passwort-Sitzung (API kann offen sein)', () => {
    vi.mocked(hasVaultEncSidecar).mockReturnValue(true)
    const h = nftVaultSessionHint()
    expect(h).toMatch(/Tresor-Passwort/i)
    expect(h).not.toMatch(/^Tresor gesperrt/)
    expect(h).toMatch(/Browser-Sitzung|API/i)
  })

  it('ohne Sidecar: Speichern braucht Passwort', () => {
    const h = nftVaultSessionHint()
    expect(h).toMatch(/Tresor-Passwort|entsperren/i)
  })
})
