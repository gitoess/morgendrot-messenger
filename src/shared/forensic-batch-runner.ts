/**
 * § H.33e — Boss-API Batch-Archiv (läuft auf dem PC, PWA darf zu sein).
 */
import { CFG } from '../config.js'
import {
    storeForensicEncryptedMailboxBatch,
    storeForensicPlaintextMailboxBatch,
} from '../chain-access.js'
import { fetchLastMessages, type FetchedMessage } from '../messenger-nest/messenger-fetch.js'
import { getWalletPassword } from '../messenger-nest/messenger-session-password.js'
import {
    prepareForensicBatchFromMessages,
    type ForensicBatchMessageInput,
    type ForensicBatchTxPlan,
} from '@morgendrot/core/forensic-batch'
import {
    readForensicBatchCanonicalRefSetServer,
    recordForensicBatchEntriesServer,
} from './forensic-batch-registry-file.js'
import { forensicBatchModeFromEnv, type ForensicBatchArchiveMode } from './forensic-batch-mode.js'
import { getEffectiveForensicBatchMode } from './forensic-batch-auto-config.js'
import { loadForensicBatchEcdhMaterialForSelfArchive } from './forensic-batch-ecdh.js'
import { encryptForensicWireToMailboxItem } from '@morgendrot/core/forensic-batch'
import { releaseForensicBatchRunLock, tryAcquireForensicBatchRunLock } from './forensic-batch-run-lock.js'
import { logger } from '../logger.js'

export type ForensicBatchRunResult =
    | {
          ok: true
          preparedCount: number
          alreadyBatched: number
          skippedCount: number
          txCount: number
          digests: string[]
          messageCount: number
          mode: ForensicBatchArchiveMode
      }
    | { ok: false; error: string; partialDigests?: string[]; mode?: ForensicBatchArchiveMode }

function mapFetchedToInput(m: FetchedMessage, idx: number): ForensicBatchMessageInput {
    return {
        id: m.inboxKey ?? `srv-${idx}-${m.nonce ?? m.ts ?? 0}`,
        from: m.sender,
        recipient: m.recipient,
        content: m.text ?? '',
        timestamp: m.ts ?? Date.now(),
        source: 'mailbox',
        transports: ['internet'],
        chainPurgeKind: m.chainPurgeKind,
        chainNonce: m.nonce,
    }
}

async function fetchServerInboxMessages(limit = 500): Promise<FetchedMessage[]> {
    const myAddr = (CFG.MY_ADDRESS || '').trim()
    if (!/^0x[a-fA-F0-9]{64}$/.test(myAddr)) {
        throw new Error('MY_ADDRESS fehlt oder ungültig.')
    }
    const out: FetchedMessage[] = []
    let offset = 0
    const page = Math.min(500, limit)
    for (;;) {
        const { messages, hasMore } = await fetchLastMessages(myAddr, null, null, page, undefined, undefined, {
            offset,
            skipMessagingEvents: true,
        })
        if (!messages.length) break
        out.push(...messages)
        if (!hasMore || out.length >= limit) break
        offset += messages.length
    }
    return out.slice(0, limit)
}

function nextBatchNonceBase(): bigint {
    return BigInt(Date.now()) * 1000n
}

async function submitPlan(
    plan: ForensicBatchTxPlan,
    archiveRecipient: string,
    senderAddress: string,
    walletPassword: string | undefined,
    mode: ForensicBatchArchiveMode
): Promise<{ ok: true; digest?: string } | { ok: false; error: string }> {
    let nonce = nextBatchNonceBase()
    if (mode === 'encrypted') {
        const ecdh = await loadForensicBatchEcdhMaterialForSelfArchive(archiveRecipient)
        if (!ecdh.ok) return { ok: false, error: ecdh.error }
        const encItems = []
        for (const item of plan.items) {
            const n = nonce
            nonce = nonce + 1n
            const enc = await encryptForensicWireToMailboxItem(
                item.wireUtf8,
                n,
                ecdh.material
            )
            if ('error' in enc) return { ok: false, error: enc.error }
            encItems.push(enc)
        }
        const res = await storeForensicEncryptedMailboxBatch(
            archiveRecipient,
            senderAddress,
            encItems,
            walletPassword
        )
        if (!res.digest && res.status !== 'success') {
            return { ok: false, error: `Chain-Status: ${res.status ?? 'unbekannt'}` }
        }
        return { ok: true, digest: res.digest }
    }
    const items = plan.items.map((item) => {
        const n = nonce
        nonce = nonce + 1n
        return { wireUtf8: item.wireUtf8, nonce: n }
    })
    const res = await storeForensicPlaintextMailboxBatch(
        archiveRecipient,
        senderAddress,
        items,
        walletPassword
    )
    if (!res.digest && res.status !== 'success') {
        return { ok: false, error: `Chain-Status: ${res.status ?? 'unbekannt'}` }
    }
    return { ok: true, digest: res.digest }
}

