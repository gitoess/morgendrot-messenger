'use client'

import {
  attachGasPaymentForOwner,
  buildSendPlaintextEventTransaction,
  buildStorePlaintextMailboxTransaction,
  isDirectChainExecutionSuccess,
  signAndExecuteTransactionWithSigner,
  validateMessagingMailboxObjectForPackage,
} from '@morgendrot/core/iota'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  getDirectChatEcdhPrivateKey,
} from '@/frontend/lib/direct-chat-ecdh-session'
import {
  canUseDirectPlaintextMailboxDrain,
  getDirectChainIdsReadiness,
  getDirectMailboxChainSnapshot,
  isDirectChainOptimisticFlagsEnabled,
} from '@/frontend/lib/direct-iota-chain-context'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import {
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
  hasPersistedDirectIotaSessionSigner,
} from '@/frontend/lib/direct-iota-mnemonic-session'

export type DirectIotaPathUiContext = {
  /** Aus letztem `/api/status` — steuert Offline→Online-Hinweis in der Pfadzeile. */
  backendOnline?: boolean
}

const LS_DRAIN = 'morgendrot.directMailboxDrain'
/** H.15 Stufe 0: fehlt oder `client` = Direkt-RPC erlaubt (wenn Drain an); `relay` = kein Klartext-Upload per Fullnode aus der PWA. */
const LS_SUBMIT_MODE = 'morgendrot.iotaSubmitMode'

