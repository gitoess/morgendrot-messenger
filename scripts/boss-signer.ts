/**
 * Boss-Signer-Service: HTTP-Server für Remote-Signatur (SIGNER=remote).
 *
 * Start: npm run boss-signer
 * .env (Boss-PC):
 *   BOSS_SIGNER_TOKEN=…        (pflicht, min. 16 Zeichen)
 *   BOSS_SIGNER_BIND_HOST=…    (Default 127.0.0.1 — LAN: 0.0.0.0)
 *   BOSS_SIGNER_ALLOWED_ADDRESSES=0x…,0x…  (optional, empfohlen bei LAN-Bind)
 *   WALLET_PASSWORD=…          (Keystore, nie im HTTP-Body)
 *   PORT=3340
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import dotenv from 'dotenv'
import {
    isBossSignerAddressAllowed,
    isBossSignerTokenValid,
    parseBossSignerAllowedAddresses,
    shouldPassBossSignerTxViaStdin,
    validateBossSignerSignBody,
    validateBossSignerTokenConfig,
    BOSS_SIGNER_MAX_BODY_BYTES,
} from './boss-signer-lib.js'

dotenv.config()

const PORT = parseInt(process.env.PORT || '3340', 10)
const TOKEN = (process.env.BOSS_SIGNER_TOKEN || '').trim()
const ALLOW_INSECURE =
    process.env.BOSS_SIGNER_ALLOW_INSECURE === '1' || process.env.BOSS_SIGNER_ALLOW_INSECURE === 'true'
const BIND_HOST = (process.env.BOSS_SIGNER_BIND_HOST || '127.0.0.1').trim() || '127.0.0.1'
const ALLOWED_ADDRESSES = parseBossSignerAllowedAddresses(process.env.BOSS_SIGNER_ALLOWED_ADDRESSES)
const WALLET_PASSWORD = (process.env.WALLET_PASSWORD || '').trim() || undefined
const RATE_LIMIT_PER_MIN = Math.max(0, parseInt(process.env.BOSS_SIGNER_RATE_LIMIT_PER_MINUTE || '60', 10) || 60)

const tokenError = validateBossSignerTokenConfig(TOKEN, ALLOW_INSECURE)
if (tokenError && !ALLOW_INSECURE) {
    console.error('[boss-signer]', tokenError)
    process.exit(1)
}
if (ALLOW_INSECURE) {
    console.warn('[boss-signer] WARNUNG: BOSS_SIGNER_ALLOW_INSECURE — kein oder schwaches Token (nur Entwicklung).')
}
if (BIND_HOST === '0.0.0.0' || BIND_HOST === '::') {
    console.warn('[boss-signer] Lauscht auf allen Interfaces — BOSS_SIGNER_TOKEN und Allowlist prüfen.')
    if (ALLOWED_ADDRESSES.size === 0) {
        console.warn('[boss-signer] BOSS_SIGNER_ALLOWED_ADDRESSES leer — jede gültige Adresse darf signieren.')
    }
}

const rateByIp = new Map<string, { count: number; resetAt: number }>()

function normalizeClientIp(req: IncomingMessage): string {
    const fwd = req.headers['x-forwarded-for']
    if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0]!.trim()
    return req.socket?.remoteAddress || 'unknown'
}

function checkRateLimit(ip: string): boolean {
    if (RATE_LIMIT_PER_MIN <= 0) return true
    const now = Date.now()
    const entry = rateByIp.get(ip)
    if (!entry || now >= entry.resetAt) return true
    return entry.count < RATE_LIMIT_PER_MIN
}

function recordRateLimit(ip: string): void {
    if (RATE_LIMIT_PER_MIN <= 0) return
    const now = Date.now()
    let entry = rateByIp.get(ip)
    if (!entry || now >= entry.resetAt) {
        entry = { count: 0, resetAt: now + 60_000 }
        rateByIp.set(ip, entry)
    }
    entry.count++
}

async function writeStdinToChild(child: ChildProcess, data: Buffer): Promise<void> {
    const stdin = child.stdin
    if (!stdin) throw new Error('boss-signer: kein stdin')
    await new Promise<void>((resolve, reject) => {
        const onErr = (e: unknown) => reject(e)
        stdin.once('error', onErr)
        stdin.once('finish', () => {
            stdin.removeListener('error', onErr)
            resolve()
        })
        stdin.end(data)
    })
}

function runIotaSign(address: string, txBytesBase64: string, password?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const useStdin = shouldPassBossSignerTxViaStdin(txBytesBase64.length)
        const args = ['client', 'sign', '--json', '--address', address, '--data', useStdin ? '-' : txBytesBase64]
        const child = spawn('iota', args, { shell: false, env: process.env })
        let stdout = ''
        let stderr = ''
        child.stdout?.on('data', (d) => {
            stdout += d
        })
        child.stderr?.on('data', (d) => {
            stderr += d
        })
        child.on('error', reject)
        const closePromise = once(child, 'close') as Promise<[number | null]>
        void (async () => {
            try {
                if (useStdin) {
                    await writeStdinToChild(child, Buffer.from(txBytesBase64, 'utf8'))
                } else if (password) {
                    await writeStdinToChild(child, Buffer.from(`${password}\n`, 'utf8'))
                } else {
                    child.stdin?.end()
                }
                const [code] = await closePromise
                if (code !== 0) {
                    reject(new Error(`iota sign exit ${code}: ${(stderr || stdout).trim().slice(0, 500)}`))
                    return
                }
                try {
                    const j = JSON.parse(stdout.trim()) as Record<string, unknown>
                    const sig =
                        (j?.iota_signature as string) ||
                        (j?.signature as string) ||
                        ((j?.result as Record<string, unknown>)?.signature as string) ||
                        ((j?.result as Record<string, unknown>)?.iota_signature as string)
                    if (sig) resolve(sig.trim())
                    else reject(new Error('Keine Signatur in iota-Ausgabe.'))
                } catch {
                    reject(new Error('Ungültige JSON-Ausgabe von iota sign.'))
                }
            } catch (e) {
                try {
                    child.kill()
                } catch {
                    /* ignore */
                }
                reject(e)
            }
        })()
    })
}

function parseBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        let total = 0
        req.on('data', (c) => {
            total += c.length
            if (total > BOSS_SIGNER_MAX_BODY_BYTES) {
                reject(new Error('Request body too large'))
                req.destroy()
                return
            }
            chunks.push(c)
        })
        req.on('end', () => {
            try {
                const body = Buffer.concat(chunks).toString('utf-8')
                resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {})
            } catch {
                reject(new Error('Invalid JSON body'))
            }
        })
        req.on('error', reject)
    })
}

function send(res: ServerResponse, status: number, data: Record<string, unknown>) {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(data))
}

function denyUnlessAuthed(req: IncomingMessage, res: ServerResponse): boolean {
    if (ALLOW_INSECURE && !TOKEN) return false
    if (isBossSignerTokenValid(req, TOKEN)) return false
    send(res, 401, { error: 'Unauthorized — Bearer BOSS_SIGNER_TOKEN erforderlich.' })
    return true
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
        send(res, 200, {
            ok: true,
            service: 'boss-signer',
            bindHost: BIND_HOST,
            addressAllowlist: ALLOWED_ADDRESSES.size,
            tokenRequired: !ALLOW_INSECURE || Boolean(TOKEN),
        })
        return
    }

    if (req.method !== 'POST' || (req.url !== '/sign' && req.url !== '/')) {
        send(res, 404, { error: 'Not Found. POST /sign with { address, txBytesBase64 }.' })
        return
    }

    const ip = normalizeClientIp(req)
    if (!checkRateLimit(ip)) {
        send(res, 429, { error: 'Rate limit exceeded' })
        return
    }

    if (denyUnlessAuthed(req, res)) return

    let body: Record<string, unknown>
    try {
        body = await parseBody(req)
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid JSON body'
        send(res, msg.includes('too large') ? 413 : 400, { error: msg })
        return
    }

    let address: string
    let txBytesBase64: string
    try {
        ;({ address, txBytesBase64 } = validateBossSignerSignBody(body))
    } catch (e) {
        send(res, 400, { error: (e as Error).message || 'Invalid body' })
        return
    }

    if (!isBossSignerAddressAllowed(address, ALLOWED_ADDRESSES)) {
        send(res, 403, { error: 'Adresse nicht in BOSS_SIGNER_ALLOWED_ADDRESSES.' })
        return
    }

    recordRateLimit(ip)

    try {
        const signature = await runIotaSign(address, txBytesBase64, WALLET_PASSWORD)
        send(res, 200, { signature, iota_signature: signature })
    } catch (e) {
        const msg = (e as Error)?.message || String(e)
        console.error('Sign error:', msg)
        send(res, 500, { error: 'Sign failed', detail: msg })
    }
})

server.listen(PORT, BIND_HOST, () => {
    console.log(
        `Boss-Signer: http://${BIND_HOST === '0.0.0.0' ? '127.0.0.1' : BIND_HOST}:${PORT}  (POST /sign, Bearer token)`
    )
})
