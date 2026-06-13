'use client'

import { fetchInboxFromAllOwnedMailboxes } from '@/frontend/lib/inbox-multi-mailbox-fetch'
import { enrichInboxMessagesWithChainDigests } from '@/frontend/lib/enrich-inbox-messages-chain-digest'
import {
  prepareForensicBatchFromMessages,
  type ForensicBatchPreparedSkip,
  type ForensicBatchTxPlan,
} from '@/frontend/lib/einsatz-forensic-batch-entry'
import { trySubmitForensicBatchTxViaDirectIota } from '@/frontend/lib/direct-iota-forensic-batch-submit'
import { addManyTangleInventoryItems } from '@/frontend/lib/tangle-inventory'
import {
  readForensicBatchArchiveMode,
  type ForensicBatchArchiveMode,
} from '@/frontend/lib/forensic-batch-config'
import {
  readForensicBatchCanonicalRefSet,
  readForensicBatchRegistry,
  recordForensicBatchEntries,
  mergeForensicBatchRegistryImport,
} from '@/frontend/lib/forensic-batch-registry'
import {
  fetchForensicBatchRegistryFromBossApi,
  importForensicBatchRegistryToBossApi,
  runForensicBatchViaBossApi,
} from '@/frontend/lib/api/forensic-batch-api'
import { isFetchTransportFailureMessage } from '@/frontend/lib/api/boss-api-status'
import { withForensicBatchRunLock } from '@/frontend/lib/forensic-batch-run-lock'

export type RunForensicBatchArchiveFlowResult =
  | {
      ok: true
      preparedCount: number
      alreadyBatched: number
      skipped: ForensicBatchPreparedSkip[]
      txCount: number
      digests: string[]
      messageCount: number
      mode: ForensicBatchArchiveMode
    }
  | { ok: false; error: string; partialDigests?: string[] }

export type ForensicBatchArchivePreview = {
  preparedCount: number
  alreadyBatched: number
  skipped: ForensicBatchPreparedSkip[]
  plans: ForensicBatchTxPlan[]
  mode: ForensicBatchArchiveMode
}

async function loadInboxForBatch() {
  const inbox = await fetchInboxFromAllOwnedMailboxes({
    limit: 500,
    offset: 0,
    includePrivateMailboxes: true,
  })
  if (!inbox.ok) return { ok: false as const, error: inbox.error || 'Posteingang nicht geladen.' }
  return { ok: true as const, messages: enrichInboxMessagesWithChainDigests(inbox.messages) }
}

async function syncBossRegistryToLocal(): Promise<void> {
  const sync = await fetchForensicBatchRegistryFromBossApi()
  if (sync.ok && sync.entries.length) {
    mergeForensicBatchRegistryImport(sync.entries, 'merge')
  }
}

async function pushLocalRegistryToBoss(): Promise<void> {
  const entries = readForensicBatchRegistry()
  if (!entries.length) return
  await importForensicBatchRegistryToBossApi(entries, 'merge')
}

function bossSkippedSummary(count: number): ForensicBatchPreparedSkip[] {
  if (count <= 0) return []
  return [{ messageId: '_boss', reason: `${count} vom Server übersprungen (Wire zu lang).` }]
}

async function runViaBossApi(
  mode: ForensicBatchArchiveMode,
  onProgress?: (msg: string) => void
): Promise<RunForensicBatchArchiveFlowResult | null> {
  onProgress?.(`Batch via Boss-API (${mode})…`)
  const api = await runForensicBatchViaBossApi(mode)
  if (api.ok) {
    await syncBossRegistryToLocal()
    return {
      ok: true,
      preparedCount: api.preparedCount,
      alreadyBatched: api.alreadyBatched,
      skipped: bossSkippedSummary(api.skippedCount),
      txCount: api.txCount,
      digests: api.digests,
      messageCount: api.messageCount,
      mode: api.mode,
    }
  }
  if (!isFetchTransportFailureMessage(api.error)) {
    return { ok: false, error: api.error, partialDigests: api.partialDigests }
  }
  onProgress?.('Boss-API nicht erreichbar — Direkt-RPC-Fallback…')
  return null
}

