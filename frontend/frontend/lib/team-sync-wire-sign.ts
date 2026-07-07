'use client'

import { buildTeamWireSignBytes } from '@morgendrot/shared/morg-team-wire-signature'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'

/** Boss-Signatur anhängen, wenn Browser-/Vault-Signer verfügbar (§ H.36 sig freeze). */
export async function trySignTeamWirePayload<T extends Record<string, unknown>>(
  payload: T
): Promise<T & { sig?: string }> {
  const signer = getDirectIotaSessionSigner() as {
    signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }>
  } | null
  if (!signer?.signPersonalMessage) return payload
  try {
    const bytes = buildTeamWireSignBytes(payload)
    const result = await signer.signPersonalMessage(bytes)
    const sig = result?.signature?.trim()
    if (!sig) return payload
    return { ...payload, sig }
  } catch {
    return payload
  }
}
