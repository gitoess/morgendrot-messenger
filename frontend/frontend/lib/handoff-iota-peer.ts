import type { ApiStatus } from '@/frontend/lib/api'
import { connect, findPeerHandshake } from '@/frontend/lib/api/package-connect'
import {
  getDirectChatEcdhMaterialForRecipient,
  hasDirectChatEcdhPeerPubForRecipient,
  getDirectChatEcdhPrivateKey,
  setDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'

const ADDR = /^0x[a-f0-9]{64}$/

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
      const cr = await connect(target)
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
