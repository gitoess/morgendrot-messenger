'use client'

/**
 * §6.B.4: Mailbox-Posteingang per Fullnode (Klartext und/oder verschlüsselt, Entschlüsselung im Browser).
 * Merge mit `/inbox` steuert **`use-chat-view-inbox`** (RPC vor API).
 */

import {
  chainMessageLogicalDedupKey,
  createDirectIotaClient,
  fetchMailboxInboxRpcRows,
  fetchMessagingEventInboxRpcRows,
  fetchMessagingEventInboxViaAddressTxs,
  fetchTeamPlainBroadcastRpcRows,
  fetchTeamEncBroadcastRpcRows,
  isLikelyIotaHexId,
  mailboxPlainInboxKey,
  mailboxEncryptedInboxKey,
  normalizeMailboxAddress,
  resolveIotaIndexerRpcUrl,
  type MessagingEventInboxRpcRow,
} from '@morgendrot/core/iota'
import type { InboxApiRow } from '@/frontend/features/inbox/inbox-map-messages'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import {
  canUseDirectEncryptedMailboxDrain,
  canUseDirectPlaintextMailboxDrain,
  getDirectChainIdsReadiness,
  getDirectMailboxChainSnapshot,
} from '@/frontend/lib/direct-iota-chain-context'
import { isStandaloneDeviceMode } from '@/frontend/lib/capacitor-standalone-bootstrap'
import { getDirectChatEcdhPrivateKey } from '@/frontend/lib/direct-chat-ecdh-session'
import { decryptDirectInboxEncryptedPayload } from '@/frontend/lib/direct-iota-inbox-decrypt'
import { decryptTeamBroadcastInboxPayload } from '@/frontend/lib/team-broadcast-inbox-decrypt'
import { formatDirectIotaSubmitError } from '@/frontend/lib/direct-iota-error-messages'
import { isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'

export type TryFetchDirectMailboxInboxViaIotaOpts = {
  limit: number
  offset: number
  packageIdOverride?: string
  mailboxObjectId?: string
  includeMessagingEvents?: boolean
}

type PendingEncryptedRow = {
  sortTs: number
  sender: string
  recipient: string
  nonce: string
  ts: number
  inboxKey: string
  peerAddr: string
  iv: Uint8Array
  ciphertext: Uint8Array
  tag: Uint8Array
  chainPurgeable: boolean
  chainMailboxObjectId?: string
  decryptErrorPrefix: string
}

type PendingTeamEncRow = {
  sortTs: number
  sender: string
  teamMailboxObjectId: string
  nonce: string
  ts: number
  inboxKey: string
  ciphertext: Uint8Array
  iv: Uint8Array
  tag: Uint8Array
  keyEpoch: number
}

type SortableInboxEntry =
  | { sortTs: number; row: InboxApiRow }
  | { sortTs: number; pending: PendingEncryptedRow }
  | { sortTs: number; teamEnc: PendingTeamEncRow }

function shouldIncludeMessagingEventsInDirectInbox(mailboxObjectId: string, sharedMailboxId: string): boolean {
  const mb = mailboxObjectId.trim().toLowerCase()
  const shared = sharedMailboxId.trim().toLowerCase()
  return mb === shared
}

function inboxTsFromRow(tsMs: number, nonce: bigint): number {
  if (tsMs > 0) return tsMs
  const n = Number(nonce)
  return Number.isFinite(n) && n >= 1_000_000_000_000 ? n : 0
}

function sortAndSliceInboxEntries(entries: SortableInboxEntry[], limit: number, offset: number): SortableInboxEntry[] {
  entries.sort((a, b) => b.sortTs - a.sortTs)
  return entries.slice(offset, offset + limit)
}

async function mapEventRowsToInboxApi(
  eventRows: MessagingEventInboxRpcRow[],
  myNorm: string
): Promise<InboxApiRow[]> {
  const apiRows: InboxApiRow[] = []
  for (const r of eventRows) {
    if (r.kind === 'plain') {
      apiRows.push({
        sender: r.sender,
        recipient: r.recipient,
        text: r.text,
        isPlain: true,
        nonce: String(r.nonce),
        ts: r.tsMs,
        chainPurgeable: false,
        inboxKey: r.inboxKey,
      })
      continue
    }
    const peerAddr = normalizeMailboxAddress(r.sender) === myNorm ? r.recipient : r.sender
    const dec = await decryptDirectInboxEncryptedPayload(
      peerAddr,
      {
        iv: r.iv,
        ciphertext: r.ciphertext,
        tag: r.tag,
      },
      { sender: r.sender, recipient: r.recipient }
    )
    apiRows.push({
      sender: r.sender,
      recipient: r.recipient,
      text: dec.ok ? dec.text : `${dec.error} (Event).`,
      isPlain: false,
      nonce: String(r.nonce),
      ts: r.tsMs,
      chainPurgeable: false,
      inboxKey: r.inboxKey,
    })
  }
  return apiRows
}

async function resolvePendingEncryptedRow(pending: PendingEncryptedRow): Promise<InboxApiRow> {
  const dec = await decryptDirectInboxEncryptedPayload(
    pending.peerAddr,
    {
      iv: pending.iv,
      ciphertext: pending.ciphertext,
      tag: pending.tag,
    },
    { sender: pending.sender, recipient: pending.recipient }
  )
  return {
    sender: pending.sender,
    recipient: pending.recipient,
    text: dec.ok ? dec.text : `${dec.error.replace('[Verschlüsselt] ', pending.decryptErrorPrefix)}`,
    isPlain: false,
    nonce: pending.nonce,
    ts: pending.ts,
    chainPurgeable: pending.chainPurgeable,
    ...(pending.chainMailboxObjectId
      ? { chainMailboxObjectId: pending.chainMailboxObjectId }
      : {}),
    inboxKey: pending.inboxKey,
  }
}

async function resolvePendingTeamEncRow(pending: PendingTeamEncRow): Promise<InboxApiRow> {
  const dec = await decryptTeamBroadcastInboxPayload({
    teamMailboxObjectId: pending.teamMailboxObjectId,
    ciphertext: pending.ciphertext,
    iv: pending.iv,
    tag: pending.tag,
    keyEpoch: pending.keyEpoch,
  })
  return {
    sender: pending.sender,
    recipient: pending.teamMailboxObjectId,
    text: dec.ok ? dec.text : dec.error,
    isPlain: false,
    nonce: pending.nonce,
    ts: pending.ts,
    chainPurgeable: true,
    chainPurgeKind: 'team-broadcast',
    chainMailboxObjectId: pending.teamMailboxObjectId,
    inboxKey: pending.inboxKey,
  }
}

async function materializeInboxPage(entries: SortableInboxEntry[]): Promise<InboxApiRow[]> {
  const rows: InboxApiRow[] = []
  for (const entry of entries) {
    if ('row' in entry) {
      rows.push(entry.row)
    } else if ('teamEnc' in entry) {
      rows.push(await resolvePendingTeamEncRow(entry.teamEnc))
    } else {
      rows.push(await resolvePendingEncryptedRow(entry.pending))
    }
  }
  return rows
}

function canIncludePlaintextInDirectInbox(): boolean {
  if (canUseDirectPlaintextMailboxDrain()) return true
  return isStandaloneDeviceMode() && Boolean(getDirectMailboxChainSnapshot())
}

function canIncludeEncryptedInDirectInbox(): boolean {
  if (canUseDirectEncryptedMailboxDrain()) return true
  return (
    isStandaloneDeviceMode() &&
    Boolean(getDirectMailboxChainSnapshot()) &&
    Boolean(getDirectChatEcdhPrivateKey())
  )
}

async function resolveDirectInboxPackageIds(primary: string): Promise<string[]> {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const id = raw.trim()
    if (!isLikelyIotaHexId(id)) return
    const k = id.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(id)
  }
  push(primary)
  try {
    const { fetchPackageIdHistory } = await import('@/frontend/lib/api/package-id-history')
    const hist = await fetchPackageIdHistory()
    if (hist.ok) {
      if (hist.current) push(hist.current)
      for (const id of hist.history ?? []) push(id)
      for (const id of hist.discovered ?? []) push(id)
    }
  } catch {
    /* best-effort — Primary reicht als Fallback */
  }
  return out
}