import { notifyDirectIotaUiChanged } from '@/frontend/lib/direct-iota-ui-events'
import { resolveDirectMailboxUsePrivateMoveCall } from '@/frontend/lib/direct-mailbox-object-kind'
import { syncActiveNetworkChainSnapshot } from '@/frontend/lib/active-network-chain-sync'
import { resolveDirectIotaSubmitContext } from '@/frontend/lib/direct-iota-submit-context'
import {
  normalizeMessagingPersistenceMode,
  readMessagingPersistenceModeFromStorage,
  type MessagingPersistenceMode,
} from '@/frontend/lib/messaging-persistence-mode'
import { tryAutoRestoreDirectIotaSessionSignerAsync, tryAutoRestoreDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-vault-unlock-sync'

export { DIRECT_IOTA_UI_CHANGED, notifyDirectIotaUiChanged } from '@/frontend/lib/direct-iota-ui-events'

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

export function getDirectIotaPathUiState(ctx?: DirectIotaPathUiContext): DirectIotaPathUiState {
  if (typeof window === 'undefined') {
    return { mode: 'client', headline: '…', detail: '' }
  }
  const basisOffline = ctx?.backendOnline === false
  if (getIotaSubmitMode() === 'relay') {
    return {
      mode: 'relay',
      headline: 'Über Morgendrot-Relay',
      detail: 'Mailbox nutzt /api, wenn die Basis erreichbar ist. Direkt-RPC ist in Einstellungen deaktiviert.',
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
      detail: 'RPC-URL fehlt — in Einstellungen unter „Direkt-RPC · IDs · Funk“ eintragen.',
    }
  }
  if (!drain) {
    return {
      mode: 'client',
      headline: 'Direkt-RPC konfiguriert',
      detail: 'Direkt-Mailbox-Drain ist aus — in Einstellungen aktivieren, damit PTB + Signatur im Browser laufen.',
    }
  }
  if (!addr || !snap) {
    if (!addr && !snap) {
      return {
        mode: 'client',
        headline: 'Direkt-RPC vorbereitet',
        detail: 'Session-Signer (Mnemonic) und Ketten-IDs in Einstellungen setzen.',
      }
    }
    return {
      mode: 'client',
      headline: 'Direkt-RPC vorbereitet',
      detail: !addr
        ? 'Session-Signer in Einstellungen setzen (nur RAM).'
        : 'Ketten-IDs (Package / Mailbox / Absender) in Einstellungen speichern.',
    }
  }
  const offlineNote = basisOffline
    ? ' Morgendrot-Basis offline — Live-Send und Warteschlange nutzen weiter Direkt-RPC, Relay-Fallback erst wenn die Basis wieder erreichbar ist.'
    : ''
  return {
    mode: 'client',
    headline: 'Direkt-RPC aktiv',
    detail: `Signatur + PTB + RPC im Browser; bei Fehler Fallback über /api, wenn die Basis online ist.${offlineNote}`,
  }
}

/** Chat-Kopf / kompakte Zeilen — ohne langen Detailtext. */
export type AutarkyChecklistItem = { label: string; ok: boolean }

/** Autarkie-Checkliste im Puls — Ketten-IDs und Fullnode über `getDirectChainIdsReadiness()`. */
export function getAutarkyChecklistItems(): AutarkyChecklistItem[] {
  const { missing } = getDirectChainIdsReadiness()
  const rpcOk = !missing.includes('Fullnode-URL')
  const idsMissing = missing.filter((m) => m !== 'Fullnode-URL')
  const idsOk = idsMissing.length === 0

  return [
    { label: 'IOTA-Sendeweg = Direkt', ok: getIotaSubmitMode() === 'client' },
    { label: 'Direkt-Mailbox-Drain an', ok: isDirectMailboxDrainEnabled() },
    { label: 'Optimistische Flags an', ok: isDirectChainOptimisticFlagsEnabled() },
    { label: 'Fullnode-URL gesetzt', ok: rpcOk },
    {
      label: 'Signer aktiv oder lokal gespeichert',
      ok: !!getDirectIotaSessionSignerAddress() || hasPersistedDirectIotaSessionSigner(),
    },
    {
      label: idsOk
        ? 'Package/Mailbox/Absender (0x + 64 Hex) gesetzt'
        : `Ketten-IDs fehlen: ${idsMissing.join(', ')}`,
      ok: idsOk,
    },
    { label: 'Chat-ECDH-Privatkey (JWK) aktiv', ok: !!getDirectChatEcdhPrivateKey() },
  ]
}

/** Fehlende Schritte für vollständigen Direkt-Pfad (§ H.15 B.1 — Checkliste im Puls). */
export function listDirectIotaSetupGaps(): string[] {
  if (typeof window === 'undefined') return []
  if (isIotaRelayOnlyMode()) return []
  const gaps: string[] = []
  if (!isDirectMailboxDrainEnabled()) gaps.push('„Direkt-Mailbox-Drain“ einschalten')
  if (!getDirectIotaSessionSigner() || !getDirectIotaSessionSignerAddress()) {
    gaps.push('Session-Signer fehlt — Tresor entsperren (wird automatisch aus Vault geladen)')
  }
  const chain = getDirectChainIdsReadiness()
  if (!chain.ready) {
    for (const m of chain.missing) {
      if (m === 'Fullnode-URL') gaps.push('Fullnode-URL eintragen und speichern')
      else gaps.push(`${m} für Direkt-Pfad setzen (Puls oder Feld verlassen zum Speichern)`)
    }
  } else if (!canUseDirectPlaintextMailboxDrain()) {
    gaps.push(
      'Basis einmal verbinden für /api/status-Flags (Mailbox-Klartext ohne Credits) — oder „Optimistische Flags“ im Puls'
    )
  }
  if (!getDirectChatEcdhPrivateKey()) {
    if (!canUseDirectPlaintextMailboxDrain()) {
      gaps.push('Chat-ECDH-JWK in Puls anwenden (für verschlüsselten Direkt-Send)')
    }
  }
  return gaps
}

export function getDirectIotaPathUiShortLine(ctx?: DirectIotaPathUiContext): string {
  const s = getDirectIotaPathUiState(ctx)
  if (s.mode === 'relay') return 'über Relay (/api)'
  if (s.headline === 'Direkt-RPC aktiv' && ctx?.backendOnline === false) {
    return 'Direkt-RPC aktiv · Basis offline'
  }
  return s.headline
}

export function isDirectMailboxDrainEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_DRAIN) === '1'
  } catch {
    return false
  }
}

