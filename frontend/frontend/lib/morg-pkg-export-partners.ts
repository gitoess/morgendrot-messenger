import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

export type MorgPkgExportPartnerOption = {
  address: string
  label: string
  /** Eigene Wallet (Self-Handshake in peerMap). */
  self?: boolean
}

/**
 * Vorschläge für .morg-pkg-Empfänger = peerMap (`connectedAddresses`).
 * Enthält **auch Ich**, wenn Self-Connect aktiv — wie verschlüsselte Nachricht an sich selbst.
 */
export function buildMorgPkgExportPartnerOptions(
  connectedAddresses: string[] | undefined,
  contactDirectory: Record<string, ContactMeshEntryClient>,
  myAddress?: string
): MorgPkgExportPartnerOption[] {
  const my = (myAddress ?? '').trim().toLowerCase()
  const addrs = (connectedAddresses ?? [])
    .map((a) => a.trim())
    .filter((a) => /^0x[a-fA-F0-9]{64}$/i.test(a))
  const seen = new Set<string>()
  const out: MorgPkgExportPartnerOption[] = []
  for (const address of addrs) {
    const key = address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const isSelf = Boolean(my && key === my)
    const name = contactDisplayLabel(contactDirectory, address)
    const masked = maskWalletAddress(address, isSelf ? 8 : 10, isSelf ? 6 : 8)
    out.push({
      address,
      self: isSelf || undefined,
      label: isSelf
        ? `Ich (diese Wallet) · ${masked}`
        : name
          ? `${name} · ${maskWalletAddress(address, 8, 6)}`
          : masked,
    })
  }
  return out.sort((a, b) => {
    if (a.self && !b.self) return -1
    if (!a.self && b.self) return 1
    return a.label.localeCompare(b.label, 'de')
  })
}
