/**
 * Boss-Signer PTB-Allowlist — nur erlaubte Move-Calls signieren (SIGNER=remote / Feldgeräte).
 */
import { Transaction } from '@iota/iota-sdk/transactions'
import { normalizeBossSignerTxBase64 } from './boss-signer-lib.js'

export type BossSignerPtbPolicy = 'worker-messenger' | 'off'

const PACKAGE_ID_REGEX = /^0x[a-fA-F0-9]{64}$/

/**
 * Move-Funktionen, die ein Remote-Helfer/Arbeiter-Messenger signieren darf.
 * Alles andere (Keys, Vault-Purge, Mint, Globals, Transfer, …) wird abgelehnt.
 */
export const WORKER_MESSENGER_ALLOWED_FUNCTIONS = new Set([
    'emit_ecdh_init',
    'emit_pairing_offer',
    'send_encrypted_message',
    'send_plaintext_message',
    'store_ecdh_init',
    'store_ecdh_init_private',
    'store_ecdh_init_with_credits',
    'store_encrypted_message',
    'store_encrypted_message_private',
    'store_encrypted_message_with_credits',
    'store_plaintext_message',
    'store_plaintext_message_stored',
    'store_plaintext_message_stored_private',
    'store_plaintext_message_private',
    'store_plaintext_message_with_credits',
    'store_plaintext_message_with_credits_stored',
    'store_team_plaintext_broadcast',
    'store_team_encrypted_broadcast',
    'purge_handshake',
    'purge_handshake_private',
    'purge_message',
    'purge_message_private',
    'purge_plaintext_mail_entry',
    'purge_plaintext_mail_entry_private',
    'purge_team_plaintext_broadcast',
    'purge_team_encrypted_broadcast',
    'create_team_mailbox',
    'create_private_mailbox',
    'purge_private_mailbox',
    'use_ticket',
    'use_ticket_with_origin',
    'use_ticket_from_registry',
])

export type BossSignerPtbValidation =
    | { ok: true; moveCalls: Array<{ packageId: string; module: string; function: string }> }
    | { ok: false; error: string }

export function resolveBossSignerPtbPolicy(raw: string | undefined): BossSignerPtbPolicy {
    const v = (raw || '').trim().toLowerCase()
    return v === 'off' ? 'off' : 'worker-messenger'
}

export function parseBossSignerAllowedPackageIds(
    rawList: string | undefined,
    packageIdFallback?: string
): Set<string> {
    const out = new Set<string>()
    const add = (id: string) => {
        const n = id.trim().toLowerCase()
        if (PACKAGE_ID_REGEX.test(n)) out.add(n)
    }
    if (rawList?.trim()) {
        for (const part of rawList.split(/[\s,;]+/)) {
            if (part.trim()) add(part)
        }
    }
    if (packageIdFallback?.trim()) add(packageIdFallback)
    return out
}

export function validateBossSignerPtbPolicyConfig(
    policy: BossSignerPtbPolicy,
    allowedPackages: Set<string>,
    allowInsecure: boolean
): string | null {
    if (policy === 'off') {
        return allowInsecure
            ? null
            : 'BOSS_SIGNER_PTB_POLICY=off nur mit BOSS_SIGNER_ALLOW_INSECURE=1 (Entwicklung).'
    }
    if (allowedPackages.size === 0) {
        return 'PACKAGE_ID oder BOSS_SIGNER_ALLOWED_PACKAGE_IDS fehlt — PTB-Allowlist braucht deploytes Package.'
    }
    return null
}

type MoveCallRef = { packageId: string; module: string; function: string }

function commandKind(cmd: Record<string, unknown>): string {
    if (typeof cmd.$kind === 'string') return cmd.$kind
    if (cmd.MoveCall) return 'MoveCall'
    return 'Unknown'
}

function extractMoveCallsFromTransaction(tx: Transaction): MoveCallRef[] {
    const commands = tx.getData().commands as Array<Record<string, unknown>>
    const out: MoveCallRef[] = []
    for (const cmd of commands) {
        const kind = commandKind(cmd)
        if (kind !== 'MoveCall') continue
        const mc = (cmd.MoveCall ?? cmd) as {
            package?: string
            module?: string
            function?: string
        }
        const packageId = String(mc.package ?? '').trim().toLowerCase()
        const module = String(mc.module ?? '').trim()
        const fn = String(mc.function ?? '').trim()
        if (!packageId || !module || !fn) {
            throw new Error('MoveCall ohne package/module/function in TX.')
        }
        out.push({ packageId, module, function: fn })
    }
    return out
}

export function parseBossSignerTransactionMoveCalls(txBytes: Uint8Array): MoveCallRef[] {
    let tx: Transaction
    try {
        tx = Transaction.from(txBytes)
    } catch {
        tx = Transaction.fromKind(txBytes)
    }
    return extractMoveCallsFromTransaction(tx)
}

export function validateBossSignerPtbBytes(
    txBytesBase64: string,
    policy: BossSignerPtbPolicy,
    allowedPackages: Set<string>
): BossSignerPtbValidation {
    if (policy === 'off') {
        return { ok: true, moveCalls: [] }
    }

    const normalized = normalizeBossSignerTxBase64(txBytesBase64)
    const bytes = Buffer.from(normalized, 'base64')

    let tx: Transaction
    try {
        tx = Transaction.from(bytes)
    } catch {
        try {
            tx = Transaction.fromKind(bytes)
        } catch {
            return { ok: false, error: 'TX-Bytes nicht als Transaction/TransactionKind lesbar.' }
        }
    }

    const commands = tx.getData().commands as Array<Record<string, unknown>>
    if (!commands.length) {
        return { ok: false, error: 'TX enthält keine Commands.' }
    }

    for (const cmd of commands) {
        const kind = commandKind(cmd)
        if (kind !== 'MoveCall') {
            return {
                ok: false,
                error: `Nicht erlaubter PTB-Command-Typ „${kind}“ (nur messaging::MoveCall erlaubt).`,
            }
        }
    }

    let moveCalls: MoveCallRef[]
    try {
        moveCalls = extractMoveCallsFromTransaction(tx)
    } catch (e) {
        return { ok: false, error: (e as Error).message || 'MoveCall-Parse fehlgeschlagen.' }
    }

    if (moveCalls.length === 0) {
        return { ok: false, error: 'TX ohne MoveCall — nichts zu signieren.' }
    }

    for (const mc of moveCalls) {
        if (!allowedPackages.has(mc.packageId)) {
            return {
                ok: false,
                error: `Package nicht erlaubt: ${mc.packageId} (nur BOSS_SIGNER_ALLOWED_PACKAGE_IDS / PACKAGE_ID).`,
            }
        }
        if (mc.module !== 'messaging') {
            return {
                ok: false,
                error: `Modul nicht erlaubt: ${mc.module}::${mc.function} (nur messaging).`,
            }
        }
        if (!WORKER_MESSENGER_ALLOWED_FUNCTIONS.has(mc.function)) {
            return {
                ok: false,
                error: `Move-Funktion nicht erlaubt: messaging::${mc.function}`,
            }
        }
    }

    return { ok: true, moveCalls }
}
