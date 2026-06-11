import type { ApiStatus } from '@/frontend/lib/api'
import { findPeerHandshake } from '@/frontend/lib/api/package-connect'
import { connectPartnerHybrid } from '@/frontend/lib/connect-hybrid'
import {
  getDirectChatEcdhMaterialForRecipient,
  hasDirectChatEcdhPeerPubForRecipient,
  getDirectChatEcdhPrivateKey,
  setDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'

const ADDR = /^0x[a-f0-9]{64}$/

export function resolveHandoffSenderAddress(apiStatus: ApiStatus | null | undefined): string {
  return (apiStatus?.myAddressFull || apiStatus?.myAddress || '').trim().toLowerCase()
}

export function isHandoffIotaSelfTarget(
  targetRaw: string,
  apiStatus: ApiStatus | null | undefined
): boolean {
  const target = targetRaw.trim().toLowerCase()
  const me = resolveHandoffSenderAddress(apiStatus)
  return Boolean(me && target && me === target)
}

/** Verschlüsselter Mailbox-Versand an Partner: Session, Direkt-ECDH oder Handshake. */
export async function ensureHandoffEncryptedPeerReady(
  targetRaw: string,
  apiStatus: ApiStatus | null | undefined,
  refreshApiStatus?: () => Promise<void>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const target = targetRaw.trim().toLowerCase()
  if (!ADDR.test(target)) {
    return { ok: false, message: 'Ungültige Partner-Adresse (0x + 64 Hex).' }
  }
  if (isHandoffIotaSelfTarget(target, apiStatus)) {
    return {
      ok: false,
      message:
        'Nicht an die eigene Adresse — IOTA-Handoff braucht die Wallet eines anderen Geräts (Helfer). Zum Testen: ZIP.',
    }
  }
  if (apiStatus?.locked) {
    return { ok: false, message: 'Wallet ist gesperrt — zuerst entsperren.' }
  }
  const connected = (apiStatus?.connectedAddresses ?? []).map((a) => a.toLowerCase())
  if (connected.includes(target)) return { ok: true }
  if (getDirectChatEcdhMaterialForRecipient(target)) return { ok: true }
  if (canTryLiveEncryptedDirectMailbox(target)) return { ok: true }
  try {
    const hs = await findPeerHandshake(target)
    if (hs.ok && hs.found && hs.peerPubRawBase64) {
      setDirectChatEcdhPeerPubBase64(target, hs.peerPubRawBase64)
      if (getDirectChatEcdhMaterialForRecipient(target)) return { ok: true }
      const cr = await connectPartnerHybrid(target)
      if (cr.ok) {
        await refreshApiStatus?.()
        return { ok: true }
      }
      if (hasDirectChatEcdhPeerPubForRecipient(target) && !getDirectChatEcdhPrivateKey()) {
        return { ok: false, message: 'ECDH-Schlüssel fehlt — Tresor entsperren.' }
      }
    }
  } catch {
    /* fall through */
  }
  return {
    ok: false,
    message: `Kein verschlüsselter Kanal zu ${target.slice(0, 10)}… — Handshake/Connect oder USB-Handoff.`,
  }
}
