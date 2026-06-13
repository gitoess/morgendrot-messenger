'use client'

import { addressMatchesIdentity } from '@/frontend/features/inbox/inbox-partner-filter'

function normalizeHexAddr(a: string): string {
  const t = a.trim().toLowerCase()
  return t.startsWith('0x') ? t : `0x${t}`
}

/** Session-Signer vs. MY_ADDRESS (volle oder maskierte UI-Adresse). Leere Identity → fail-closed. */
export function directIotaSignerMatchesIdentity(signerAddress: string, identityAddress: string): boolean {
  const signer = signerAddress.trim()
  const identity = identityAddress.trim()
  if (!identity || !signer) return false
  return (
    addressMatchesIdentity(signer, identity) || normalizeHexAddr(signer) === normalizeHexAddr(identity)
  )
}
