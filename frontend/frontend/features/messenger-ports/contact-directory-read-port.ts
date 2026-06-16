import type { ContactMeshEntryClient } from '@/frontend/lib/api'

/** Telefonbuch / Kontaktverzeichnis (readonly) für Panel-Hooks. */
export type ContactDirectoryReadPort = {
  readonly directory: Record<string, ContactMeshEntryClient>
  readonly isMeshVerifiedForAddress: (address: string) => boolean
}

export function asContactDirectoryRead(
  directory: Record<string, ContactMeshEntryClient>,
  isMeshVerifiedForAddress: (address: string) => boolean
): ContactDirectoryReadPort {
  return { directory, isMeshVerifiedForAddress }
}