export async function runServerForensicBatchArchive(opts?: {
    onlyNew?: boolean
    inboxLimit?: number
    mode?: ForensicBatchArchiveMode
}): Promise<ForensicBatchRunResult> {
    const mode = opts?.mode ?? getEffectiveForensicBatchMode()
    const archiveRecipient = (CFG.MY_ADDRESS || '').trim().toLowerCase()
    const senderAddress = archiveRecipient
    if (!/^0x[a-f0-9]{64}$/.test(archiveRecipient)) {
        return { ok: false, error: 'MY_ADDRESS fehlt — Boss-.env prüfen.', mode }
    }
    if (mode === 'encrypted' && !getWalletPassword()) {
        return {
            ok: false,
            error: 'Verschlüsseltes Boss-Batch: Tresor entsperren (Wallet-Passwort in API-Session).',
            mode,
        }
    }
    try {
        const fetched = await fetchServerInboxMessages(opts?.inboxLimit ?? 500)
        const inputs = fetched.map(mapFetchedToInput)
        const skipCanonicalRefs =
            opts?.onlyNew !== false ? readForensicBatchCanonicalRefSetServer() : undefined
        const { prepared, skipped, alreadyBatched, plans } = await prepareForensicBatchFromMessages(
            inputs,
            { skipCanonicalRefs, planOpts: { mode } }
        )
        if (!plans.length) {
            if (prepared.length === 0 && alreadyBatched > 0) {
                return {
                    ok: false,
                    error: `Keine neuen Nachrichten — ${alreadyBatched} bereits batch-archiviert.`,
                    mode,
                }
            }
            return { ok: false, error: 'Keine archivierbaren Nachrichten.', mode }
        }
        const digests: string[] = []
        let messageCount = 0
        const pw = getWalletPassword()
        for (const plan of plans) {
            const out = await submitPlan(plan, archiveRecipient, senderAddress, pw, mode)
            if (!out.ok) {
                return {
                    ok: false,
                    error: out.error,
                    partialDigests: digests.length ? digests : undefined,
                    mode,
                }
            }
            if (out.digest) {
                digests.push(out.digest)
                await recordForensicBatchEntriesServer(
                    plan.items.map((item) => ({
                        canonicalMsgRef: item.meta.canonical_msg_ref,
                        messageId: item.messageId,
                        batchDigest: out.digest!,
                        encrypted: mode === 'encrypted',
                        batchIndex: plan.batchIndex,
                    }))
                )
            }
            messageCount += plan.items.length
        }
        return {
            ok: true,
            preparedCount: prepared.length,
            alreadyBatched,
            skippedCount: skipped.length,
            txCount: digests.length,
            digests,
            messageCount,
            mode,
        }
    } catch (e) {
        logger.warn('Forensic batch archive failed', e)
        return { ok: false, error: 'Batch-Archiv fehlgeschlagen — Details im Server-Log.', mode }
    }
}

/** Wie `runServerForensicBatchArchive`, aber mit globalem Mutex (Scheduler + POST /run). */
export async function runServerForensicBatchArchiveWithLock(opts?: {
    onlyNew?: boolean
    inboxLimit?: number
    mode?: ForensicBatchArchiveMode
}): Promise<ForensicBatchRunResult> {
    if (!tryAcquireForensicBatchRunLock()) {
        return {
            ok: false,
            error: 'Forensic-Batch läuft bereits — bitte warten.',
            mode: opts?.mode ?? forensicBatchModeFromEnv(),
        }
    }
    try {
        return await runServerForensicBatchArchive(opts)
    } finally {
        releaseForensicBatchRunLock()
    }
}
