'use client'

import type { ContactMeshEntryClient } from '@/frontend/lib/api'

/** Case-insensitive Lookup im Kontaktverzeichnis (Backend-Keys oft 0x… lower). */
export function lookupContactEntry(
  directory: Record<string, ContactMeshEntryClient>,
  address: string
): ContactMeshEntryClient | undefined {
  const a = address.trim()
  if (!a) return undefined
  const lower = a.toLowerCase()
  const key = Object.keys(directory).find((k) => k.toLowerCase() === lower)
  return key ? directory[key] : undefined
}

export function contactDisplayLabel(
  directory: Record<string, ContactMeshEntryClient>,
  address: string
): string | null {
  const e = lookupContactEntry(directory, address)
  const lab = e?.label?.trim()
  return lab && lab.length > 0 ? lab : null
}

/** Telefonbuch-Alias → Wallet (exakter Name, case-insensitive). */
export function lookupContactAddressByLabel(
  directory: Record<string, ContactMeshEntryClient>,
  label: string
): string | null {
  const want = label.trim().toLowerCase()
  if (!want) return null
  for (const [addr, e] of Object.entries(directory)) {
    const lab = (e.label ?? '').trim().toLowerCase()
    if (lab && lab === want) {
      const t = addr.trim()
      return /^0x[a-fA-F0-9]{64}$/i.test(t) ? t.toLowerCase() : null
    }
  }
  return null
}
