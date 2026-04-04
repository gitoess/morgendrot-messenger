/**
 * Reine Logik: „Mesh verifiziert“ = Kontakt hat gebundene LoRa-Identität (Node + X25519-PK).
 * Wird von useContactDirectory und Tests geteilt (kein React).
 */
export type MeshEntryLike = {
  meshNodeId?: string
  meshPublicKeyHex?: string
}

export function isMeshEntryVerified(e: MeshEntryLike | undefined): boolean {
  return !!(e?.meshNodeId?.trim() && e?.meshPublicKeyHex?.trim())
}

export function isAddressMeshVerifiedInDirectory(
  directory: Record<string, MeshEntryLike>,
  address: string
): boolean {
  const a = String(address || '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(a)) return false
  return isMeshEntryVerified(directory[a])
}