async function runViaDirectRpc(opts: {
  archiveRecipient: string
  onlyNew?: boolean
  mode: ForensicBatchArchiveMode
  onProgress?: (msg: string) => void
}): Promise<RunForensicBatchArchiveFlowResult> {
  const built = await previewForensicBatchArchiveFromInbox({
    onlyNew: opts.onlyNew,
    mode: opts.mode,
  })
  if (!built.ok) return built
  const { preview } = built
  const { plans, skipped, preparedCount, alreadyBatched } = preview
  if (!plans.length) {
    if (preparedCount === 0 && alreadyBatched > 0) {
      return {
        ok: false,
        error: `Keine neuen Nachrichten — ${alreadyBatched} bereits batch-archiviert.`,
      }
    }
    return { ok: false, error: 'Keine archivierbaren Nachrichten (alle zu lang oder leer).' }
  }
  const digests: string[] = []
  let messageCount = 0
  for (const plan of plans) {
    opts.onProgress?.(
      `Batch ${plan.batchIndex + 1}/${plans.length} (${plan.items.length} Nachrichten, ${opts.mode})…`
    )
    const out = await trySubmitForensicBatchTxViaDirectIota({
      plan,
      recipientAddress: opts.archiveRecipient,
    })
    if (!out.ok) {
      return {
        ok: false,
        error: out.error,
        partialDigests: digests.length ? digests : undefined,
      }
    }
    if (out.digest) {
      digests.push(out.digest)
      recordForensicBatchEntries(
        plan.items.map((item) => ({
          canonicalMsgRef: item.meta.canonical_msg_ref,
          messageId: item.messageId,
          batchDigest: out.digest!,
          encrypted: opts.mode === 'encrypted',
          batchIndex: plan.batchIndex,
        }))
      )
      addManyTangleInventoryItems(
        plan.items.map((item, idx) => ({
          digest: out.digest!,
          type: item.meta.payload_mode === 'hash_only' ? ('image' as const) : ('text' as const),
          status: 'anchored' as const,
          origin: 'forensic-batch' as const,
          nonce: item.meta.canonical_msg_ref.slice(0, 16),
          encrypted: opts.mode === 'encrypted',
          contentPreview: `[Batch ${plan.batchIndex + 1}/${idx + 1}] ${item.meta.sender.slice(0, 10)}…`,
          anchorHashHex: item.meta.content_sha256_hex,
          evidenceSecuredAt: Date.now(),
        }))
      )
    }
    messageCount += out.messageCount
  }
  await pushLocalRegistryToBoss()
  return {
    ok: true,
    preparedCount,
    alreadyBatched,
    skipped,
    txCount: digests.length,
    digests,
    messageCount,
    mode: opts.mode,
  }
}

export async function previewForensicBatchArchiveFromInbox(opts?: {
  onlyNew?: boolean
  mode?: ForensicBatchArchiveMode
}): Promise<{ ok: true; preview: ForensicBatchArchivePreview } | { ok: false; error: string }> {
  const inbox = await loadInboxForBatch()
  if (!inbox.ok) return inbox
  const mode = opts?.mode ?? readForensicBatchArchiveMode()
  const skipCanonicalRefs = opts?.onlyNew !== false ? readForensicBatchCanonicalRefSet() : undefined
  const { prepared, skipped, alreadyBatched, plans } = await prepareForensicBatchFromMessages(
    inbox.messages,
    { skipCanonicalRefs, planOpts: { mode } }
  )
  return {
    ok: true,
    preview: { preparedCount: prepared.length, alreadyBatched, skipped, plans, mode },
  }
}

export async function runForensicBatchArchiveFromInbox(opts: {
  archiveRecipient: string
  onProgress?: (msg: string) => void
  onlyNew?: boolean
  mode?: ForensicBatchArchiveMode
  preferBossApi?: boolean
}): Promise<RunForensicBatchArchiveFlowResult> {
  const mode = opts.mode ?? readForensicBatchArchiveMode()
  const locked = await withForensicBatchRunLock(async () => {
    if (opts.preferBossApi) {
      const boss = await runViaBossApi(mode, opts.onProgress)
      if (boss) return boss
    }
    return runViaDirectRpc({
      archiveRecipient: opts.archiveRecipient,
      onlyNew: opts.onlyNew,
      mode,
      onProgress: opts.onProgress,
    })
  })
  if ('ok' in locked && locked.ok === false) return locked
  return locked as RunForensicBatchArchiveFlowResult
}