export async function tryFetchDirectMailboxInboxViaIota(
  opts: TryFetchDirectMailboxInboxViaIotaOpts
): Promise<{ ok: true; rows: InboxApiRow[]; hasMore?: boolean } | { ok: false; error: string }> {
  if (isIotaRelayOnlyMode()) {
    return { ok: false, error: 'Modus „Nur Morgendrot-API“: direkter Posteingang per Fullnode ist aus.' }
  }
  const rpc = getConfiguredDirectIotaRpcUrl()
  if (!rpc) return { ok: false, error: 'Keine Direkt-RPC-URL.' }
  const snap = getDirectMailboxChainSnapshot()
  if (!snap) {
    const { missing } = getDirectChainIdsReadiness()
    return {
      ok: false,
      error:
        missing.length > 0
          ? `Ketten-IDs für Direkt-Posteingang unvollständig: ${missing.join(', ')}.`
          : 'Keine Ketten-IDs (Snapshot).',
    }
  }
  const includePlain = canIncludePlaintextInDirectInbox()
  const includeEnc = canIncludeEncryptedInDirectInbox()
  const includeTeamBroadcast = Boolean(snap?.flags.useMailbox)
  if (!includePlain && !includeEnc && !includeTeamBroadcast) {
    return {
      ok: false,
      error:
        'Konfiguration: direkter Posteingang nur mit aktiver Mailbox ohne Messenger-Credits (Klartext-Flags oder verschlüsselt mit Direkt-Mailbox-Drain an).',
    }
  }
  const pkg = snap.packageId.trim()
  if (opts.packageIdOverride?.trim() && opts.packageIdOverride.trim().toLowerCase() !== pkg.toLowerCase()) {
    return { ok: false, error: 'Package-ID weicht vom gespeicherten Snapshot ab — Posteingang per API laden.' }
  }
  const mailboxObjectId = (opts.mailboxObjectId?.trim() || snap.mailboxId).trim()
  if (!isLikelyIotaHexId(mailboxObjectId)) {
    return { ok: false, error: 'Ungültige Mailbox-ID für Direkt-Posteingang.' }
  }
  const my = snap.senderAddress.trim()
  const myNorm = normalizeMailboxAddress(my)

  try {
    const client = createDirectIotaClient({ rpcUrl: rpc })
    const fetchWindow = opts.limit + opts.offset
    const rpcRows = await fetchMailboxInboxRpcRows(client, {
      mailboxObjectId,
      packageId: pkg,
      myAddress: my,
      includePlaintext: includePlain,
      includeEncrypted: includeEnc,
      limit: fetchWindow,
      offset: 0,
    })

    const sortable: SortableInboxEntry[] = []
    for (const r of rpcRows) {
      if (r.kind === 'plain') {
        const ts = r.ts ?? 0
        sortable.push({
          sortTs: inboxTsFromRow(ts, BigInt(r.nonce)),
          row: {
            sender: r.sender,
            recipient: r.recipient,
            text: r.text,
            isPlain: true,
            nonce: r.nonce,
            ts,
            chainPurgeable: true,
            chainMailboxObjectId: mailboxObjectId,
            inboxKey: mailboxPlainInboxKey({
              sender: r.sender,
              recipient: r.recipient,
              nonce: r.nonce,
              tsMs: ts,
            }),
          },
        })
        continue
      }
      const peerAddr = normalizeMailboxAddress(r.sender) === myNorm ? r.recipient : r.sender
      const ts = r.ts ?? 0
      sortable.push({
        sortTs: inboxTsFromRow(ts, BigInt(r.nonce)),
        pending: {
          sortTs: inboxTsFromRow(ts, BigInt(r.nonce)),
          sender: r.sender,
          recipient: r.recipient,
          nonce: r.nonce,
          ts,
          peerAddr,
          iv: r.iv,
          ciphertext: r.ciphertext,
          tag: r.tag,
          chainPurgeable: true,
          chainMailboxObjectId: mailboxObjectId,
          decryptErrorPrefix: 'Entschlüsselung fehlgeschlagen (Key passt nicht oder Nutzlast beschädigt).',
          inboxKey: mailboxEncryptedInboxKey({
            sender: r.sender,
            recipient: r.recipient,
            nonce: r.nonce,
            tsMs: ts,
          }),
        },
      })
    }

    if (includeTeamBroadcast) {
      const teamRows = await fetchTeamPlainBroadcastRpcRows(client, {
        teamMailboxObjectId: mailboxObjectId,
        packageId: pkg,
        limit: fetchWindow,
        offset: 0,
      })
      for (const r of teamRows) {
        const sortTs = inboxTsFromRow(r.ts ?? 0, BigInt(r.nonce))
        sortable.push({
          sortTs,
          row: {
            sender: r.sender,
            recipient: r.teamMailboxObjectId,
            text: r.text,
            isPlain: true,
            nonce: r.nonce,
            /** Immer sortTs — roh ts=0 würde die UI-Zeile nach Reload „verschwinden“ (unten). */
            ts: sortTs,
            chainPurgeable: true,
            chainPurgeKind: 'team-broadcast',
            chainMailboxObjectId: r.teamMailboxObjectId,
            inboxKey: `team:${r.teamMailboxObjectId}:${r.sender}:${r.nonce}`,
          },
        })
      }
      const teamEncRows = await fetchTeamEncBroadcastRpcRows(client, {
        teamMailboxObjectId: mailboxObjectId,
        packageId: pkg,
        limit: fetchWindow,
        offset: 0,
      })
      for (const r of teamEncRows) {
        const sortTs = inboxTsFromRow(r.ts ?? 0, BigInt(r.nonce))
        sortable.push({
          sortTs,
          teamEnc: {
            sortTs,
            sender: r.sender,
            teamMailboxObjectId: r.teamMailboxObjectId,
            nonce: r.nonce,
            ts: sortTs,
            inboxKey: `team-enc:${r.teamMailboxObjectId}:${r.sender}:${r.nonce}`,
            ciphertext: r.ciphertext,
            iv: r.iv,
            tag: r.tag,
            keyEpoch: r.keyEpoch,
          },
        })
      }
    }

    const mailboxLogicalKeys = new Set<string>()
    for (const entry of sortable) {
      if ('row' in entry) {
        if (entry.row.chainPurgeable === false) continue
        const lk = chainMessageLogicalDedupKey({
          sender: entry.row.sender ?? '',
          recipient: entry.row.recipient,
          nonce: entry.row.nonce ?? '',
        })
        if (lk) mailboxLogicalKeys.add(lk)
        continue
      }
      if ('teamEnc' in entry) {
        const lk = chainMessageLogicalDedupKey({
          sender: entry.teamEnc.sender,
          recipient: entry.teamEnc.teamMailboxObjectId,
          nonce: entry.teamEnc.nonce,
        })
        if (lk) mailboxLogicalKeys.add(lk)
        continue
      }
      const lk = chainMessageLogicalDedupKey({
        sender: entry.pending.sender,
        recipient: entry.pending.recipient,
        nonce: entry.pending.nonce,
      })
      if (lk) mailboxLogicalKeys.add(lk)
    }

    const includeEvents =
      opts.includeMessagingEvents !== false &&
      shouldIncludeMessagingEventsInDirectInbox(mailboxObjectId, snap.mailboxId)
    if (includeEvents) {
      /**
       * Wie Backend-Union: alle Package-IDs (Historie). Früher nur snap.packageId + max 15 Event-Seiten
       * → Posteingang blieb bei ~100 stecken, hasMore tot.
       */
      const eventNeed = fetchWindow
      const pushEventRows = async (eventRows: MessagingEventInboxRpcRow[]) => {
        const eventApiRows = await mapEventRowsToInboxApi(eventRows, myNorm)
        for (const row of eventApiRows) {
          const lk = chainMessageLogicalDedupKey({
            sender: row.sender ?? '',
            recipient: row.recipient,
            nonce: row.nonce ?? '',
          })
          if (lk && mailboxLogicalKeys.has(lk)) continue
          sortable.push({
            sortTs: inboxTsFromRow(Number(row.ts ?? 0), BigInt(String(row.nonce ?? 0))),
            row,
          })
        }
      }
      /**
       * H.22 Rest: Indexer (FromOrToAddress) **und** Package-queryEvents mergen.
       * Früher: bei indexerScanned>0 kein Package-Fallback → Lücken wenn Indexer
       * Teiltreffer liefert, EncryptedMessage aber nur noch über queryEvents erreichbar.
       * Dedup: Logical-Key vs. Mailbox + inboxKey zwischen Event-Quellen.
       */
      const eventInboxKeys = new Set<string>()
      const pushEventRowsDeduped = async (eventRows: MessagingEventInboxRpcRow[]) => {
        const fresh = eventRows.filter((r) => {
          const k = (r.inboxKey || '').trim()
          if (!k) return true
          if (eventInboxKeys.has(k)) return false
          eventInboxKeys.add(k)
          return true
        })
        await pushEventRows(fresh)
      }
      const indexerUrl = resolveIotaIndexerRpcUrl(rpc)
      const addrClient = indexerUrl ? createDirectIotaClient({ rpcUrl: indexerUrl }) : client
      try {
        const addrRows = await fetchMessagingEventInboxViaAddressTxs(addrClient, {
          myAddress: my,
          limit: eventNeed,
          offset: 0,
          maxTxPages: Math.min(100, Math.max(25, Math.ceil(eventNeed / 5) + 20)),
        })
        await pushEventRowsDeduped(addrRows)
      } catch {
        /* Indexer optional — Package-Pfad folgt */
      }
      const packageIds = await resolveDirectInboxPackageIds(pkg)
      const maxEventPages = Math.min(200, Math.max(40, Math.ceil(fetchWindow / 5) + 20))
      for (const packageId of packageIds) {
        const eventRows = await fetchMessagingEventInboxRpcRows(client, {
          packageId,
          myAddress: my,
          limit: eventNeed,
          offset: 0,
          maxEventPages,
        })
        await pushEventRowsDeduped(eventRows)
      }
    }

    const totalBeforeSlice = sortable.length
    const pageEntries = sortAndSliceInboxEntries(sortable, opts.limit, opts.offset)
    const rows = await materializeInboxPage(pageEntries)
    const hasMore = totalBeforeSlice > opts.offset + opts.limit
    return { ok: true, rows, hasMore }
  } catch (e) {
    return { ok: false, error: formatDirectIotaSubmitError(e) }
  }
}
