import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

export type MorgPkgExportPartnerOption = {
  address: string
  label: string
}

export function buildMorgPkgExportPartnerOptions(
  connectedAddresses: string[] | undefined,
  contactDirectory: Record<string, ContactMeshEntryClient>
): MorgPkgExportPartnerOption[] {
  const addrs = (connectedAddresses ?? []).map((a) => a.trim()).filter((a) => /^0x[a-fA-F0-9]{64}$/i.test(a))
  const seen = new Set<string>()
  const out: MorgPkgExportPartnerOption[] = []
  for (const address of addrs) {
    const key = address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const name = contactDisplayLabel(contactDirectory, address)
    out.push({
      address,
      label: name ? `${name} · ${maskWalletAddress(address, 8, 6)}` : maskWalletAddress(address, 10, 8),
    })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'de'))
}
