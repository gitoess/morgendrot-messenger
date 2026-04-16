'use client'

/**
 * Nach erfolgreichem **Mailbox**-Versand (Bild / LUMA+CHROMA): `canonical_msg_ref` berechnen,
 * Manifest in die Attestation-Queue legen und sofort **`drainAttestationQueue`** (Direct zuerst).
 * Opt-out: `localStorage` **`morgendrot.forensicImageMailboxAttestation`** = **`0`**.
 */

import {
  computeCanonicalMsgRefV1,
  nextOfflineMailboxClientOutSeq,
  parseMailboxOutNonceMarker,
  prependMailboxOutNonceMarker,
  stableOfflineMailboxThreadId,
} from '@/frontend/lib/api'
import {
  drainAttestationQueue,
  enqueueAttestationManifestDraft,
} from '@/frontend/lib/attestation-queue'
import { formatTxDigestStatusSuffix } from '@/frontend/lib/iota-tx-explorer-hint'

/** Delayed-Mirror-/send-Pfad: Nonce-Marker setzen, damit `canonical_msg_ref` mit der Kette übereinstimmt. */
export function prependMailboxNonceIfMissingForEncryptedWire(wireUtf8: string): string {
  if (parseMailboxOutNonceMarker(wireUtf8)) return wireUtf8
  return prependMailboxOutNonceMarker(wireUtf8, BigInt(nextOfflineMailboxClientOutSeq()))
}

export function isForensicImageMailboxAttestationEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem('morgendrot.forensicImageMailboxAttestation') !== '0'
  } catch {
    return true
  }
}

/** SHA-256 (64 Hex) über dekodierte Base64-Rohbytes (Bild). */
export async function sha256HexFromBase64Bytes(b64: string): Promise<string | null> {
  try {
    const bin = atob(b64.trim())
    const u8 = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 0xff
    const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', u8))
    let hex = ''
    for (let i = 0; i < buf.length; i++) hex += buf[i]!.toString(16).padStart(2, '0')
    return hex
  } catch {
    return null
  }
}

export type ForensicMailboxAttestationInput = {
  recipient: string
  senderAddress: string
  primary: { payloadUtf8: string; messageNonceU64: bigint }
  secondary?: { payloadUtf8: string; messageNonceU64: bigint }
  imageContentSha256Hex: string | null
  deviceTimeTrustWarn: boolean
  baseSuccessMsg: string
  setStatusMsg: (msg: string) => void
  /** Digest der **Mailbox**-Transaktion (Direct oder API), für Explorer-Link in der Statuszeile. */
  mailboxTxDigest?: string
  /** Im Attestation-Manifest (`mtx`) — z. B. Delayed-Mirror-/send-TX. */
  mirrorMailboxTxDigest?: string | null
  /** Keine UI-Updates (z. B. Mirror-Drain-Batch — Aufrufer meldet zusammengefasst). */
  silent?: boolean
}

function withMailboxDigest(base: string, digest?: string): string {
  return base + formatTxDigestStatusSuffix(digest ?? undefined)
}

export async function runForensicMailboxAttestationAfterSend(p: ForensicMailboxAttestationInput): Promise<boolean> {
  const rec = p.recipient.trim()
  const snd = p.senderAddress.trim()
  if (!rec || !snd) {
    if (!p.silent) {
      p.setStatusMsg(withMailboxDigest(`${p.baseSuccessMsg} (Attestation: Absender/Empfänger fehlt.)`, p.mailboxTxDigest))
    }
    return false
  }

  if (!p.silent) {
    p.setStatusMsg(
      withMailboxDigest(`${p.baseSuccessMsg} · Attestation wird verankert…`, p.mailboxTxDigest)
    )
  }

  try {
    const threadId = stableOfflineMailboxThreadId(snd, rec)
    const refPri = await computeCanonicalMsgRefV1({
      senderAddress: snd,
      recipientAddress: rec,
      threadId,
      messageNonceU64: p.primary.messageNonceU64,
      payloadUtf8: p.primary.payloadUtf8,
    })
    let refSec: string | null = null
    if (p.secondary) {
      refSec = await computeCanonicalMsgRefV1({
        senderAddress: snd,
        recipientAddress: rec,
        threadId,
        messageNonceU64: p.secondary.messageNonceU64,
        payloadUtf8: p.secondary.payloadUtf8,
      })
    }

    const mtx = p.mirrorMailboxTxDigest?.trim() || p.mailboxTxDigest?.trim() || ''
    const draft = {
      manifestVersion: 1 as const,
      canonicalMsgRefHex: refPri,
      ...(refSec ? { secondaryCanonicalMsgRefHex: refSec } : {}),
      ...(p.imageContentSha256Hex ? { imageContentSha256Hex: p.imageContentSha256Hex } : {}),
      ...(mtx && /^[0-9a-zA-Z+/=_-]+$/.test(mtx) && mtx.length <= 128 ? { mirrorMailboxTxDigest: mtx } : {}),
      observedAtMs: Date.now(),
      timeIsTrusted: !p.deviceTimeTrustWarn,
    }

    const en = enqueueAttestationManifestDraft(draft)
    if (!en.ok) {
      if (!p.silent) {
        p.setStatusMsg(
          withMailboxDigest(`${p.baseSuccessMsg} · Attestation nicht eingereiht: ${en.reason}`, p.mailboxTxDigest)
        )
      }
      return false
    }

    const d = await drainAttestationQueue()
    if (d.sent > 0) {
      if (!p.silent) {
        p.setStatusMsg(withMailboxDigest(`${p.baseSuccessMsg} · Attestation verankert.`, p.mailboxTxDigest))
      }
      return true
    }
    if (d.remaining > 0) {
      if (!p.silent) {
        p.setStatusMsg(
          withMailboxDigest(
            `${p.baseSuccessMsg} · Attestation ausstehend (Warteschlange — später erneut).`,
            p.mailboxTxDigest
          )
        )
      }
      return false
    }
    if (!p.silent) {
      p.setStatusMsg(
        withMailboxDigest(`${p.baseSuccessMsg} · Attestation konnte nicht verankert werden.`, p.mailboxTxDigest)
      )
    }
    return false
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    if (!p.silent) {
      p.setStatusMsg(
        withMailboxDigest(`${p.baseSuccessMsg} · Attestation abgebrochen: ${m.slice(0, 120)}`, p.mailboxTxDigest)
      )
    }
    return false
  }
}
