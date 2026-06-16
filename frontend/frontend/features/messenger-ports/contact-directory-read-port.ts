import type { ContactMeshEntryClient } from '@/frontend/lib/api'

/** Telefonbuch / Kontaktverzeichnis für Panel-Hooks (P8: inkl. Refresh). */
export type ContactDirectoryReadPort = {
  readonly directory: Record<string, ContactMeshEntryClient>
  readonly isMeshVerifiedForAddress: (address: string) => boolean
  readonly refreshContactDirectory: () => void
}

export function asContactDirectoryRead(
  directory: Record<string, ContactMeshEntryClient>,
  isMeshVerifiedForAddress: (address: string) => boolean,
  refreshContactDirectory: () => void
): ContactDirectoryReadPort {
  return { directory, isMeshVerifiedForAddress, refreshContactDirectory }
}