/** Live-Send (Composer): Direct-Klartext möglich — Event braucht nur Package+Signer; Mailbox zusätzlich Drain-Flags. */
export function canTryLivePlaintextDirectMailbox(): boolean {
  if (typeof window === 'undefined') return false
  tryAutoRestoreDirectIotaSessionSigner()
  if (
    isIotaRelayOnlyMode() ||
    !isDirectMailboxDrainEnabled() ||
    !getConfiguredDirectIotaRpcUrl() ||
    !getDirectIotaSessionSigner() ||
    !getDirectMailboxChainSnapshot()
  ) {
    return false
  }
  const mode = readMessagingPersistenceModeFromStorage()
  if (mode === 'event') return true
  return canUseDirectPlaintextMailboxDrain()
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

/**
 * Klartext **ohne** `/api` — Direct-RPC im Browser.
 * Respektiert `messagingPersistenceMode`: Event → `send_plaintext_message`; Mailbox → `store_plaintext_message*`.
 */
export async function trySubmitPlaintextMailboxViaDirectIota(opts: {
  recipient: string
  payloadUtf8: string
  nonce: bigint
  /** M4b: Kontakt-Mailbox statt Snapshot-Mailbox. */
  mailboxObjectId?: string
  messagingPersistenceMode?: MessagingPersistenceMode
}): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
  const ctx = resolveDirectIotaSubmitContext({
    relayBlockedMessage:
      'Modus „Nur Morgendrot-API“: direkter IOTA-Upload (Klartext-Mailbox) ist aus — in den Puls-Einstellungen auf „Direkt“ stellen.',
    requireRecipient: opts.recipient,
  })
  if (!ctx.ok) return ctx
  await tryAutoRestoreDirectIotaSessionSignerAsync()
  if (!canTryLivePlaintextDirectMailbox()) {
    return { ok: false, error: 'Direkt-Klartext-Send ist nicht bereit (Modus, Drain, RPC, Signer oder Ketten-IDs prüfen).' }
  }
  const persistenceMode = normalizeMessagingPersistenceMode(
    opts.messagingPersistenceMode ?? readMessagingPersistenceModeFromStorage()
  )
  const useEventPath = persistenceMode === 'event'
  if (!useEventPath && !canUseDirectPlaintextMailboxDrain()) {
    return {
      ok: false,
      error:
        'Server-Konfiguration passt nicht: Direkt-Pfad nur mit Mailbox-Klartext **ohne** Messenger-Credits (Flags aus letztem /api/status).',
    }
  }
  const recipient = ctx.recipient!
  try {
    const client = ctx.client
    const plaintextUtf8 = new TextEncoder().encode(opts.payloadUtf8)
    let txb
    if (useEventPath) {
      txb = buildSendPlaintextEventTransaction({
        packageId: ctx.snap.packageId,
        senderAddress: ctx.snap.senderAddress.trim(),
        recipientAddress: recipient,
        plaintextUtf8,
        nonce: opts.nonce,
      })
    } else {
      const { mailboxObjectId } = resolveDirectMailboxUsePrivateMoveCall({
        mailboxObjectId: opts.mailboxObjectId,
        serverMailboxId: ctx.snap.mailboxId,
      })
      const mailboxCheck = await validateMessagingMailboxObjectForPackage(
        client,
        mailboxObjectId,
        ctx.snap.packageId,
        'any'
      )
      if (!mailboxCheck.ok) {
        return { ok: false, error: mailboxCheck.error }
      }
      const privateMailbox = mailboxCheck.kind === 'privatemailbox'
      txb = buildStorePlaintextMailboxTransaction({
        packageId: ctx.snap.packageId,
        mailboxObjectId,
        senderAddress: ctx.snap.senderAddress.trim(),
        recipientAddress: recipient,
        plaintextUtf8,
        nonce: opts.nonce,
        ttlDays: ctx.snap.ttlDays,
        privateMailbox,
        stored: ctx.snap.flags.mailboxStorePlaintext === true,
      })
    }
    await attachGasPaymentForOwner(client, txb, ctx.snap.senderAddress.trim())
    const out = await signAndExecuteTransactionWithSigner({ client, transaction: txb, signer: ctx.signer })
    if (isDirectChainExecutionSuccess(out.digest, out.status)) {
      return { ok: true, digest: out.digest }
    }
    return {
      ok: false,
      error: `Chain-Status: ${out.status || 'kein Digest'} — im Explorer prüfen, ob die TX trotzdem existiert.`,
    }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
