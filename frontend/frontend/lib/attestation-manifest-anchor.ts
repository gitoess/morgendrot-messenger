'use client'

/**
 * Attestation-Manifest v1 auf die Chain bringen: **Klartext-Mailbox-Hybrid** (Direct zuerst, sonst `/send-plain`)
 * an die **eigene** Session-Absenderadresse — sichtbar im Explorer, **ohne** die Messenger-Offline-Outbox zu nutzen.
 * @see docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md §8
 */

import type { AttestationManifestDraftV1, AttestationSubmitResult } from '@morgendrot/core/attestation'
import { nextOfflineMailboxClientOutSeq } from '@/frontend/lib/api/offline-queue'
import { MESSAGING_WIRE_UTF8_MAX } from '@/frontend/lib/compact-image-wire'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { sendPlaintextMailboxHybrid } from '@/frontend/lib/mailbox-send-hybrid'

export const MORG_ATTESTATION_MANIFEST_V1_PREFIX = '[[MORG_ATTESTATION_MANIFEST_V1]]'

export function buildAttestationManifestWire(draft: AttestationManifestDraftV1): string {
  const payload = JSON.stringify({
    v: draft.manifestVersion,
    ref: draft.canonicalMsgRefHex,
    ref2: draft.secondaryCanonicalMsgRefHex ?? undefined,
    img: draft.imageContentSha256Hex ?? undefined,
    mtx: draft.mirrorMailboxTxDigest ?? undefined,
    t: draft.observedAtMs,
    tt: draft.timeIsTrusted,
  })
  return `${MORG_ATTESTATION_MANIFEST_V1_PREFIX}\n${payload}`
}

export async function browserAttestationSubmit(draft: AttestationManifestDraftV1): Promise<AttestationSubmitResult> {
  const snap = getDirectMailboxChainSnapshot()
  const my = snap?.senderAddress?.trim() ?? ''
  if (!my) {
    return {
      ok: false,
      error:
        'Keine Mailbox-Absenderadresse (Snapshot) — Attestation-Anker braucht /api/current-ids oder persistierte Ketten-IDs.',
    }
  }
  const wire = buildAttestationManifestWire(draft)
  const n = new TextEncoder().encode(wire).length
  if (n > MESSAGING_WIRE_UTF8_MAX) {
    return { ok: false, error: `Attestation-Wire zu lang (${n} B UTF-8, max. ${MESSAGING_WIRE_UTF8_MAX}).` }
  }
  const r = await sendPlaintextMailboxHybrid(my, wire, BigInt(nextOfflineMailboxClientOutSeq()))
  if (r.ok) return { ok: true }
  return { ok: false, error: r.error || r.message || 'Attestation-Send fehlgeschlagen.' }
}
