'use client'

import {
  attachGasPaymentForOwner,
  buildStorePlaintextMailboxTransaction,
  createDirectIotaClient,
  signAndExecuteTransactionWithSigner,
} from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  canUseDirectPlaintextMailboxDrain,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { getDirectIotaSessionSigner, getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'

const LS_DRAIN = 'morgendrot.directMailboxDrain'

export function isDirectMailboxDrainEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_DRAIN) === '1'
  } catch {
    return false
  }
}

export function setDirectMailboxDrainEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) window.localStorage.setItem(LS_DRAIN, '1')
    else window.localStorage.removeItem(LS_DRAIN)
  } catch {
    /* ignore */
  }
}

function normalizeHexAddr(a: string): string {
  const t = a.trim().toLowerCase()
  return t.startsWith('0x') ? t : `0x${t}`
}

/**
 * Klartext-Mailbox (`store_plaintext_message`) **ohne** `/api` — nur wenn Schalter + RPC + Signer + Snapshot passen.
 */
export async function trySubmitPlaintextMailboxViaDirectIota(opts: {
  recipient: string
  payloadUtf8: string
  nonce: bigint
}): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  if (!isDirectMailboxDrainEnabled()) {
    return { ok: false, error: 'Direkt-Mailbox-Drain ist aus.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) {
    return { ok: false, error: 'Keine Direkt-RPC-URL (localStorage oder NEXT_PUBLIC_DIRECT_IOTA_RPC_URL).' }
  }
  const signer = getDirectIotaSessionSigner()
  const signerAddr = getDirectIotaSessionSignerAddress()
  if (!signer || !signerAddr) {
    return { ok: false, error: 'Kein Session-Signer — Mnemonic/Secret in den Einstellungen setzen (nur RAM).' }
  }
  const snap = getDirectMailboxChainSnapshot()
  if (!snap) {
    return {
      ok: false,
      error: 'Keine Ketten-IDs — Basis einmal verbinden oder Package/Mailbox/Absender in den Einstellungen speichern.',
    }
  }
  if (!canUseDirectPlaintextMailboxDrain()) {
    return {
      ok: false,
      error:
        'Server-Konfiguration passt nicht: Direkt-Pfad nur mit Mailbox-Klartext **ohne** Messenger-Credits (Flags aus letztem /api/status).',
    }
  }
  if (normalizeHexAddr(signerAddr) !== normalizeHexAddr(snap.senderAddress)) {
    return {
      ok: false,
      error: 'Signer-Adresse stimmt nicht mit gespeichertem Absender (MY_ADDRESS) überein.',
    }
  }
  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const plaintextUtf8 = new TextEncoder().encode(opts.payloadUtf8)
    const txb = buildStorePlaintextMailboxTransaction({
      packageId: snap.packageId,
      mailboxObjectId: snap.mailboxId,
      senderAddress: snap.senderAddress.trim(),
      recipientAddress: opts.recipient.trim(),
      plaintextUtf8,
      nonce: opts.nonce,
      ttlDays: snap.ttlDays,
    })
    await attachGasPaymentForOwner(client, txb, snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer })
    const st = (out.status || '').toLowerCase()
    if (st && st !== 'success') {
      return { ok: false, error: `Chain-Status: ${out.status || '?'}` }
    }
    return { ok: true, digest: out.digest }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
