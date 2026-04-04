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
