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
/** H.15 Stufe 0: fehlt oder `client` = Direkt-RPC erlaubt (wenn Drain an); `relay` = kein Klartext-Upload per Fullnode aus der PWA. */
const LS_SUBMIT_MODE = 'morgendrot.iotaSubmitMode'

/** Chat-Header / Einstellungen: gleicher Tab hört kein `storage` — nach LS-Änderungen feuern. */
export const DIRECT_IOTA_UI_CHANGED = 'morgendrot-direct-iota-ui-changed' as const

export function notifyDirectIotaUiChanged(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(DIRECT_IOTA_UI_CHANGED))
  } catch {
    /* ignore */
  }
}

export type IotaSubmitMode = 'client' | 'relay'

export function getIotaSubmitMode(): IotaSubmitMode {
  if (typeof window === 'undefined') return 'client'
  try {
    return window.localStorage.getItem(LS_SUBMIT_MODE) === 'relay' ? 'relay' : 'client'
  } catch {
    return 'client'
  }
}

export function setIotaSubmitMode(mode: IotaSubmitMode): void {
  if (typeof window === 'undefined') return
  try {
    if (mode === 'relay') window.localStorage.setItem(LS_SUBMIT_MODE, 'relay')
    else window.localStorage.removeItem(LS_SUBMIT_MODE)
  } catch {
    /* ignore */
  }
  notifyDirectIotaUiChanged()
}

export function isIotaRelayOnlyMode(): boolean {
  return getIotaSubmitMode() === 'relay'
}

/** Kurztext für Einstellungen / Statuszeile (Handy-first, § H.15). */
export type DirectIotaPathUiState = {
  mode: 'relay' | 'client'
  headline: string
  detail: string
}

export function getDirectIotaPathUiState(): DirectIotaPathUiState {
  if (typeof window === 'undefined') {
    return { mode: 'client', headline: '…', detail: '' }
  }
  if (getIotaSubmitMode() === 'relay') {
    return {
      mode: 'relay',
      headline: 'Über Morgendrot-Relay',
      detail: 'Mailbox nutzt /api, wenn die Basis erreichbar ist. Direkt-RPC im Chat → Puls ist aus.',
    }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  const drain = isDirectMailboxDrainEnabled()
  const addr = getDirectIotaSessionSignerAddress()
  const snap = getDirectMailboxChainSnapshot()
  if (!rpc) {
    return {
      mode: 'client',
      headline: 'Direkt gewählt',
      detail: 'RPC-URL fehlt — unter Chat → Puls (Direkt-RPC) eintragen.',
    }
  }
  if (!drain) {
    return {
      mode: 'client',
      headline: 'Direkt-RPC konfiguriert',
      detail: 'Direkt-Mailbox-Drain ist aus — in Chat → Puls aktivieren, damit PTB + Signatur im Browser laufen.',
    }
  }
  if (!addr || !snap) {
    if (!addr && !snap) {
      return {
        mode: 'client',
        headline: 'Direkt-RPC vorbereitet',
        detail: 'Session-Signer (Mnemonic) und Ketten-IDs in Chat → Puls setzen.',
      }
    }
    return {
      mode: 'client',
      headline: 'Direkt-RPC vorbereitet',
      detail: !addr
        ? 'Session-Signer in Chat → Puls — nur RAM.'
        : 'Ketten-IDs (Package / Mailbox / Absender) in Chat → Puls speichern.',
    }
  }
  return {
    mode: 'client',
    headline: 'Direkt-RPC aktiv',
    detail: 'Signatur + PTB + RPC im Browser; bei Fehler Fallback über /api, wenn die Basis online ist.',
  }
}

export function isDirectMailboxDrainEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_DRAIN) === '1'
  } catch {
    return false
  }
}

/** Live-Send (Composer): Direct-Klartext-Mailbox möglich — gleiche Voraussetzungen wie Offline-Drain. */
export function canTryLivePlaintextDirectMailbox(): boolean {
  if (typeof window === 'undefined') return false
  return (
    !isIotaRelayOnlyMode() &&
    isDirectMailboxDrainEnabled() &&
    Boolean(getConfiguredDirectIotaRpcUrl()) &&
    Boolean(getDirectIotaSessionSigner()) &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    canUseDirectPlaintextMailboxDrain()
  )
}

export function setDirectMailboxDrainEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) window.localStorage.setItem(LS_DRAIN, '1')
    else window.localStorage.removeItem(LS_DRAIN)
  } catch {
    /* ignore */
  }
  notifyDirectIotaUiChanged()
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
  /** M4b: Kontakt-Mailbox statt Snapshot-Mailbox. */
  mailboxObjectId?: string
}): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  if (isIotaRelayOnlyMode()) {
    return {
      ok: false,
      error: 'Modus „Nur Morgendrot-API“: direkter IOTA-Upload (Klartext-Mailbox) ist aus — in den Puls-Einstellungen auf „Direkt“ stellen.',
    }
  }
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
    const mbOverride = (opts.mailboxObjectId ?? '').trim()
    const mailboxObjectId =
      /^0x[a-fA-F0-9]{64}$/i.test(mbOverride) && mbOverride.toLowerCase() !== snap.mailboxId.toLowerCase()
        ? mbOverride
        : snap.mailboxId
    const txb = buildStorePlaintextMailboxTransaction({
      packageId: snap.packageId,
      mailboxObjectId,
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
