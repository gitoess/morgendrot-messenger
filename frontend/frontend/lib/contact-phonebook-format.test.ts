import { describe, expect, it } from 'vitest'
import { formatContactLastSeen, maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

describe('contact-phonebook-format', () => {
  it('maskWalletAddress kürzt Mitte', () => {
    const a = '0x' + 'a'.repeat(64)
    expect(maskWalletAddress(a)).toBe(`0x${'a'.repeat(8)}…${'a'.repeat(6)}`)
  })

  it('formatContactLastSeen formatiert Datum', () => {
    const s = formatContactLastSeen(Date.UTC(2026, 4, 12, 12, 32))
    expect(s).toMatch(/12/)
    expect(s).not.toBe('—')
  })
})
