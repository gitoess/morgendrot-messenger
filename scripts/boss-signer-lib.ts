/**
 * Boss-Signer — Sicherheits-Hilfen (Unit-Tests, kein Netz nötig).
 */
import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

const SAFE_ADDRESS_REGEX = /^0x[a-fA-F0-9]{64}$|^[0-9a-zA-Z]{40,70}$/

export const BOSS_SIGNER_MIN_TOKEN_LEN = 16
export const BOSS_SIGNER_MAX_BODY_BYTES = 512 * 1024
/** Praktisches Limit wie chain-access.signAndExecute (~124 KiB TX). */
export const BOSS_SIGNER_MAX_TX_B64_LEN = 180_000

export function isTimingSafeTokenMatch(got: string, expected: string): boolean {
    if (!got || !expected || got.length !== expected.length) return false
    try {
        return timingSafeEqual(Buffer.from(got), Buffer.from(expected))
    } catch {
        return false
    }
}

export function bossSignerAuthTokenFromRequest(req: IncomingMessage): string {
    const header = req.headers['x-morgendrot-boss-signer-token']
    if (typeof header === 'string' && header.trim()) return header.trim()
    const auth = req.headers.authorization
    if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
        return auth.slice(7).trim()
    }
    return ''
}

export function isBossSignerTokenValid(req: IncomingMessage, expectedToken: string): boolean {
    if (!expectedToken) return false
    return isTimingSafeTokenMatch(bossSignerAuthTokenFromRequest(req), expectedToken)
}

export function assertBossSignerSafeAddress(addr: string): void {
    if (!addr || !SAFE_ADDRESS_REGEX.test(addr)) {
        throw new Error('Ungültige Adresse (nur 0x+hex oder bech32).')
    }
}

export function parseBossSignerAllowedAddresses(raw: string | undefined): Set<string> {
    const out = new Set<string>()
    if (!raw?.trim()) return out
    for (const part of raw.split(/[\s,;]+/)) {
        const a = part.trim()
        if (!a) continue
        assertBossSignerSafeAddress(a)
        out.add(a.toLowerCase())
    }
    return out
}

export function isBossSignerAddressAllowed(address: string, allowed: Set<string>): boolean {
    if (allowed.size === 0) return true
    return allowed.has(address.trim().toLowerCase())
}

export function validateBossSignerTokenConfig(token: string, allowInsecure: boolean): string | null {
    const t = token.trim()
    if (!t) {
        return allowInsecure
            ? 'BOSS_SIGNER_ALLOW_INSECURE=1 — Token fehlt (nur Entwicklung).'
            : 'BOSS_SIGNER_TOKEN fehlt — Start abgebrochen. Mindestens 16 Zeichen setzen oder BOSS_SIGNER_ALLOW_INSECURE=1 (nur Dev).'
    }
    if (t.length < BOSS_SIGNER_MIN_TOKEN_LEN) {
        return `BOSS_SIGNER_TOKEN zu kurz (min. ${BOSS_SIGNER_MIN_TOKEN_LEN} Zeichen).`
    }
    return null
}

export function normalizeBossSignerTxBase64(base64Tx: string): string {
    return base64Tx.replace(/\s+/g, '')
}

export function validateBossSignerSignBody(body: Record<string, unknown>): {
    address: string
    txBytesBase64: string
} {
    if (body.password !== undefined && body.password !== null && String(body.password).length > 0) {
        throw new Error('Passwort im HTTP-Body nicht erlaubt — nur WALLET_PASSWORD in der Boss-.env.')
    }
    const address = String(body.address ?? '').trim()
    const txBytesBase64 = typeof body.txBytesBase64 === 'string' ? body.txBytesBase64 : ''
    if (!address || !txBytesBase64) {
        throw new Error('Missing address or txBytesBase64')
    }
    assertBossSignerSafeAddress(address)
    const normalized = normalizeBossSignerTxBase64(txBytesBase64)
    if (!normalized || !/^[A-Za-z0-9+/=]+$/.test(normalized)) {
        throw new Error('txBytesBase64 ungültig (Base64 erwartet).')
    }
    if (normalized.length > BOSS_SIGNER_MAX_TX_B64_LEN) {
        throw new Error(`txBytesBase64 zu groß (max. ${BOSS_SIGNER_MAX_TX_B64_LEN} Zeichen Base64).`)
    }
    return { address, txBytesBase64: normalized }
}

export function shouldPassBossSignerTxViaStdin(normalizedB64Length: number): boolean {
    if (process.env.BOSS_SIGNER_TX_STDIN === '1' || process.env.BOSS_SIGNER_TX_STDIN === 'true') return true
    const maxInline = process.platform === 'win32' ? 24_000 : 400_000
    return normalizedB64Length > maxInline
}
