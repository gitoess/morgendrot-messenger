/**
 * Innere RATCHET_V3-Lage nach Session-Keys+-Decrypt (Direct-Inbox + API-Rows).
 * Ratchet-State lebt nur im Browser — Backend liefert die Wire als Text weiter.
 */

import { deriveSharedSecret } from '@morgendrot/shared/morgendrot-crypto'
import { listPeerPubsForEpochDecrypt } from '@morgendrot/shared/morgendrot-session-keys-archive'
import {
  getDirectChatEcdhMaterialForRecipient,
  getDirectChatEcdhPrivateKey,
  restoreDirectChatEcdhPrivateFromLocalStorage,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { ensureDirectChatPeerPubForRecipient } from '@/frontend/lib/direct-iota-encrypted-send-prep'
import { tryAutoRestoreDirectChatEcdhPrivateKey } from '@/frontend/lib/direct-iota-vault-unlock-sync'
import { getPeerSessionArchiveForRecipient } from '@/frontend/lib/direct-session-keys-archive'
import {
  ensureRatchetSessionForPeer,
  looksLikeRatchetV3Wire,
  lookupRatchetOutgoingPlaintext,
  lookupRatchetOutgoingPlaintextByWire,
  peekRatchetWireMsgId,
  peekRatchetWireRkFp,
  readRatchetExperimentEnabled,
  sharedSecretFingerprint,
  tryRatchetExperimentUnwrapIncoming,
} from '@/frontend/lib/ratchet-experiment'
import { lookupOutgoingSendEcho } from '@/frontend/lib/outgoing-send-echo'

const RATCHET_UNWRAP_FAIL_HINT =
  '[Double Ratchet] Innere Lage nicht lesbar — Flag beiderseits an, Experiment aus→an, dann neue Enc. Eigene Ausgangs-Zeile: Klartext nur wenn dieser Tab die Sendung erzeugt hat.'

function normAddr(a: string): string {
  return a.trim().toLowerCase()
}

/** ECDH-Privatkey + Peer-Pub sicherstellen (API-Pfad oft ohne vorherigen Direct-Send). */
async function ensureEcdhMaterialForRatchet(peerAddr: string): Promise<boolean> {
  if (!getDirectChatEcdhPrivateKey()) {
    await tryAutoRestoreDirectChatEcdhPrivateKey()
  }
  if (!getDirectChatEcdhPrivateKey()) {
    await restoreDirectChatEcdhPrivateFromLocalStorage()
  }
  if (!getDirectChatEcdhPrivateKey()) return false
  if (!getDirectChatEcdhMaterialForRecipient(peerAddr)) {
    await ensureDirectChatPeerPubForRecipient(peerAddr)
  }
  return Boolean(getDirectChatEcdhMaterialForRecipient(peerAddr))
}

/**
 * Wenn `text` kein RATCHET_V3 ist → unverändert.
 * Sonst: Echo / Unwrap / ehrlicher Hint — nie Roh-JSON an die UI.
 *
 * `ecdhShared`: wenn Outer-Decrypt ein Archiv-Pub genutzt hat, denselben Shared hier übergeben.
 */
export async function resolveRatchetLayerAfterOuterDecrypt(opts: {
  text: string
  peerAddress: string
  myAddress: string
  iAmSender?: boolean
  ecdhShared?: Uint8Array
}): Promise<string> {
  const text = opts.text
  if (!looksLikeRatchetV3Wire(text)) return text

  if (!readRatchetExperimentEnabled()) {
    return '[Double Ratchet] Opt-in aus — Chat-⋮ „Double Ratchet (Experiment)“ an, dann Aktualisieren.'
  }

  const peerAddr = opts.peerAddress.trim()
  const myAddress = opts.myAddress.trim()
  const iAmSender = Boolean(opts.iAmSender)

  const msgId = peekRatchetWireMsgId(text)
  if (iAmSender) {
    if (msgId) {
      const remembered = lookupRatchetOutgoingPlaintext(peerAddr, msgId)
      if (remembered) return remembered
      const byNonce = lookupOutgoingSendEcho(peerAddr, msgId)
      if (byNonce) return byNonce
    }
    const byWire = lookupRatchetOutgoingPlaintextByWire(peerAddr, text)
    if (byWire) return byWire
    /**
     * Eigene Sendung nie über Empfangs-Chain + forceNew versuchen —
     * sonst wird nach B→A die Bob-Session genullt und A→B scheitert asymmetrisch.
     */
    return '[Double Ratchet · eigene Sendung] Klartext-Echo nur in der Session, die gesendet hat — Empfänger braucht Flag + frische Session.'
  }

  if (!(await ensureEcdhMaterialForRatchet(peerAddr))) {
    return RATCHET_UNWRAP_FAIL_HINT
  }

  const mat = getDirectChatEcdhMaterialForRecipient(peerAddr)
  if (!mat) {
    return RATCHET_UNWRAP_FAIL_HINT
  }

  const wantFp = peekRatchetWireRkFp(text)
  const archive = getPeerSessionArchiveForRecipient(peerAddr)
  const epoch = archive?.currentEpoch ?? 1
  const candidatePubs = listPeerPubsForEpochDecrypt(archive, epoch, mat.peerPubRaw)
  const sharedCandidates: Uint8Array[] = []
  if (opts.ecdhShared && opts.ecdhShared.length >= 16) {
    sharedCandidates.push(opts.ecdhShared)
  }
  for (const pub of candidatePubs) {
    sharedCandidates.push(await deriveSharedSecret(mat.ecdhPrivateKey, pub))
  }

  const seen = new Set<string>()
  let attempt = 0
  for (const shared of sharedCandidates) {
    const fp = sharedSecretFingerprint(shared)
    if (wantFp && fp !== wantFp) continue
    if (seen.has(fp)) continue
    seen.add(fp)
    attempt += 1
    /** Ab 2. Shared-Kandidat forceNew — sonst klebt falsche Session vom 1. Versuch. */
    await ensureRatchetSessionForPeer({
      peerAddress: peerAddr,
      ecdhShared: shared,
      localAddress: myAddress,
      forceNew: attempt > 1 || Boolean(wantFp),
    })
    const unwrapped = await tryRatchetExperimentUnwrapIncoming({
      peerAddress: peerAddr,
      raw: text,
      ecdhShared: shared,
      localAddress: myAddress,
    })
    if (unwrapped) return unwrapped.plaintext
  }

  /** Ohne rkFp / Match: letzter Versuch alle Kandidaten mit forceNew. */
  if (wantFp && seen.size === 0) {
    for (const shared of sharedCandidates) {
      const fp = sharedSecretFingerprint(shared)
      if (seen.has(fp)) continue
      seen.add(fp)
      await ensureRatchetSessionForPeer({
        peerAddress: peerAddr,
        ecdhShared: shared,
        localAddress: myAddress,
        forceNew: true,
      })
      const unwrapped = await tryRatchetExperimentUnwrapIncoming({
        peerAddress: peerAddr,
        raw: text,
        ecdhShared: shared,
        localAddress: myAddress,
      })
      if (unwrapped) return unwrapped.plaintext
    }
  }

  return RATCHET_UNWRAP_FAIL_HINT
}

export type RatchetInboxApiRow = {
  sender?: string
  from?: string
  text?: string
  content?: string
  recipient?: string
  innerEnc?: 'ratchet_v3'
}

/** API liefert oft Session-Klartext = RATCHET_V3-JSON — hier clientseitig nachziehen. */
export async function unwrapRatchetV3InInboxApiRows<T extends RatchetInboxApiRow>(
  rows: T[],
  myAddress: string
): Promise<T[]> {
  const me = myAddress.trim()
  if (!me || rows.length === 0) return rows

  const out: T[] = []
  for (const row of rows) {
    const rawT = row.text != null ? String(row.text) : ''
    const rawC = row.content != null ? String(row.content) : ''
    const text = rawT || rawC
    if (!looksLikeRatchetV3Wire(text)) {
      out.push(row)
      continue
    }
    const from = (row.sender ?? row.from ?? '').trim()
    const iAmSender = Boolean(from && normAddr(from) === normAddr(me))
    const peer = iAmSender ? (row.recipient ?? '').trim() : from
    if (!peer) {
      out.push({
        ...row,
        ...(rawT ? { text: RATCHET_UNWRAP_FAIL_HINT } : {}),
        ...(rawC && !rawT ? { content: RATCHET_UNWRAP_FAIL_HINT } : {}),
      })
      continue
    }
    const resolved = await resolveRatchetLayerAfterOuterDecrypt({
      text,
      peerAddress: peer,
      myAddress: me,
      iAmSender,
    })
    out.push({
      ...row,
      ...(rawT ? { text: resolved } : {}),
      ...(rawC ? { content: resolved } : {}),
      ...(!rawT && !rawC ? { text: resolved } : {}),
      innerEnc: 'ratchet_v3',
    })
  }
  return out
}
