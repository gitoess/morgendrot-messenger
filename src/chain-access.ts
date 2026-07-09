/**
 * Chain Access Layer – alle IOTA-Calls (RPC, build, sign, execute, query).
 * Signatur: CLI, Remote-Boss oder SDK (Mnemonic, keine CLI nötig).
 *
 * PTB: Viele Flows nutzen `@iota/iota-sdk` `Transaction` (programmable transaction blocks) –
 * z. B. Batches (mehrere AccessKeys/Tickets), kombinierte Moves, Klartext an mehrere Empfänger in einer TX.
 * Typischer verschlüsselter Chat `/send` bleibt bewusst oft „eine Nachricht → eine Ausführung“, ist aber nicht „ohne PTB“ im SDK-Sinne.
 */
import { CFG, getInboxUnionIdsForStatus, isMessengerMailboxModeActive } from './config.js';
import { coerceParsedJsonByteVector, normalizeAddress } from './utils.js';
import { IotaClient, IotaHTTPTransport, getFullnodeUrl } from '@iota/iota-sdk/client';
import type { Signer } from '@iota/iota-sdk/cryptography';
import { Transaction } from '@iota/iota-sdk/transactions';
import { bcs } from '@iota/iota-sdk/bcs';
import { spawn, type ChildProcess } from 'child_process';
import { once } from 'node:events';
import { createHash } from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { logger } from './logger.js';
import { fetch as undiciFetch, ProxyAgent } from 'undici';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { getSelfPaidMessengerTxCount, recordSelfPaidMessengerTxSuccess } from './messenger-gas-milestone.js';
import { createSignerProvider, resolveSignerMode } from './signer/signer-provider.js';

/**
 * Messenger-Nachricht als Klartext-String (UTF-8), vor AES-GCM. Muss mit Ciphertext-`vector<u8>` in eure PTB passen.
 *
 * **Defaults:** `MESSENGER_MAX_PLAINTEXT_UTF8_BYTES=16000`, `MESSENGER_MAX_PURE_VECTOR_U8_BYTES=16384` (stabil für PTB/CLI).
 * Größere Werte sind per Env **nicht** erlaubbar (Clamp im Code).
 *
 * Siehe: https://docs.iota.org/developer/iota-101/transactions/ptb/programmable-transaction-blocks
 */
function parseMessengerIntEnv(key: string, fallback: number, min: number, max: number): number {
    const raw = process.env[key]?.trim() ?? '';
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= min && n <= max) return n;
    return fallback;
}

/**
 * Default **16000** UTF-8 Zeichen (Klartext-Wire inkl. `[[MORG_…`-Marker/Base64) — konsistent mit stabilem
 * Messenger-Stand (kleine PTBs, CLI-`--data`-inline). Optional per Env, **nicht** über 16000/16384 anhebbar.
 */
export const MESSAGING_MAX_PLAINTEXT_UTF8_BYTES = parseMessengerIntEnv(
    'MESSENGER_MAX_PLAINTEXT_UTF8_BYTES',
    16000,
    1024,
    16000
);

/** Pro `vector<u8>`-Argument (Move „pure“-Limit historisch ~16 KiB). */
export const MOVE_MAX_PURE_VECTOR_U8_BYTES = parseMessengerIntEnv(
    'MESSENGER_MAX_PURE_VECTOR_U8_BYTES',
    16384,
    1024,
    16384
);

let _sdkSigner: Signer | null = null;
/** Bei SIGNER=sdk: Signer (z. B. aus Mnemonic) setzen. Muss vor signAndExecute aufgerufen werden. */
export function setSdkSigner(signer: Signer | null): void {
    _sdkSigner = signer;
}
export function getSdkSigner(): Signer | null {
    return _sdkSigner;
}

/** Signiert eine Nachricht mit dem SDK-Signer (z. B. Ed25519Keypair), falls vorhanden. Für Boss-Attestation: M = object_id ‖ creator_address. Rückgabe: Signatur-Bytes oder null. */
export async function signPersonalMessageWithSdkSigner(messageBytes: Uint8Array): Promise<Uint8Array | null> {
    const signer = getSdkSigner();
    if (!signer || typeof (signer as { signPersonalMessage?: (msg: Uint8Array) => Promise<{ signature?: string }> }).signPersonalMessage !== 'function')
        return null;
    try {
        const result = await (signer as { signPersonalMessage(msg: Uint8Array): Promise<{ signature?: string }> }).signPersonalMessage(messageBytes);
        const sig = result?.signature;
        if (!sig) return null;
        return new Uint8Array(Buffer.from(sig, 'base64'));
    } catch {
        return null;
    }
}

/** Erlaubte Zeichen für Adressen (kein Shell-Metazeichen). IOTA Rebased: 0x + 64 hex; Legacy: bech32.
 * IOTA Names (.iota) werden nicht aufgelöst – nur Rohadressen (0x… oder bech32) sind erlaubt. */
const SAFE_ADDRESS_REGEX = /^0x[a-fA-F0-9]{64}$|^[0-9a-zA-Z]{40,70}$/;

function assertSafeAddress(addr: string): void {
    if (!addr || !SAFE_ADDRESS_REGEX.test(addr)) {
        throw new Error('Ungültige oder unsichere Adresse (nur 0x+hex oder bech32, keine Sonderzeichen).');
    }
}

/** Fehler von runIotaCli; enthält ggf. iotaVersionMismatch: true für Client/Server API-Versionskonflikt. */
export function isIotaVersionMismatch(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /api version mismatch|client api version|server api version/i.test(msg);
}

/** `child_process.spawn` scheitert, wenn die Windows-Kommandozeile zu lang ist (ENAMETOOLONG / E2BIG). */
function isEnametoolongSpawnError(err: unknown): boolean {
    const code = (err as NodeJS.ErrnoException)?.code;
    const msg = err instanceof Error ? err.message : String(err);
    return (
        code === 'ENAMETOOLONG' ||
        code === 'E2BIG' ||
        /ENAMETOOLONG|argument list too long|name too long|E2BIG/i.test(msg)
    );
}

/**
 * IOTA-CLI `client sign --data <DATA>` (vgl. `IotaClientCommands::Sign` in `client_commands.rs`):
 * - `data` ist ein String → Rust `Base64::decode(&data)` → BCS `TransactionData`.
 * - **`--data -`**: clap liest **stdin vollständig als `data`** — dort darf **nur** die Base64 der TX-Bytes stehen.
 *   Kein Passwort davor; sonst scheitert `Base64::decode` mit `InvalidInput` / „Cannot deserialize … TransactionData“.
 * - **Große TX:** **`--data -`** + **volle Base64 auf stdin** (ein `stdin.end(Buffer)` — kein CLI-`@file`, keine Tempdatei-Pipeline).
 * - **`--data <inline>`** (kurze TX): Nutzlast in argv, **stdin** nur `password + '\n'` fürs Keystore (wie bisher).
 *   Windows: Inline-Limit `maxIotaCliInlineB64Chars` (~24k), nicht cmd.exe-8191 — sonst landet fast jede TX fälschlich nur auf stdin ohne Passwort.
 * - `execute-signed-tx`: immer **`--tx-bytes -`** + volle Base64 auf stdin bei großer Nutzlast (kein `@file`).
 */
function debugIotaCli(): boolean {
    return process.env.MORG_DEBUG_IOTA_CLI === '1' || process.env.MORG_DEBUG_IOTA_CLI === 'true';
}

/**
 * Maximale Länge der TX-Base64 in argv für `iota … --data <base64>`.
 *
 * **Windows:** Früher fälschlich wie cmd.exe (8191) begrenzt — dadurch gingen fast alle echten PTBs auf
 * `--data -` (stdin = nur TX, **kein** Keystore-Passwort auf stdin). CreateProcess erlaubt ~32767
 * Zeichen **gesamt**; konservativ ~24k für die Base64, Rest für Pfad/Flags/Lange Adresse.
 *
 * Override: `MORG_IOTA_CLI_INLINE_B64_MAX` (512 … 400000).
 */
function maxIotaCliInlineB64Chars(): number {
    const raw = process.env.MORG_IOTA_CLI_INLINE_B64_MAX?.trim();
    if (raw) {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 512 && n <= 400_000) return n;
    }
    return process.platform === 'win32' ? 24_000 : 400_000;
}

/** `MORG_IOTA_CLI_TX_STDIN=1`: immer stdin (Debug). Sonst stdin nur wenn Base64 zu lang für argv. */
function shouldPassIotaTxViaStdin(normalizedB64Length: number): boolean {
    if (process.env.MORG_IOTA_CLI_TX_STDIN === '1' || process.env.MORG_IOTA_CLI_TX_STDIN === 'true') return true;
    return normalizedB64Length > maxIotaCliInlineB64Chars();
}

function normalizeTxBase64(base64Tx: string): string {
    return base64Tx.replace(/\s+/g, '');
}

/**
 * stdin für `iota client sign`:
 * - `--data -` (große TX): **nur** `txBase64Normalized` — clap weist stdin dem Flag `--data` zu.
 * - `--data <inline>`: stdin nur Keystore-Passwortzeile (`password + '\n'`), nicht die TX.
 */
function buildIotaCliSignStdin(
    walletPassword: string | undefined,
    txBase64Normalized: string,
    txOnStdin: boolean
): string | undefined {
    const pw = walletPassword !== undefined && walletPassword !== '' ? walletPassword : undefined;
    if (txOnStdin) {
        return txBase64Normalized;
    }
    if (pw) return `${pw}\n`;
    return undefined;
}

function logPrepareMode(mode: 'inline' | 'stdin', b64len: number): void {
    if (debugIotaCli()) {
        logger.info(`morg.iota.cli.prepare ${mode} b64len=${b64len} maxInline=${maxIotaCliInlineB64Chars()}`);
    }
}

/**
 * stdin des Kindprozesses schreiben (TX-Base64 für `--data -` / `--tx-bytes -`, UTF-8-String als Buffer).
 * Ein Aufruf `stdin.end(data)` — bewusst simpel (wie stabiler Legacy-Stand); bei `MORG_DEBUG_IOTA_CLI=1` nur Längen-Log.
 */
async function writeStdinToChild(child: ChildProcess, data: Buffer): Promise<void> {
    const stdin = child.stdin;
    if (!stdin) throw new Error('runIotaCli: kein stdin (stdio)');
    if (debugIotaCli()) {
        logger.info(`morg.iota.cli.stdin bytes=${data.length} pid=${child.pid ?? 'n/a'}`);
    }
    await new Promise<void>((resolve, reject) => {
        const onErr = (e: unknown) => reject(e);
        stdin.once('error', onErr);
        stdin.once('finish', () => {
            stdin.removeListener('error', onErr);
            resolve();
        });
        stdin.end(data);
    });
}

async function runIotaCli(
    args: string[],
    stdin?: string,
    opts?: { cwd?: string }
): Promise<{ stdout: string; stderr: string }> {
    const child = spawn('iota', args, {
        shell: false,
        env: process.env,
        cwd: opts?.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (d: string | Buffer) => {
        stdout += typeof d === 'string' ? d : d.toString('utf8');
    });
    child.stderr?.on('data', (d: string | Buffer) => {
        stderr += typeof d === 'string' ? d : d.toString('utf8');
    });
    const closePromise = once(child, 'close') as Promise<[number | null, NodeJS.Signals | null]>;
    const spawnFail = once(child, 'error').then((args) => {
        const e = args[0];
        throw e instanceof Error ? e : new Error(String(e));
    });
    try {
        if (stdin !== undefined) {
            const buf = Buffer.from(stdin, 'utf8');
            if (debugIotaCli()) {
                logger.info(`morg.iota.cli.stdin utf8Bytes=${buf.length}`);
            }
            await writeStdinToChild(child, buf);
        } else {
            child.stdin?.end();
        }
        const [code] = (await Promise.race([closePromise, spawnFail])) as [
            number | null,
            NodeJS.Signals | null,
        ];
        if (code !== 0) {
            const out = (stderr || stdout).trim();
            const err = new Error(`iota exit ${code}: ${out.slice(0, 500)}`) as Error & { iotaVersionMismatch?: boolean };
            if (/api version mismatch|client api version|server api version/i.test(out)) err.iotaVersionMismatch = true;
            throw err;
        }
        return { stdout, stderr };
    } catch (e: unknown) {
        try {
            child.kill();
        } catch {
            /* ignore */
        }
        const err = e as NodeJS.ErrnoException & { code?: string };
        const out = (stderr || stdout).trim();
        if ((err?.code === 'EPIPE' || /EPIPE|write EOF/i.test(String((e as Error)?.message ?? ''))) && out) {
            throw new Error(
                `iota stdin (${err?.code ?? 'EPIPE'}): Pipe geschlossen (CLI oft vorzeitig beendet). stderr: ${out.slice(0, 700)}`
            );
        }
        throw e;
    }
}

/** Neue Adresse über IOTA-CLI erzeugen (Boss: Adressen für Maschinen). Optional: Keystore-Passwort auf stdin. */
export async function generateNewAddressCli(walletPassword?: string): Promise<string> {
    const stdin = walletPassword !== undefined && walletPassword !== '' ? walletPassword + '\n' : undefined;
    const { stdout } = await runIotaCli(['client', 'new-address'], stdin);
    const hexMatch = stdout.match(/0x[a-fA-F0-9]{64}/);
    if (hexMatch) return hexMatch[0];
    const bech32Match = stdout.match(/(?:rms|ed25519|iota)[0-9a-zA-Z]{40,70}/);
    if (bech32Match) return bech32Match[0];
    throw new Error('Adresse in CLI-Ausgabe nicht gefunden. Erwartet: 0x… (64 Hex) oder bech32.');
}

/** Move-Package publizieren — siehe `src/move-package-deploy.ts`. */
export {
    publishPackageCli,
    deployMainnetMovePackage,
    upgradePackageCli,
    findUpgradeCapForPackage,
    resolveUpgradeCapId,
    applyPublishResultToEnv,
    parsePublishCliOutput,
    parseGlobalsCreatedFromCliOutput,
    type MovePackagePublishResult,
    type MovePackageUpgradeResult,
    type GlobalsCreatedIds,
} from './move-package-deploy.js';

/** @deprecated Import from move-package-deploy — Alias für Kompatibilität. */
export type { MovePackagePublishResult as PublishPackageCliResult } from './move-package-deploy.js';

let _client: IotaClient | null = null;
/** Zuletzt für den Transport gewählte RPC-URL (nach Rotation/Dedupe-Liste). */
let _activeRpcUrl = '';
let _rpcRotationIndex = 0;
const RPC_TIMEOUT_MS = 15_000;

function getRpcUrlCandidates(): string[] {
    const primary = (CFG.RPC_URL || '').trim() || getFullnodeUrl('testnet');
    const extra = CFG.RPC_URLS_EXTRA ?? [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const u of [primary, ...extra]) {
        const x = String(u || '').trim();
        if (!x || seen.has(x)) continue;
        seen.add(x);
        out.push(x);
    }
    return out.length ? out : [getFullnodeUrl('testnet')];
}

/**
 * Client leeren (z. B. nach Proxy-/RPC-Änderung).
 * @param mode same = gleicher Listeneintrag; next = nächster Eintrag in RPC_URL + RPC_URLS; primary = Index 0
 */
export function resetRpcClient(mode: 'same' | 'next' | 'primary' = 'same'): void {
    _client = null;
    const urls = getRpcUrlCandidates();
    if (!urls.length) return;
    if (mode === 'primary') _rpcRotationIndex = 0;
    else if (mode === 'next') _rpcRotationIndex = (_rpcRotationIndex + 1) % urls.length;
}

/** Aktive RPC-URL des letzten gebauten Clients (leer bis zum ersten getClient). */
export function getActiveRpcUrl(): string {
    return _activeRpcUrl;
}

/** Anzahl der konfigurierten RPC-Kandidaten (nach Dedupe). */
export function getRpcCandidateCount(): number {
    return getRpcUrlCandidates().length;
}

/** Anzeige-URL: nach erstem getClient = zuletzt genutzt; sonst Kandidat am Rotationsindex (ohne Client zu erzeugen). */
export function getEffectiveRpcUrlLabel(): string {
    if (_activeRpcUrl) return _activeRpcUrl;
    const urls = getRpcUrlCandidates();
    if (!urls.length) return '';
    return urls[_rpcRotationIndex % urls.length] ?? '';
}

function createRpcFetch(): typeof globalThis.fetch {
    const socksUrl = (CFG.RPC_SOCKS_PROXY || '').trim();
    const proxy = (CFG.RPC_HTTP_PROXY || '').trim();
    const withTimeout = (base: typeof globalThis.fetch): typeof globalThis.fetch => {
        return (input, init) => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
            const parent = init?.signal;
            if (parent) {
                if (parent.aborted) {
                    clearTimeout(timer);
                    return Promise.reject(parent.reason instanceof Error ? parent.reason : new Error('Aborted'));
                }
                parent.addEventListener('abort', () => ctrl.abort(), { once: true });
            }
            const merged = { ...init, signal: ctrl.signal };
            return base(input, merged).finally(() => clearTimeout(timer));
        };
    };

    if (socksUrl) {
        try {
            const agent = new SocksProxyAgent(socksUrl);
            const proxied: typeof globalThis.fetch = (input, init) =>
                undiciFetch(input as Parameters<typeof undiciFetch>[0], {
                    ...(init as object),
                    dispatcher: agent,
                } as unknown as Parameters<typeof undiciFetch>[1]);
            return withTimeout(proxied);
        } catch (e) {
            logger.warn(
                `RPC_SOCKS_PROXY ungültig oder nicht nutzbar (${String((e as Error)?.message ?? e)}), versuche HTTP-Proxy oder direktes fetch.`
            );
        }
    }
    if (proxy) {
        try {
            const agent = new ProxyAgent(proxy);
            const proxied: typeof globalThis.fetch = (input, init) =>
                undiciFetch(input as Parameters<typeof undiciFetch>[0], {
                    ...(init as object),
                    dispatcher: agent,
                } as unknown as Parameters<typeof undiciFetch>[1]);
            return withTimeout(proxied);
        } catch (e) {
            logger.warn(`RPC_HTTP_PROXY ungültig oder nicht nutzbar (${String((e as Error)?.message ?? e)}), nutze direktes fetch.`);
        }
    }
    return withTimeout(globalThis.fetch.bind(globalThis));
}

export function getClient(): IotaClient {
    if (!_client) {
        const urls = getRpcUrlCandidates();
        const rpcUrl = urls[_rpcRotationIndex % urls.length]!;
        _activeRpcUrl = rpcUrl;
        const fetchForTransport = createRpcFetch();
        _client = new IotaClient({
            transport: new IotaHTTPTransport({ url: rpcUrl, fetch: fetchForTransport }),
        });
    }
    return _client;
}

/** Prüft, ob die Chain erreichbar ist (für Offline-Erkennung). */
export async function isChainReachable(): Promise<boolean> {
    try {
        await getClient().getRpcApiVersion();
        return true;
    } catch {
        return false;
    }
}

function tryParseJson<T = unknown>(text: string): T | null {
    try {
        return JSON.parse(text) as T;
    } catch {
        return null;
    }
}

function pickString(obj: unknown, keys: string[]): string | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    for (const k of keys) {
        const v = (obj as Record<string, unknown>)[k];
        if (typeof v === 'string' && v.trim()) return v;
    }
    return undefined;
}

/**
 * Signatur vom Boss-Service holen (SIGNER=remote). POST { address, txBytesBase64 }, Antwort { signature }.
 */
async function fetchRemoteSignature(signingAddress: string, base64Tx: string): Promise<string> {
    const url = CFG.REMOTE_SIGNER_URL?.trim();
    if (!url) throw new Error('REMOTE_SIGNER_URL fehlt (SIGNER=remote).');
    const token = (CFG.REMOTE_SIGNER_TOKEN || '').trim();
    if (!token) {
        throw new Error(
            'REMOTE_SIGNER_TOKEN fehlt — Boss-Signer verlangt Bearer-Token (BOSS_SIGNER_TOKEN am Boss, gleicher Wert hier).'
        );
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    headers['Authorization'] = `Bearer ${token}`;
    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ address: signingAddress, txBytesBase64: base64Tx }),
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Remote-Signer nicht erreichbar (${url}): ${msg}`);
    }
    if (!res.ok) throw new Error(`Remote-Signer: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as Record<string, unknown>;
    const sig =
        (json?.signature as string) ||
        (json?.iota_signature as string) ||
        ((json?.result as Record<string, unknown>)?.signature as string);
    if (!sig || typeof sig !== 'string') throw new Error('Remote-Signer: keine Signatur in Antwort.');
    return sig.trim();
}

async function signWithCli(
    normalizedB64: string,
    signAddress: string,
    signPassword: string | undefined,
    useStdinForSign: boolean
): Promise<string> {
    let sig: string | undefined;

    const runCliSignJson = async (opts?: { forceTxStdin?: boolean }): Promise<void> => {
        const txOnStdinPipe = opts?.forceTxStdin === true || useStdinForSign;
        const stdinBody = buildIotaCliSignStdin(signPassword, normalizedB64, txOnStdinPipe);
        const signJsonRes = await runIotaCli(
            ['client', 'sign', '--json', '--address', signAddress, '--data', txOnStdinPipe ? '-' : normalizedB64],
            stdinBody
        );
        const signJson = tryParseJson<Record<string, unknown>>(signJsonRes.stdout.trim());
        sig =
            pickString(signJson, ['iota_signature', 'iotaSignature', 'signature']) ||
            pickString((signJson?.result as Record<string, unknown>) || {}, ['iota_signature', 'iotaSignature', 'signature']);
    };

    const runCliSignText = async (opts?: { forceTxStdin?: boolean }): Promise<void> => {
        const txOnStdinPipe = opts?.forceTxStdin === true || useStdinForSign;
        const stdinBody = buildIotaCliSignStdin(signPassword, normalizedB64, txOnStdinPipe);
        const signTextRes = await runIotaCli(
            ['client', 'sign', '--address', signAddress, '--data', txOnStdinPipe ? '-' : normalizedB64],
            stdinBody
        );
        const m =
            signTextRes.stdout.match(/iota_signature\s*│\s*(.+?)\s*│/) ||
            signTextRes.stdout.match(/iota_signature\s+(.+)\s*/);
        sig = m?.[1]?.trim();
    };

    try {
        await runCliSignJson();
    } catch (signErr: unknown) {
        if (isIotaVersionMismatch(signErr))
            throw new Error('IOTA CLI und Node-Version stimmen nicht überein (Client/Server api version mismatch). Bitte IOTA CLI auf gleiche Version wie den RPC-Server aktualisieren.');
        if (!useStdinForSign && isEnametoolongSpawnError(signErr)) {
            logger.info('morg.iota.sign: ENAMETOOLONG bei Inline-Spawn, wiederhole mit --data - + stdin.');
            await runCliSignJson({ forceTxStdin: true });
        } else {
            throw signErr;
        }
    }
    if (!sig) {
        try {
            await runCliSignText();
        } catch (signErr2: unknown) {
            if (isIotaVersionMismatch(signErr2))
                throw new Error('IOTA CLI und Node-Version stimmen nicht überein (Client/Server api version mismatch). Bitte IOTA CLI auf gleiche Version wie den RPC-Server aktualisieren.');
            if (!useStdinForSign && isEnametoolongSpawnError(signErr2)) {
                await runCliSignText({ forceTxStdin: true });
            } else {
                throw signErr2;
            }
        }
    }
    if (!sig) throw new Error('Signatur-Fehler (CLI).');
    return sig;
}

/**
 * TX bauen, signieren (CLI oder Remote-Boss) und ausführen.
 * walletPassword: bei SIGNER=cli an die CLI auf stdin übergeben.
 */
export type GasSummary = {
    computationCost?: string;
    storageCost?: string;
    storageRebate?: string;
    nonRefundableStorageFee?: string;
};
export type SignAndExecuteResult = { digest?: string; status?: string; createdObjectIds?: string[]; gasSummary?: GasSummary };

export type ChainTxEvaluation = { ok: true; digest: string } | { ok: false; message: string };

/** IOTA-SDK liefert `effects.status` oft als Objekt `{ status: 'success' }`, nicht als String. */
export function normalizeChainTxEffectStatus(status: unknown): string {
    if (status == null) return '';
    if (typeof status === 'string') return status.trim().toLowerCase();
    if (typeof status === 'object') {
        const o = status as Record<string, unknown>;
        if (typeof o.status === 'string') return o.status.trim().toLowerCase();
        if (o.status != null && typeof o.status === 'object') {
            const inner = (o.status as Record<string, unknown>).status;
            if (typeof inner === 'string') return inner.trim().toLowerCase();
        }
    }
    return '';
}

function effectStatusFromEffects(effects: unknown): string | undefined {
    const n = normalizeChainTxEffectStatus((effects as { status?: unknown } | null | undefined)?.status);
    return n || undefined;
}

/** Prüft Digest + Effects-Status — verhindert „ok“ ohne echte on-chain TX (Explorer leer). */
export function evaluateChainTxResult(res: SignAndExecuteResult | undefined, label: string): ChainTxEvaluation {
    const digest = String(res?.digest ?? '').trim();
    const status = normalizeChainTxEffectStatus(res?.status);
    if (status === 'failure') {
        return {
            ok: false,
            message: `${label}: Transaktion fehlgeschlagen. Mailbox leer? Tresor/Owner korrekt? PACKAGE_ID zum Objekt passend?`,
        };
    }
    if (!digest) {
        return { ok: false, message: `${label}: keine TX-Digest — nichts on-chain ausgeführt.` };
    }
    if (status && status !== 'success' && status !== 'submitted') {
        return { ok: false, message: `${label}: TX-Status „${status}“ — im Explorer (txblock) prüfen.` };
    }
    return { ok: true, digest };
}

export function explorerTxUrlFromDigest(digest: string): string {
    const d = digest.trim();
    const base = (process.env.EXPLORER_TX_BASE_URL || 'https://explorer.iota.org/txblock').replace(/\/$/, '');
    const network = (CFG.RPC_URL || '').toLowerCase().includes('testnet') ? '?network=testnet' : '';
    return `${base}/${encodeURIComponent(d)}${network}`;
}

function parseObjectIdHex(idRaw: unknown): string | null {
    const id = typeof idRaw === 'string' ? idRaw.trim() : '';
    return /^0x[a-fA-F0-9]{64}$/i.test(id) ? id : null;
}

function parseCreatedObjectIdsFromObjectChanges(changes: unknown): string[] {
    if (!Array.isArray(changes)) return [];
    const ids: string[] = [];
    for (const ch of changes) {
        if (!ch || typeof ch !== 'object') continue;
        const o = ch as Record<string, unknown>;
        const type = String(o.type ?? '').toLowerCase();
        if (type !== 'created' && type !== 'published') continue;
        const id =
            parseObjectIdHex(o.objectId) ??
            parseObjectIdHex((o.objectRef as Record<string, unknown> | undefined)?.objectId);
        if (id) ids.push(id);
    }
    return ids;
}

function parseCreatedObjectIds(
    effects: { created?: Array<{ reference?: { objectId?: string } }> } | null | undefined,
    objectChanges?: unknown
): string[] {
    const created = effects?.created ?? [];
    const fromEffects = created
        .map((c) => c.reference?.objectId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const fromChanges = parseCreatedObjectIdsFromObjectChanges(objectChanges);
    return [...new Set([...fromEffects, ...fromChanges])];
}

/** Liest Mailbox-Object-IDs aus TX-Events (`TeamMailboxCreated` / `PrivateMailboxCreated`) und ObjectChanges. */
export async function parseMailboxCreatedIdsFromDigest(client: IotaClient, digest: string): Promise<string[]> {
    const d = digest.trim();
    if (!d) return [];
    const ids = new Set<string>();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await sleep(900);
        try {
            const res = await client.getTransactionBlock({
                digest: d,
                options: { showEvents: true, showObjectChanges: true, showEffects: true },
            } as Parameters<IotaClient['getTransactionBlock']>[0]);
            const effects = (res as { effects?: { created?: Array<{ reference?: { objectId?: string } }> } }).effects;
            const objectChanges =
                (res as { objectChanges?: unknown }).objectChanges ??
                (res as { transactionBlock?: { objectChanges?: unknown } }).transactionBlock?.objectChanges;
            for (const id of parseCreatedObjectIds(effects, objectChanges)) ids.add(id);
            const ev =
                (res as { events?: Array<{ type?: string; parsedJson?: Record<string, unknown> }> }).events ??
                (res as { transactionBlock?: { events?: Array<{ type?: string; parsedJson?: Record<string, unknown> }> } })
                    .transactionBlock?.events ??
                [];
            for (const event of ev ?? []) {
                const t = String(event.type || '');
                if (!/::messaging::(Team|Private)MailboxCreated$/i.test(t)) continue;
                const pj = event.parsedJson;
                const id = parseObjectIdHex((pj as { mailbox_id?: unknown })?.mailbox_id);
                if (id) ids.add(id);
            }
            if (ids.size > 0) break;
        } catch {
            // retry
        }
    }
    return [...ids];
}

/** On-chain-Fehlertext aus effects.status.error (z. B. „Function Not Found“). */
export async function parseTxFailureReasonFromDigest(client: IotaClient, digest: string): Promise<string | null> {
    const d = digest.trim();
    if (!d) return null;
    try {
        const res = await client.getTransactionBlock({
            digest: d,
            options: { showEffects: true },
        } as Parameters<IotaClient['getTransactionBlock']>[0]);
        const status = (res as { effects?: { status?: { error?: string; status?: string } } }).effects?.status;
        const err = status && typeof status === 'object' ? String((status as { error?: unknown }).error ?? '').trim() : '';
        return err || null;
    } catch {
        return null;
    }
}

function parseGasSummary(effects: { gasUsed?: Record<string, unknown> } | null | undefined): GasSummary | undefined {
    const gu = effects?.gasUsed as { computationCost?: string; storageCost?: string; storageRebate?: string; nonRefundableStorageFee?: string } | undefined;
    if (!gu || (gu.computationCost == null && gu.storageCost == null && gu.storageRebate == null)) return undefined;
    const out: GasSummary = {};
    if (gu.computationCost != null) out.computationCost = String(gu.computationCost);
    if (gu.storageCost != null) out.storageCost = String(gu.storageCost);
    if (gu.storageRebate != null) out.storageRebate = String(gu.storageRebate);
    if (gu.nonRefundableStorageFee != null) out.nonRefundableStorageFee = String(gu.nonRefundableStorageFee);
    return Object.keys(out).length ? out : undefined;
}

/** ObjectRef für setGasPayment: { objectId, version, digest }. */
type GasPaymentRef = { objectId: string; version: string | number; digest: string };

/** Max. Gas-Coin-Refs pro TX (Validator-Limit nahe 256; konservativ für PTB-Größe). */
const MAX_GAS_PAYMENT_OBJECTS = 128;
const GAS_COIN_PAGE = 100;

export type SignAndExecuteOptions = {
    /** Bei Sponsored Transactions: Adresse, die Gas zahlt (z. B. Boss). Muss von signingAddress verschieden sein. */
    sponsorAddress?: string;
    /** Passwort des Sponsor-Wallets (nur nötig, wenn sponsorAddress gesetzt). */
    sponsorPassword?: string;
    /**
     * Wenn true und kein sponsorAddress gesetzt: nach mind. einer erfolgreichen selbstbezahlten Messenger-TX (State-Datei)
     * und Besitz von MESSENGER_LICENSE_NFT_OBJECT_ID → Gas durch SPONSOR_GAS_OWNER (MESSENGER_AUTO_SPONSOR).
     */
    messengerGasPolicy?: boolean;
};

function isIotaHttp404(err: unknown): boolean {
    const st = err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : undefined;
    if (st === 404) return true;
    const msg = err instanceof Error ? err.message : String(err);
    return /\b404\b|Not Found/i.test(msg);
}

/** Holt Coin-Objekte einer Adresse für Gas-Zahlung (paginiert, bis MAX_GAS_PAYMENT_OBJECTS). */
export async function getSponsorGasCoins(client: IotaClient, sponsorAddress: string): Promise<GasPaymentRef[]> {
    assertSafeAddress(sponsorAddress);
    const out: GasPaymentRef[] = [];
    let cursor: string | null | undefined = undefined;
    try {
        for (;;) {
            const res = (await client.getCoins({
                owner: sponsorAddress,
                limit: GAS_COIN_PAGE,
                ...(cursor ? { cursor } : {}),
            } as Parameters<IotaClient['getCoins']>[0])) as {
                data?: Array<{ coinObjectId?: string; version?: string | number; digest?: string; balance?: string }>;
                nextCursor?: string | null;
            };
            const data = res.data ?? [];
            for (const c of data) {
                if (!c.coinObjectId || !c.digest) continue;
                const v = c.version;
                const version =
                    v !== undefined && v !== null
                        ? typeof v === 'number'
                            ? v
                            : parseInt(String(v), 10) || 0
                        : 0;
                out.push({ objectId: c.coinObjectId, version, digest: c.digest });
                if (out.length >= MAX_GAS_PAYMENT_OBJECTS) break;
            }
            if (out.length >= MAX_GAS_PAYMENT_OBJECTS) break;
            cursor = res.nextCursor ?? undefined;
            if (!cursor) break;
        }
    } catch (e) {
        if (isIotaHttp404(e)) {
            throw new Error(
                'RPC getCoins: HTTP 404 – dieser Knoten unterstützt die Anfrage nicht. Für IOTA Testnet in .env setzen: RPC_URL=https://api.testnet.iota.cafe (nicht fullnode.testnet.iota.cafe).'
            );
        }
        throw e;
    }
    return out;
}

/** Prüft, ob ownerAddress aktueller AddressOwner des Objekts ist (NFT/Lizenz-Gate). */
export async function addressOwnsObject(client: IotaClient, objectId: string, ownerAddress: string): Promise<boolean> {
    assertSafeAddress(ownerAddress);
    const oid = String(objectId || '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(oid)) return false;
    try {
        const res = await client.getObject({
            id: oid,
            options: { showOwner: true },
        } as Parameters<IotaClient['getObject']>[0]);
        const owner = (res as { data?: { owner?: unknown } })?.data?.owner;
        if (owner && typeof owner === 'object' && owner !== null && 'AddressOwner' in owner) {
            const a = String((owner as { AddressOwner: string }).AddressOwner).trim();
            return normalizeAddress(a) === normalizeAddress(ownerAddress);
        }
        return false;
    } catch {
        return false;
    }
}

async function resolveMessengerAutoSponsorOptions(
    signingAddress: string
): Promise<Pick<SignAndExecuteOptions, 'sponsorAddress' | 'sponsorPassword'> | undefined> {
    if (!CFG.MESSENGER_AUTO_SPONSOR) return undefined;
    if (!CFG.SPONSORED_TRANSACTION_ENABLED || !CFG.SPONSOR_GAS_OWNER) return undefined;
    const sponsor = CFG.SPONSOR_GAS_OWNER.trim();
    if (!sponsor || normalizeAddress(sponsor) === normalizeAddress(signingAddress)) return undefined;
    const license = (CFG.MESSENGER_LICENSE_NFT_OBJECT_ID || '').trim();
    if (!license || !/^0x[a-fA-F0-9]{64}$/i.test(license)) return undefined;
    if (getSelfPaidMessengerTxCount(signingAddress) < 1) return undefined;
    const sponsorPassword = CFG.SPONSOR_GAS_PASSWORD?.trim();
    if (!sponsorPassword) return undefined;
    const client = getClient();
    const owns = await addressOwnsObject(client, license, signingAddress);
    if (!owns) return undefined;
    return { sponsorAddress: sponsor, sponsorPassword };
}

function recordMessengerSelfPaidMilestoneIfNeeded(
    track: boolean,
    useSponsor: boolean,
    signingAddress: string,
    status: string | undefined,
    digest: string | undefined
): void {
    if (!track || useSponsor) return;
    const d = String(digest || '').trim();
    if (!d) return;
    // success = sicher; submitted = Timeout bei Execute, TX kann trotzdem durch sein (Auto-Sponsor-Freigabe)
    if (status === 'success' || status === 'submitted') recordSelfPaidMessengerTxSuccess(signingAddress);
}

/** Anzahl nutzbarer Gas-Coins einer Adresse (für Hinweise: wenige Coins → viele TX blockieren sich). */
export async function getGasCoinCount(client: IotaClient, address: string): Promise<number> {
    assertSafeAddress(address);
    let res;
    try {
        res = await client.getCoins({ owner: address, limit: 100 } as Parameters<IotaClient['getCoins']>[0]);
    } catch (e) {
        if (isIotaHttp404(e)) return 0;
        throw e;
    }
    const data = (res as { data?: unknown[] })?.data ?? [];
    return data.length;
}

/** Pro Gas-Payer nur eine TX gleichzeitig – verhindert "object reserved for another transaction". */
const txSerialByGasPayer = new Map<string, Promise<unknown>>();

const OBJECT_RESERVED_REGEX = /reserved for another transaction|object.*reserved/i;
/** Transiente Chain-Fehler (Sync-Lag, Package noch nicht indexiert) → Retry mit längerem Delay. */
const TRANSIENT_CHAIN_REGEX = /Dependent package not found|transaction inputs.*try again|not found on-chain|-32002|issues with transaction inputs|not available for consumption|current version/i;
/** Permanente Fehler (Gas/Balance): niemals retries – sauberer Abbruch, verständliche Meldung ans Frontend. */
const PERMANENT_NO_RETRY_REGEX =
    /insufficient|not enough|hat keine Coin|keine Coin-Objekte|no coins|balance.*zero|empty balance|gas.*payment|SPONSOR_GAS_OWNER hat keine|maximum pure argument size|size limit exceeded.*16384/i;

const TX_SERIAL_RETRY_ATTEMPTS = 3;
const TX_SERIAL_RETRY_DELAY_MS = 2500;
const TX_TRANSIENT_RETRY_ATTEMPTS = 3;
const TX_TRANSIENT_RETRY_DELAY_MS = 4000;

function getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        const cause = (err as Error & { cause?: Error }).cause;
        return err.message + (cause?.message ?? '');
    }
    return String(err);
}

function isObjectReservedError(err: unknown): boolean {
    return OBJECT_RESERVED_REGEX.test(getErrorMessage(err));
}

function isTransientChainError(err: unknown): boolean {
    return TRANSIENT_CHAIN_REGEX.test(getErrorMessage(err));
}

/** Für Tests: Gas/Balance-Fehler werden nicht retried (Armut-Test). */
export function isPermanentNoRetryError(err: unknown): boolean {
    return PERMANENT_NO_RETRY_REGEX.test(getErrorMessage(err));
}

async function withTxSerial<T>(gasPayerKey: string, fn: () => Promise<T>): Promise<T> {
    const prev = txSerialByGasPayer.get(gasPayerKey) ?? Promise.resolve();
    // Wichtig: Bei `prev.reject` (z. B. fehlgeschlagener CLI-Sign) darf die Kette nicht abbrechen —
    // sonst läuft `runWithRetry` nie wieder und jede Folge-TX scheitert sofort bis Prozess-Neustart.
    const ourRun = prev.catch(() => {}).then(() => runWithRetry(fn));
    // Map-Eintrag immer „settled fulfilled“, damit die nächste Sendung nicht an einem rejected tail hängt.
    const tail = ourRun.catch(() => {});
    txSerialByGasPayer.set(gasPayerKey, tail);
    return ourRun;
}

async function runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    const maxAttempts = Math.max(TX_SERIAL_RETRY_ATTEMPTS, TX_TRANSIENT_RETRY_ATTEMPTS);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (isPermanentNoRetryError(e)) throw e;
            const objectReserved = isObjectReservedError(e);
            const transient = isTransientChainError(e);
            if (attempt >= maxAttempts) throw e;
            if (objectReserved) {
                await new Promise((r) => setTimeout(r, TX_SERIAL_RETRY_DELAY_MS));
                continue;
            }
            if (transient) {
                await new Promise((r) => setTimeout(r, TX_TRANSIENT_RETRY_DELAY_MS));
                continue;
            }
            throw e;
        }
    }
    throw lastErr;
}

export async function signAndExecute(
    client: IotaClient,
    txb: Transaction,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    assertSafeAddress(signingAddress);
    let resolvedOptions = options;
    if (options?.messengerGasPolicy && !options?.sponsorAddress) {
        try {
            const auto = await resolveMessengerAutoSponsorOptions(signingAddress);
            if (auto) resolvedOptions = { ...options, ...auto };
        } catch {
            // NFT/RPC optional nicht erreichbar → ohne Sponsor fortfahren
        }
    }
    const trackMessengerMilestone = Boolean(resolvedOptions?.messengerGasPolicy);
    const sponsorAddress = resolvedOptions?.sponsorAddress?.trim();
    const sponsorPassword = resolvedOptions?.sponsorPassword;
    const useSponsor = Boolean(
        CFG.SPONSORED_TRANSACTION_ENABLED &&
        CFG.SPONSOR_GAS_OWNER &&
        sponsorAddress === CFG.SPONSOR_GAS_OWNER &&
        sponsorAddress !== signingAddress &&
        sponsorPassword !== undefined
    );
    const gasPayerKey = useSponsor && sponsorAddress ? sponsorAddress : signingAddress;

    return withTxSerial(gasPayerKey, async () => {
    let txToSign = txb;
    let signAddress = signingAddress;
    let signPassword = walletPassword;

    if (useSponsor && sponsorAddress) {
        const kindBytes = await txb.build({ client, onlyTransactionKind: true });
        const sponsoredTx = Transaction.fromKind(kindBytes);
        sponsoredTx.setSender(signingAddress);
        sponsoredTx.setGasOwner(sponsorAddress);
        const gasBudgetNum = CFG.GAS_BUDGET != null && Number(CFG.GAS_BUDGET) > 0 ? Number(CFG.GAS_BUDGET) : 10_000_000;
        sponsoredTx.setGasBudget(BigInt(Number.isNaN(gasBudgetNum) ? 10_000_000 : gasBudgetNum));
        const coins = await getSponsorGasCoins(client, sponsorAddress);
        if (coins.length === 0) throw new Error('SPONSOR_GAS_OWNER hat keine Coin-Objekte für Gas.');
        sponsoredTx.setGasPayment(coins);
        txToSign = sponsoredTx;
        signAddress = sponsorAddress;
        signPassword = sponsorPassword;
    } else {
        const gasBudgetNum = CFG.GAS_BUDGET != null && Number(CFG.GAS_BUDGET) > 0 ? Number(CFG.GAS_BUDGET) : 10_000_000;
        txToSign.setGasBudget(BigInt(Number.isNaN(gasBudgetNum) ? 10_000_000 : gasBudgetNum));
        const coins = await getSponsorGasCoins(client, signAddress);
        if (coins.length === 0) throw new Error('Keine Coin-Objekte für Gas. Bitte IOTA aufladen (Wallet-Adresse: Signer).');
        txToSign.setGasPayment(coins);
    }

    const execOptions = {
        options: { showEffects: true as const, showObjectChanges: true as const, showEvents: true as const },
    };
    const signerMode = resolveSignerMode(CFG.SIGNER);

    if (signerMode === 'sdk') {
        const signer = getSdkSigner();
        if (!signer) throw new Error('Signer-Factory (sdk): Kein Signer gesetzt. Bitte Mnemonic/Secret laden oder Session-Signer aktivieren.');
        const resp = await client.signAndExecuteTransaction({ transaction: txToSign, signer, ...execOptions });
        const effects = (resp as { effects?: { status?: string; created?: Array<{ reference?: { objectId?: string } }>; gasUsed?: Record<string, unknown> }; digest?: string; objectChanges?: unknown })?.effects;
        const objectChanges = (resp as { objectChanges?: unknown }).objectChanges;
        const createdObjectIds = parseCreatedObjectIds(effects, objectChanges);
        const gasSummary = parseGasSummary(effects);
        const status = effectStatusFromEffects(effects);
        const out = { digest: (resp as { digest?: string }).digest, status, createdObjectIds: createdObjectIds.length ? createdObjectIds : undefined, gasSummary };
        recordMessengerSelfPaidMilestoneIfNeeded(trackMessengerMilestone, useSponsor, signingAddress, status, out.digest);
        return out;
    }

    const bytes = await txToSign.build({ client });
    /** ~128 KiB serielle TX; drüber drohen BCS/CLI-Fehler (u. a. „InvalidInput“ beim Sign). */
    const maxTxBytes = 128 * 1024 - 4096;
    if (bytes.length > maxTxBytes) {
        throw new Error(
            `Transaktion zu groß (${bytes.length} B, praktisches Limit ~${maxTxBytes} B). Kürzere Nachricht, kleineres Kompaktbild oder kürzeres Audio.`
        );
    }
    const base64Tx = Buffer.from(bytes).toString('base64');
    if (debugIotaCli()) {
        const h = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
        logger.info(
            `morg.iota.cli.txBuilt bytes=${bytes.length} b64len=${base64Tx.length} sha256_16=${h} signAddr=${signAddress}`
        );
    }

    const normalizedB64 = normalizeTxBase64(base64Tx);
    const useStdinForSign = signerMode === 'cli' && shouldPassIotaTxViaStdin(normalizedB64.length);
    if (useStdinForSign) logPrepareMode('stdin', normalizedB64.length);
    else logPrepareMode('inline', normalizedB64.length);

    const signerProvider = createSignerProvider(
        signerMode === 'remote'
            ? {
                mode: 'remote',
                remoteSignBase64: async (txBytesBase64: string) =>
                    fetchRemoteSignature(signAddress, txBytesBase64),
            }
            : {
                mode: 'cli',
                cliSignBase64: async (txBytesBase64: string) =>
                    signWithCli(txBytesBase64, signAddress, signPassword, useStdinForSign),
            }
    );
    const signature = (await signerProvider.sign(bytes)).signature;

    let digest: string | undefined;
    let status: string | undefined;
    let execJson: Record<string, unknown> | undefined;

    if (signerMode === 'remote') {
        // Ohne CLI: Execute per SDK (Maschine braucht keine IOTA-CLI). showEffects für gasSummary (Storage Rebate).
        const resp = await client.executeTransactionBlock({
            transactionBlock: base64Tx,
            signature,
            ...execOptions,
            options: { showEffects: true, ...(execOptions?.options as object) },
        });
        digest = (resp as { digest?: string }).digest;
        const effects = (resp as { effects?: Record<string, unknown> & { created?: Array<{ reference?: { objectId?: string } }>; gasUsed?: Record<string, unknown> } })?.effects;
        const objectChanges = (resp as { objectChanges?: unknown }).objectChanges;
        status = effectStatusFromEffects(effects);
        const createdObjectIds = parseCreatedObjectIds(effects, objectChanges);
        const gasSummary = parseGasSummary(effects);
        const out = { digest, status, createdObjectIds: createdObjectIds.length ? createdObjectIds : undefined, gasSummary };
        recordMessengerSelfPaidMilestoneIfNeeded(trackMessengerMilestone, useSponsor, signingAddress, status, digest);
        return out;
    } else {
        try {
            const resp = await client.executeTransactionBlock({
                transactionBlock: base64Tx,
                signature,
                ...execOptions,
                options: { showEffects: true, showObjectChanges: true, showEvents: true, ...(execOptions?.options as object) },
            });
            digest = (resp as { digest?: string }).digest;
            const effects = (resp as { effects?: Record<string, unknown> & { created?: Array<{ reference?: { objectId?: string } }>; gasUsed?: Record<string, unknown> } })?.effects;
            const objectChanges = (resp as { objectChanges?: unknown }).objectChanges;
            status = effectStatusFromEffects(effects);
            execJson = { digest, effects, objectChanges };
        } catch (_sdkExecuteErr: unknown) {
            const useStdinExec = shouldPassIotaTxViaStdin(normalizedB64.length);
            const runExecCli = async (opts?: { forceTxStdin?: boolean }): Promise<void> => {
                const txOnStdinPipe = opts?.forceTxStdin === true || useStdinExec;
                const execRes = await runIotaCli(
                    [
                        'client',
                        'execute-signed-tx',
                        '--json',
                        '--tx-bytes',
                        txOnStdinPipe ? '-' : normalizedB64,
                        '--signatures',
                        signature,
                    ],
                    txOnStdinPipe ? normalizedB64 : undefined
                );
                execJson = tryParseJson<Record<string, unknown>>(execRes.stdout.trim()) ?? undefined;
                digest =
                    pickString(execJson, ['digest', 'transactionDigest', 'txDigest']) ||
                    pickString((execJson?.result as Record<string, unknown>) || {}, ['digest', 'transactionDigest', 'txDigest']) ||
                    pickString((execJson?.effects as Record<string, unknown>) || {}, ['transactionDigest', 'digest']);
                status = effectStatusFromEffects(execJson?.effects);
            };
            try {
                await runExecCli();
            } catch (e: unknown) {
                if (isIotaVersionMismatch(e)) throw new Error('IOTA CLI und Node-Version stimmen nicht überein (Client/Server api version mismatch). Bitte IOTA CLI auf gleiche Version wie den RPC-Server aktualisieren.');
                if (!useStdinExec && isEnametoolongSpawnError(e)) {
                    logger.info('morg.iota.execute-signed-tx: ENAMETOOLONG, wiederhole mit --tx-bytes - + stdin.');
                    await runExecCli({ forceTxStdin: true });
                } else {
                    const errMsg = String((e as Error)?.message ?? e);
                    if (/Failed to confirm tx status.*within \d+ seconds/i.test(errMsg)) {
                        const digestMatch = /TransactionDigest\(([A-Za-z0-9+/=]+)\)/.exec(errMsg);
                        if (digestMatch) {
                            digest = digestMatch[1];
                            status = 'submitted';
                            execJson = { digest, effects: { status: 'submitted' } };
                        }
                    }
                    if (!digest) throw e;
                }
            }
        }
    }

    const effects = execJson?.effects as { created?: Array<{ reference?: { objectId?: string } }>; gasUsed?: Record<string, unknown> } | undefined;
    const objectChanges =
        execJson?.objectChanges ??
        (execJson?.result as { objectChanges?: unknown } | undefined)?.objectChanges;
    const createdObjectIds = parseCreatedObjectIds(effects, objectChanges);
    const gasSummary = parseGasSummary(effects);
    const out = { digest, status, createdObjectIds: createdObjectIds.length ? createdObjectIds : undefined, gasSummary };
    recordMessengerSelfPaidMilestoneIfNeeded(trackMessengerMilestone, useSponsor, signingAddress, status, digest);
    return out;
    });
}

export type SignAndExecuteWithSignerOptions = {
    /** true: GasPayment/GasBudget bereits am Transaction gesetzt (z. B. Schatten-Sweep mit Merge). */
    skipGasSetup?: boolean;
};

/**
 * Signiert und führt mit einem expliziten Signer aus (ohne globalen SDK-Signer), z. B. Schatten-Wallet beim Sweep.
 */
export async function signAndExecuteWithSigner(
    client: IotaClient,
    txb: Transaction,
    signer: import('@iota/iota-sdk/cryptography').Signer,
    signingAddress: string,
    opts?: SignAndExecuteWithSignerOptions
): Promise<SignAndExecuteResult> {
    assertSafeAddress(signingAddress);
    return withTxSerial(signingAddress, async () => {
        if (!opts?.skipGasSetup) {
            const gasBudgetNum = CFG.GAS_BUDGET != null && Number(CFG.GAS_BUDGET) > 0 ? Number(CFG.GAS_BUDGET) : 10_000_000;
            txb.setGasBudget(BigInt(Number.isNaN(gasBudgetNum) ? 10_000_000 : gasBudgetNum));
            const coins = await getSponsorGasCoins(client, signingAddress);
            if (coins.length === 0) throw new Error('Keine Coin-Objekte für Gas.');
            txb.setGasPayment(coins);
        }
        const execOptions = { options: { showEffects: true as const } };
        const resp = await client.signAndExecuteTransaction({ transaction: txb, signer, ...execOptions });
        const effects = (resp as { effects?: { status?: string; created?: Array<{ reference?: { objectId?: string } }>; gasUsed?: Record<string, unknown> }; digest?: string })?.effects;
        const createdObjectIds = parseCreatedObjectIds(effects);
        const gasSummary = parseGasSummary(effects);
        return {
            digest: (resp as { digest?: string }).digest,
            status: effectStatusFromEffects(effects),
            createdObjectIds: createdObjectIds.length ? createdObjectIds : undefined,
            gasSummary,
        };
    });
}

/** Handshake-TX bauen (für Boss-Provisioning: Handshake beim Erstellen der Adresse senden). */
export function buildHandshakeTransaction(senderAddress: string, recipientAddress: string, pubKeyRaw: Uint8Array): Transaction {
    assertSafeAddress(senderAddress);
    assertSafeAddress(recipientAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const txb = new Transaction();
    txb.setSender(senderAddress);
    const useMailbox = Boolean(CFG.MAILBOX_ID && CFG.USE_MAILBOX);
    if (useMailbox && CFG.MAILBOX_ID) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::store_ecdh_init`,
            arguments: [
                txb.object(CFG.MAILBOX_ID),
                txb.pure.address(recipientAddress),
                txb.pure.vector('u8', Array.from(pubKeyRaw)),
                txb.pure.u64(BigInt(Date.now())),
                txb.pure.u64(CFG.DEFAULT_TTL_DAYS),
            ],
        });
    } else {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::emit_ecdh_init`,
            arguments: [
                txb.pure.address(recipientAddress),
                txb.pure.vector('u8', Array.from(pubKeyRaw)),
                txb.pure.u64(BigInt(Date.now())),
            ],
        });
    }
    return txb;
}

const ACCESS_KEY_STRUCT_TYPE = (packageId: string) => `${packageId}::messaging::AccessKey`;
const TICKET_STRUCT_TYPE = (packageId: string) => `${packageId}::messaging::Ticket`;
const PHYSICAL_ASSET_STRUCT_TYPE = (packageId: string) => `${packageId}::messaging::PhysicalAsset`;

/** Adresse aus Chain-Feld lesen (string 0x… oder Bytes). */
function parseAddressFromFields(val: unknown): string | null {
    if (typeof val === 'string' && /^0x[a-fA-F0-9]{64}$/.test(val)) return val;
    if (Array.isArray(val) && val.length >= 32) {
        const hex = Buffer.from(val.slice(0, 32)).toString('hex');
        return '0x' + hex;
    }
    if (val instanceof Uint8Array && val.length >= 32) return '0x' + Buffer.from(val.slice(0, 32)).toString('hex');
    return null;
}
const EVENT_REGISTRY_STRUCT_TYPE = (packageId: string) => `${packageId}::messaging::EventTicketRegistry`;
const VAULT_KEY_TYPE = (packageId: string) => `${packageId}::messaging::VaultKey`;

/** VaultKey { owner } als BCS (32-Byte-Adresse) + Base64 für getDynamicFieldObject name.bcs. */
function vaultKeyNameBcs(ownerAddress: string): string | null {
    const hex = (ownerAddress || '').replace(/^0x/i, '').trim().toLowerCase();
    if (hex.length !== 64 || !/^[a-f0-9]+$/.test(hex)) return null;
    return Buffer.from(hex, 'hex').toString('base64');
}

/**
 * Liest verschlüsselte Vault-Daten aus dem On-Chain-VaultRegistry (Rebased).
 * Rückgabe: encrypted_data (salt+iv+ciphertext) oder null wenn kein Vault.
 * Ermöglicht: Kein lokales VAULT_FILE nötig – nur Seed + Passwort.
 */
function readEncryptedDataFromVaultResponse(resp: unknown): Uint8Array | null {
    const d = resp as {
        data?: {
            content?: { fields?: Record<string, unknown>; content?: { fields?: Record<string, unknown> } };
            value?: { type?: string; content?: { fields?: Record<string, unknown> }; fields?: Record<string, unknown> };
        };
    };
    const candidates: unknown[] = [
        d?.data?.content?.fields?.encrypted_data,
        d?.data?.content?.content?.fields?.encrypted_data,
        d?.data?.value?.fields?.encrypted_data,
        d?.data?.value?.content?.fields?.encrypted_data,
    ];
    for (const enc of candidates) {
        if (enc && Array.isArray(enc)) return new Uint8Array(enc as number[]);
    }
    return null;
}

async function getVaultFromChainWithName(
    client: IotaClient,
    registryId: string,
    packageId: string,
    name: { type: string; bcs?: string; value?: Record<string, string> }
): Promise<Uint8Array | null> {
    const resp = await client.getDynamicFieldObject({
        parentObjectId: registryId,
        name,
        options: { showContent: true },
    } as Parameters<IotaClient['getDynamicFieldObject']>[0]);
    const anyResp = resp as Record<string, unknown> | null | undefined;
    const data = (anyResp?.data ?? anyResp) as Record<string, unknown> | undefined;
    if (data?.error != null) return null;
    return readEncryptedDataFromVaultResponse(resp);
}

export async function getVaultFromChain(
    client: IotaClient,
    registryId: string,
    packageId: string,
    ownerAddress: string
): Promise<Uint8Array | null> {
    if (!registryId || !packageId || !ownerAddress) return null;
    const ownerNorm = normalizeAddress(ownerAddress);
    const type = VAULT_KEY_TYPE(packageId);
    // Name des Dynamic Field ist der Struktur-Typ VaultKey { owner }, nicht die nackte address.
    const nameWithValue = { type, value: { owner: ownerNorm } };
    const nameBcs = vaultKeyNameBcs(ownerNorm);
    try {
        // Zuerst mit type+value (VaultKey-Struktur) versuchen – entspricht dem Key-Format der Chain.
        const encValue = await getVaultFromChainWithName(client, registryId, packageId, nameWithValue);
        if (encValue) return encValue;
        if (nameBcs) {
            const encBcs = await getVaultFromChainWithName(client, registryId, packageId, { type, bcs: nameBcs });
            if (encBcs) return encBcs;
        }
        return null;
    } catch {
        return null;
    }
}

/** Listet Dynamic-Field-Namen des Vault-Registry (für Debug: welches name-Format die Chain zurückgibt). */
export async function listVaultRegistryDynamicFields(
    client: IotaClient,
    registryId: string
): Promise<{ type?: string; value?: Record<string, unknown>; bcs?: string }[]> {
    try {
        const page = await client.getDynamicFields({
            parentId: registryId,
            limit: 50,
        } as Parameters<IotaClient['getDynamicFields']>[0]);
        const entries = (page as { data?: Array<{ name?: { type?: string; value?: Record<string, unknown>; bcs?: string } }> })?.data ?? [];
        return entries.map((e) => e?.name ?? {}).filter((n) => n && (n.type || n.bcs));
    } catch {
        return [];
    }
}

/** Für Debug: Keys der Chain-Antwort (ohne Werte), um Response-Struktur zu prüfen. */
export async function getVaultFromChainDebug(
    client: IotaClient,
    registryId: string,
    packageId: string,
    ownerAddress: string
): Promise<{ found: boolean; keys?: string[]; dataKeys?: string[]; valueKeys?: string[]; contentKeys?: string[]; error?: string }> {
    if (!registryId || !packageId || !ownerAddress) {
        return { found: false, error: 'registryId/packageId/owner fehlt' };
    }
    const ownerNorm = normalizeAddress(ownerAddress);
    const type = VAULT_KEY_TYPE(packageId);
    const nameWithValue = { type, value: { owner: ownerNorm } };
    try {
        const resp = await client.getDynamicFieldObject({
            parentObjectId: registryId,
            name: nameWithValue,
            options: { showContent: true },
        } as Parameters<IotaClient['getDynamicFieldObject']>[0]);
        const anyResp = resp as Record<string, unknown> | null | undefined;
        const data = (anyResp?.data ?? anyResp) as Record<string, unknown> | undefined;
        const apiError = data?.error ?? anyResp?.error;
        if (apiError != null) {
            const errStr = typeof apiError === 'object' ? JSON.stringify(apiError) : String(apiError);
            if (typeof apiError === 'object') {
                try { console.warn('[Vault] Chain-API Fehler (getDynamicFieldObject):', JSON.stringify(apiError)); } catch {}
            }
            return { found: false, error: errStr, dataKeys: data ? Object.keys(data) : [], valueKeys: [], contentKeys: [] };
        }
        const dataKeys = data ? Object.keys(data) : [];
        const value = data?.value as Record<string, unknown> | undefined;
        const valueKeys = value ? Object.keys(value) : [];
        const content = (data?.content ?? value?.content) as Record<string, unknown> | undefined;
        const contentKeys = content ? Object.keys(content) : [];
        const dataRec = data as Record<string, unknown> | null | undefined;
        const contentRec = dataRec?.content as Record<string, unknown> | undefined;
        const valueRec = dataRec?.value as Record<string, unknown> | undefined;
        const nestedContent = contentRec?.content as Record<string, unknown> | undefined;
        const nestedValueContent = valueRec?.content as Record<string, unknown> | undefined;
        const fields =
            (contentRec?.fields as Record<string, unknown> | undefined) ??
            (nestedContent?.fields as Record<string, unknown> | undefined) ??
            (valueRec?.fields as Record<string, unknown> | undefined) ??
            (nestedValueContent?.fields as Record<string, unknown> | undefined);
        const keys = fields && typeof fields === 'object' ? Object.keys(fields as Record<string, unknown>) : [];
        return { found: Boolean(keys.length), keys: keys.length ? keys : undefined, dataKeys, valueKeys, contentKeys };
    } catch (e) {
        const err = e as { message?: string; code?: number; data?: unknown };
        const errStr = err?.message ?? (typeof e === 'object' && e !== null ? JSON.stringify(e) : String(e));
        return { found: false, error: errStr, dataKeys: [], valueKeys: [], contentKeys: [] };
    }
}

/**
 * Prüft, ob ownerAddress ein gültiges AccessKey-NFT für lockId besitzt
 * (lock_id === lockId, expires_at_ms > now).
 * Für M2M: Tür prüft, ob Sender einen gültigen Schlüssel hat.
 */
const LOCK_ID_TYPE = (packageId: string) => `${packageId}::messaging::LockId`;

/**
 * Liest die on-chain gespeicherten Öffnen-Wörter für lockId aus dem CommandRegistry.
 * Rückgabe: Array von Kleinbuchstaben-Wörtern oder null wenn nicht gesetzt / Fehler.
 */
export async function getOpenWordsFromChain(
    client: IotaClient,
    registryId: string,
    packageId: string,
    lockId: string
): Promise<string[] | null> {
    if (!registryId || !packageId || !lockId) return null;
    try {
        const resp = await client.getDynamicFieldObject({
            parentObjectId: registryId,
            name: { type: LOCK_ID_TYPE(packageId), value: { lock_id: lockId } },
            options: { showContent: true },
        } as Parameters<IotaClient['getDynamicFieldObject']>[0]);
        const fields = (resp as { data?: { content?: { fields?: Record<string, unknown> } } })?.data?.content?.fields;
        const words = fields?.words;
        if (!words || !Array.isArray(words)) return null;
        const str = new TextDecoder().decode(new Uint8Array(words as number[]));
        return str
            .split(',')
            .map((w) => w.trim().toLowerCase())
            .filter(Boolean);
    } catch {
        return null;
    }
}

export async function hasValidAccessKey(
    client: IotaClient,
    packageId: string,
    ownerAddress: string,
    lockId: string
): Promise<boolean> {
    if (!packageId || !lockId) return false;
    const nowMs = Date.now();
    const wantLock = normalizeAddress(lockId);
    if (!wantLock) return false;
    try {
        let cursor: string | null | undefined = null;
        let hasNext = true;
        while (hasNext) {
            const res = await client.getOwnedObjects({
                owner: ownerAddress,
                filter: { StructType: ACCESS_KEY_STRUCT_TYPE(packageId) },
                options: { showContent: true },
                limit: 50,
                ...(cursor ? { cursor } : {}),
            } as Parameters<IotaClient['getOwnedObjects']>[0]);
            const page = res as {
                data?: Array<{ content?: { fields?: Record<string, unknown> } }>;
                nextCursor?: string | null;
                hasNextPage?: boolean;
            };
            const data = page?.data ?? [];
            for (const item of data) {
                const fields = item?.content?.fields as Record<string, unknown> | undefined;
                if (!fields) continue;
                const lock_id = fields.lock_id as string | undefined;
                const expires_at_ms = typeof fields.expires_at_ms === 'string'
                    ? Number(fields.expires_at_ms)
                    : (fields.expires_at_ms as number | undefined);
                if (normalizeAddress(lock_id) === wantLock && expires_at_ms != null && expires_at_ms > nowMs) {
                    return true;
                }
            }
            cursor = page?.nextCursor ?? null;
            hasNext = !!page?.hasNextPage && !!cursor;
        }
    } catch {
        // ignore
    }
    return false;
}

/**
 * Prüft, ob ownerAddress ein gültiges, ungenutztes Ticket für event_id besitzt
 * (event_id match, valid_from_ms <= now <= valid_until_ms, used === false).
 * Für Einlass/Gate: Hat der Sender ein gültiges Ticket für dieses Event?
 */
export async function hasValidTicket(
    client: IotaClient,
    packageId: string,
    ownerAddress: string,
    eventId: string
): Promise<boolean> {
    if (!packageId || !eventId) return false;
    const nowMs = Date.now();
    const wantEvent = normalizeAddress(eventId);
    if (!wantEvent) return false;
    try {
        let cursor: string | null | undefined = null;
        let hasNext = true;
        while (hasNext) {
            const res = await client.getOwnedObjects({
                owner: ownerAddress,
                filter: { StructType: TICKET_STRUCT_TYPE(packageId) },
                options: { showContent: true },
                limit: 50,
                ...(cursor ? { cursor } : {}),
            } as Parameters<IotaClient['getOwnedObjects']>[0]);
            type OwnedObjItem = { content?: { fields?: Record<string, unknown> }; objectId?: string };
            const page = res as { data?: Array<OwnedObjItem>; nextCursor?: string | null; hasNextPage?: boolean };
            const data = page?.data ?? [];
            for (const item of data) {
                const fields = item?.content?.fields as Record<string, unknown> | undefined;
                if (!fields) continue;
                const ev = fields.event_id as string | undefined;
                const valid_from = typeof fields.valid_from_ms === 'string' ? Number(fields.valid_from_ms) : (fields.valid_from_ms as number | undefined);
                const valid_until = typeof fields.valid_until_ms === 'string' ? Number(fields.valid_until_ms) : (fields.valid_until_ms as number | undefined);
                const used = fields.used === true || fields.used === 'true';
                if (
                    normalizeAddress(ev) === wantEvent &&
                    valid_from != null &&
                    valid_until != null &&
                    !used &&
                    nowMs >= valid_from &&
                    nowMs <= valid_until
                ) {
                    return true;
                }
            }
            cursor = page?.nextCursor ?? null;
            hasNext = !!page?.hasNextPage && !!cursor;
        }
    } catch {
        // ignore
    }
    return false;
}

// --- Messaging: TX bauen + ausführen (Chain Access Layer – einzige Stelle für alle IOTA-TXs) ---

/** Mailbox nur nutzen, wenn eine echte Objekt-ID gesetzt ist (nicht Package-ID, sonst Chain-Fehler „move package passed“). */
function useMailboxForPlaintext(): boolean {
    return Boolean(
        isMessengerMailboxModeActive() &&
        CFG.MAILBOX_ID &&
        CFG.MAILBOX_ID.trim() !== (CFG.PACKAGE_ID || '').trim()
    );
}

/** Klartext zusätzlich in Mailbox speichern (Move: store_plaintext_message_stored). */
function mailboxStoresPlaintext(): boolean {
    return Boolean(CFG.MAILBOX_STORE_PLAINTEXT);
}

/** Gültige Credits-Objekt-ID für PTB (nicht PACKAGE_ID). */
function messengerCreditsObjectIdForTx(): string | undefined {
    const id = (CFG.MESSENGER_CREDITS_OBJECT_ID || '').trim();
    if (!id || !/^0x[a-fA-F0-9]{64}$/i.test(id)) return undefined;
    if (id.trim().toLowerCase() === (CFG.PACKAGE_ID || '').trim().toLowerCase()) return undefined;
    return normalizeAddress(id);
}

/** On-chain MessengerCredits (Balance/Cap) für Status-API / Kunden-UI. */
export type MessengerCreditsSnapshot = {
    objectId: string;
    balance: string;
    maxBalance: string;
};

export async function getMessengerCreditsSnapshot(): Promise<MessengerCreditsSnapshot | null> {
    const id = messengerCreditsObjectIdForTx();
    if (!id) return null;
    try {
        const res = await getClient().getObject({
            id,
            options: { showContent: true, showType: true },
        } as Parameters<IotaClient['getObject']>[0]);
        const data = (res as { data?: { type?: string; content?: { fields?: Record<string, unknown> } } })?.data;
        const typeStr = String(data?.type ?? '');
        if (!typeStr.includes('MessengerCredits')) return null;
        const fields = data?.content?.fields;
        if (!fields || typeof fields !== 'object') return null;
        const balRaw = fields.balance;
        const maxRaw = fields.max_balance;
        const balance = balRaw != null ? BigInt(String(balRaw)) : 0n;
        const maxBalance = maxRaw != null ? BigInt(String(maxRaw)) : 0n;
        return {
            objectId: id,
            balance: balance.toString(),
            maxBalance: maxBalance.toString(),
        };
    } catch {
        return null;
    }
}

/** Max. Empfänger pro mint_messenger_credits_batch-TX (Gas/Größe). */
const MESSENGER_CREDITS_MINT_CHUNK = 28;

export type MessengerCreditsMintParams = {
    initialBalance: bigint;
    maxBalance: bigint;
    refillIntervalMs: bigint;
    refillAmount: bigint;
    costEcdhInit: bigint;
    costStoreMessage: bigint;
};

/** Liest MessengerCreditsMinted-Events einer erfolgreichen TX (recipient → credits_object_id). */
export async function parseMessengerCreditsMintedFromDigest(client: IotaClient, digest: string): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const d = String(digest || '').trim();
    if (!d) return map;
    const pushFromEvents = (events: Array<{ type?: string; parsedJson?: Record<string, unknown> }>) => {
        for (const ev of events) {
            const t = String(ev.type || '');
            if (!/::messaging::MessengerCreditsMinted$/i.test(t) && !/MessengerCreditsMinted/i.test(t)) continue;
            const pj = ev.parsedJson;
            if (!pj || typeof pj !== 'object') continue;
            const recRaw = (pj as { recipient?: unknown }).recipient;
            const idRaw = (pj as { credits_id?: unknown }).credits_id ?? (pj as { creditsId?: unknown }).creditsId;
            const rec = typeof recRaw === 'string' ? normalizeAddress(recRaw) : null;
            const cid =
                typeof idRaw === 'string' && /^0x[a-fA-F0-9]{64}$/i.test(idRaw.trim()) ? normalizeAddress(idRaw.trim()) : null;
            if (rec && cid) map.set(rec, cid);
        }
    };
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await sleep(900);
        try {
            const res = await client.getTransactionBlock({
                digest: d,
                options: { showEvents: true },
            } as Parameters<IotaClient['getTransactionBlock']>[0]);
            const ev =
                (res as { events?: Array<{ type?: string; parsedJson?: Record<string, unknown> }> }).events ??
                (res as { transactionBlock?: { events?: Array<{ type?: string; parsedJson?: Record<string, unknown> }> } })
                    ?.transactionBlock?.events ??
                [];
            pushFromEvents(ev ?? []);
            if (map.size > 0) break;
        } catch {
            // retry
        }
    }
    return map;
}

/**
 * Boss signiert: mint_messenger_credits_batch in Chunks. Rückgabe: normalisierte Empfängeradresse → Credits-Objekt-ID.
 */
export async function mintMessengerCreditsBatchForRecipients(
    bossAddress: string,
    recipientAddresses: string[],
    p: MessengerCreditsMintParams,
    walletPassword?: string
): Promise<Map<string, string>> {
    assertSafeAddress(bossAddress);
    const pkg = (CFG.PACKAGE_ID || '').trim();
    if (!pkg) throw new Error('PACKAGE_ID fehlt.');
    if (recipientAddresses.length === 0) return new Map();
    const client = getClient();
    const merged = new Map<string, string>();
    const normBoss = normalizeAddress(bossAddress);
    for (let i = 0; i < recipientAddresses.length; i += MESSENGER_CREDITS_MINT_CHUNK) {
        const slice = recipientAddresses.slice(i, i + MESSENGER_CREDITS_MINT_CHUNK).map((a) => normalizeAddress(a));
        const txb = new Transaction();
        txb.setSender(normBoss);
        txb.moveCall({
            target: `${pkg}::messaging::mint_messenger_credits_batch`,
            arguments: [
                txb.pure.address(normBoss),
                txb.pure.vector(
                    'address',
                    slice.map((a) => a)
                ),
                txb.pure.u64(p.initialBalance),
                txb.pure.u64(p.maxBalance),
                txb.pure.u64(p.refillIntervalMs),
                txb.pure.u64(p.refillAmount),
                txb.pure.u64(p.costEcdhInit),
                txb.pure.u64(p.costStoreMessage),
            ],
        });
        const res = await signAndExecute(client, txb, normBoss, walletPassword);
        const st = String(res.status || '').toLowerCase();
        if (st && st !== 'success' && st !== 'submitted') {
            throw new Error(`Messenger-Credits-Mint: TX-Status ${res.status || '?'}`);
        }
        const dig = String(res.digest || '').trim();
        if (!dig) throw new Error('Messenger-Credits-Mint: keine Transaktions-Digest.');
        const chunkMap = await parseMessengerCreditsMintedFromDigest(client, dig);
        for (const [k, v] of chunkMap) merged.set(k, v);
        for (const a of slice) {
            if (!merged.has(a)) {
                throw new Error(
                    `Messenger-Credits-Mint: keine Objekt-ID für ${a.slice(0, 12)}… (Chain-Events leer oder falsches Package – deploy/upgraden?)`
                );
            }
        }
    }
    return merged;
}

export function typeName(localName: 'HsKey' | 'MsgKey' | 'PlainMsgKey' | 'VaultKey' | 'TeamPlainBroadcastKey'): string {
    return `${CFG.PACKAGE_ID}::messaging::${localName}`;
}

/** Handshake (EcdhInit) senden – Mailbox oder Events. */
export async function sendEcdhInit(
    recipient: string,
    senderAddress: string,
    pubKeyRaw: Uint8Array,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    assertSafeAddress(recipient);
    assertSafeAddress(senderAddress);
    const pkLen = pubKeyRaw?.length ?? 0;
    if (pkLen < 32 || pkLen > 160) {
        throw new Error(
            `ECDH-Public-Key ungültig (${pkLen} B). Erwartet typisch 65 B (P-256 uncompressed). Vault prüfen oder neu laden.`
        );
    }
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const txb = new Transaction();
    txb.setSender(senderAddress);
    const { isPrivateMailboxObjectIdOverrideActive } = await import('./mailbox-object-id-scope.js');
    const privateMbHs = isPrivateMailboxObjectIdOverrideActive();
    const creditsId = messengerCreditsObjectIdForTx();
    if (isMessengerMailboxModeActive() && CFG.MAILBOX_ID && creditsId && !privateMbHs) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::store_ecdh_init_with_credits`,
            arguments: [
                txb.object(CFG.MAILBOX_ID),
                txb.object(creditsId),
                txb.pure.address(recipient),
                txb.pure.vector('u8', Array.from(pubKeyRaw)),
                txb.pure.u64(BigInt(Date.now())),
                txb.pure.u64(CFG.DEFAULT_TTL_DAYS),
            ],
        });
    } else if (isMessengerMailboxModeActive() && CFG.MAILBOX_ID) {
        const hsTarget = privateMbHs ? 'store_ecdh_init_private' : 'store_ecdh_init';
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::${hsTarget}`,
            arguments: [
                txb.object(CFG.MAILBOX_ID),
                txb.pure.address(recipient),
                txb.pure.vector('u8', Array.from(pubKeyRaw)),
                txb.pure.u64(BigInt(Date.now())),
                txb.pure.u64(CFG.DEFAULT_TTL_DAYS),
            ],
        });
    } else {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::emit_ecdh_init`,
            arguments: [
                txb.pure.address(recipient),
                txb.pure.vector('u8', Array.from(pubKeyRaw)),
                txb.pure.u64(BigInt(Date.now())),
            ],
        });
    }
    return signAndExecute(getClient(), txb, senderAddress, walletPassword, signOptions);
}

/** Geheimnis-Peering: PairingOffer-Event emittieren (nach Package-Upgrade mit emit_pairing_offer). */
export async function sendPairingOffer(
    senderAddress: string,
    nonce: Uint8Array,
    ciphertext: Uint8Array,
    expiresAtMs: bigint,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    assertSafeAddress(senderAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    if (nonce.length < 8 || nonce.length > 64) throw new Error('Pairing-Nonce: 8–64 Bytes.');
    if (ciphertext.length > 65_000) throw new Error('Pairing-Ciphertext zu groß.');
    const txb = new Transaction();
    txb.setSender(senderAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::emit_pairing_offer`,
        arguments: [
            txb.pure(bcs.vector(bcs.u8()).serialize(nonce)),
            txb.pure(bcs.vector(bcs.u8()).serialize(ciphertext)),
            txb.pure.u64(expiresAtMs),
        ],
    });
    return signAndExecute(getClient(), txb, senderAddress, walletPassword, signOptions);
}

export type PairingOfferCandidate = { nonce: Uint8Array; ciphertext: Uint8Array; expiresAtMs: number };

function normalizedPackageIdForEvents(): string {
    return (CFG.PACKAGE_ID || '').trim().toLowerCase();
}

function queryEventsMoveModule(client: IotaClient, limit: number, order: 'ascending' | 'descending') {
    return client.queryEvents({
        query: { MoveModule: { package: (CFG.PACKAGE_ID || '').trim(), module: 'messaging' } },
        limit,
        order,
    });
}

/** Bevorzugt MoveEventType; bei Fehler oder leerem Ergebnis breitere MoveModule-Query (RPC unterscheidet sich). */
async function queryMessagingEvents(opts: { eventStruct: 'PairingOffer' | 'EcdhInit'; limit: number; order: 'ascending' | 'descending' }) {
    const pid = normalizedPackageIdForEvents();
    const client = getClient();
    if (!pid.startsWith('0x')) return { data: [] as unknown[] };
    const eventType = `${pid}::messaging::${opts.eventStruct}`;
    const fallbackLimit = Math.max(opts.limit, 250);

    const tryModule = async () => queryEventsMoveModule(client, fallbackLimit, opts.order);

    let primary;
    try {
        primary = await client.queryEvents({
            query: { MoveEventType: eventType },
            limit: opts.limit,
            order: opts.order,
        } as Parameters<IotaClient['queryEvents']>[0]);
    } catch {
        return tryModule();
    }
    const n = (primary.data as unknown[])?.length ?? 0;
    if (n === 0) {
        try {
            const fb = await tryModule();
            if (((fb.data as unknown[]) ?? []).length > 0) return fb;
        } catch {
            // ignore
        }
    }
    return primary;
}

function parsePairingExpiresMs(raw: unknown): number | null {
    if (raw == null) return null;
    if (typeof raw === 'bigint') {
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    }
    if (typeof raw === 'string') {
        const n = parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
    }
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    return null;
}

/** Letzte PairingOffer-Events (Move) – für /pairing-find (paginiert, damit viele andere Events dazwischen nicht alles verdecken). */
export async function queryRecentPairingOffers(maxCandidates = 200): Promise<PairingOfferCandidate[]> {
    if (!CFG.PACKAGE_ID) return [];
    const pid = normalizedPackageIdForEvents();
    if (!pid.startsWith('0x')) return [];
    const client = getClient();
    const eventType = `${pid}::messaging::PairingOffer`;
    const out: PairingOfferCandidate[] = [];
    const dedupe = new Set<string>();
    const pageSize = 50;
    const maxPages = 30;
    let cursor: string | undefined = undefined;

    const pushFromBatch = (batch: Array<{ type?: string; parsedJson?: Record<string, unknown> }>) => {
        for (const e of batch) {
            if (!e.type?.endsWith('::messaging::PairingOffer')) continue;
            const pj = e.parsedJson ?? {};
            const nonce = coerceParsedJsonByteVector(pj.nonce ?? pj.Nonce);
            const ciphertext = coerceParsedJsonByteVector(pj.ciphertext ?? pj.Ciphertext);
            const exp = parsePairingExpiresMs(pj.expires_at_ms ?? pj.expiresAtMs);
            if (!nonce?.length || !ciphertext?.length || exp == null) continue;
            const k = `${Buffer.from(nonce).toString('hex').slice(0, 32)}:${Buffer.from(ciphertext).toString('hex').slice(0, 48)}`;
            if (dedupe.has(k)) continue;
            dedupe.add(k);
            out.push({ nonce, ciphertext, expiresAtMs: exp });
            if (out.length >= maxCandidates) return;
        }
    };

    try {
        let evCursor: Awaited<ReturnType<IotaClient['queryEvents']>>['nextCursor'] = undefined;
        for (let p = 0; p < maxPages && out.length < maxCandidates; p++) {
            let page: Awaited<ReturnType<IotaClient['queryEvents']>>;
            try {
                page = await client.queryEvents({
                    query: { MoveEventType: eventType },
                    limit: pageSize,
                    order: 'descending',
                    ...(evCursor != null ? { cursor: evCursor } : {}),
                } as Parameters<IotaClient['queryEvents']>[0]);
            } catch {
                break;
            }
            const data = (page.data ?? []) as Array<{ type?: string; parsedJson?: Record<string, unknown> }>;
            if (!data.length) break;
            pushFromBatch(data);
            const next = page.nextCursor;
            if (next == null || next === evCursor) break;
            evCursor = next;
        }
    } catch {
        // Fallback: einmal breite Modul-Query wie bisher
    }

    if (out.length === 0) {
        try {
            const events = await queryMessagingEvents({
                eventStruct: 'PairingOffer',
                limit: Math.max(250, maxCandidates),
                order: 'descending',
            });
            pushFromBatch((events.data as Array<{ type?: string; parsedJson?: Record<string, unknown> }>) ?? []);
        } catch {
            return [];
        }
    }

    return out;
}

/** Verschlüsselte Nachricht speichern (ciphertext, iv, tag, nonce). Kein Klartext-Spiegel — siehe `docs/KLARTEXT-P1-PLAINTEXT-POLICY.md`. */
export async function storeEncryptedMessage(
    recipient: string,
    senderAddress: string,
    ciphertext: Uint8Array,
    iv: Uint8Array,
    tag: Uint8Array,
    nonce: bigint,
    /** @deprecated Ignoriert (P1): Klartext-Spiegel bei E2EE entfernt. Nur `/send-plain` nutzt Klartext on-chain. */
    _plaintext?: Uint8Array,
    walletPassword?: string,
    options?: {
        /** `true` (Default bei Modus „event“): `send_encrypted_message` — flüchtiges Event. */
        forceLegacyEncrypted?: boolean;
        signOptions?: SignAndExecuteOptions;
    }
): Promise<{ digest?: string; status?: string }> {
    assertSafeAddress(recipient);
    assertSafeAddress(senderAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const txb = new Transaction();
    txb.setSender(senderAddress);
    const signOptions = options?.signOptions;
    const { isPrivateMailboxObjectIdOverrideActive } = await import('./mailbox-object-id-scope.js');
    const privateMb = isPrivateMailboxObjectIdOverrideActive();
    const mailboxIdValid = CFG.MAILBOX_ID && CFG.MAILBOX_ID.trim() !== (CFG.PACKAGE_ID || '').trim();
    const wantsMailbox = options?.forceLegacyEncrypted === false;
    const useMailbox = wantsMailbox && isMessengerMailboxModeActive() && mailboxIdValid;
    if (wantsMailbox && !useMailbox) {
        const { explainMailboxEncryptedUnavailable } = await import('./messaging-persistence-resolve.js');
        const reason = explainMailboxEncryptedUnavailable(
            {
                useMailbox: isMessengerMailboxModeActive(),
                mailboxId: CFG.MAILBOX_ID,
                packageId: CFG.PACKAGE_ID,
            },
            true
        );
        throw new Error(
            reason ?? 'Verschlüsselte Mailbox nicht verfügbar — MAILBOX_ID/USE_MAILBOX prüfen oder „Event“ wählen.'
        );
    }
    const creditsId = messengerCreditsObjectIdForTx();
    if (useMailbox && creditsId && !privateMb) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::store_encrypted_message_with_credits`,
            arguments: [
                txb.object(CFG.MAILBOX_ID),
                txb.object(creditsId),
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(ciphertext)),
                txb.pure(bcs.vector(bcs.u8()).serialize(iv)),
                txb.pure(bcs.vector(bcs.u8()).serialize(tag)),
                txb.pure.u64(nonce),
                txb.pure.u64(CFG.DEFAULT_TTL_DAYS),
            ],
        });
    } else if (useMailbox) {
        const encStore = privateMb ? 'store_encrypted_message_private' : 'store_encrypted_message';
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::${encStore}`,
            arguments: [
                txb.object(CFG.MAILBOX_ID),
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(ciphertext)),
                txb.pure(bcs.vector(bcs.u8()).serialize(iv)),
                txb.pure(bcs.vector(bcs.u8()).serialize(tag)),
                txb.pure.u64(nonce),
                txb.pure.u64(CFG.DEFAULT_TTL_DAYS),
            ],
        });
    } else {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::send_encrypted_message`,
            arguments: [
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(ciphertext)),
                txb.pure(bcs.vector(bcs.u8()).serialize(iv)),
                txb.pure(bcs.vector(bcs.u8()).serialize(tag)),
                txb.pure.u64(nonce),
            ],
        });
    }
    return signAndExecute(getClient(), txb, senderAddress, walletPassword, signOptions);
}

/** Nur Klartext senden (kein Handshake nötig). */
export async function storePlaintextMessage(
    recipient: string,
    senderAddress: string,
    text: Uint8Array,
    nonce: bigint,
    walletPassword?: string,
    options?: {
        /** Immer Event-Pfad (send_plaintext_message), nie Mailbox – z. B. für /send-plain. */
        forceLegacyPlaintext?: boolean;
        signOptions?: SignAndExecuteOptions;
    }
): Promise<{ digest?: string; status?: string }> {
    assertSafeAddress(recipient);
    assertSafeAddress(senderAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const nonceU64 = nonce != null && typeof nonce === 'bigint' ? nonce : BigInt(Number(nonce) || Date.now() || 0);
    const ttlDays = CFG.DEFAULT_TTL_DAYS != null ? CFG.DEFAULT_TTL_DAYS : 30n;
    const txb = new Transaction();
    txb.setSender(senderAddress);
    // Nie Mailbox nutzen, wenn MAILBOX_ID = PACKAGE_ID (Chain-Fehler „move package passed“). /send-plain erzwingt Event-Pfad.
    const mailboxIdValid = CFG.MAILBOX_ID && CFG.MAILBOX_ID.trim() !== (CFG.PACKAGE_ID || '').trim();
    const wantsMailbox = options?.forceLegacyPlaintext === false;
    const useMailbox = wantsMailbox && useMailboxForPlaintext() && mailboxIdValid;
    if (wantsMailbox && !useMailbox) {
        const { explainMailboxPlaintextUnavailable } = await import('./messaging-persistence-resolve.js');
        const reason = explainMailboxPlaintextUnavailable(
            {
                useMailbox: isMessengerMailboxModeActive(),
                mailboxId: CFG.MAILBOX_ID,
                packageId: CFG.PACKAGE_ID,
                mailboxStorePlaintext: mailboxStoresPlaintext(),
            },
            true
        );
        throw new Error(reason ?? 'Klartext-Mailbox nicht verfügbar — Server-Konfiguration prüfen (MAILBOX_ID, USE_MAILBOX).');
    }
    const { isPrivateMailboxObjectIdOverrideActive } = await import('./mailbox-object-id-scope.js');
    const privateMbPlain = isPrivateMailboxObjectIdOverrideActive();
    const creditsId = messengerCreditsObjectIdForTx();
    const storePlain = mailboxStoresPlaintext();
    if (useMailbox && creditsId && storePlain && !privateMbPlain) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::store_plaintext_message_with_credits_stored`,
            arguments: [
                txb.object(CFG.MAILBOX_ID!),
                txb.object(creditsId),
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                txb.pure.u64(nonceU64),
                txb.pure.u64(ttlDays),
            ],
        });
    } else if (useMailbox && creditsId && !privateMbPlain) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::store_plaintext_message_with_credits`,
            arguments: [
                txb.object(CFG.MAILBOX_ID!),
                txb.object(creditsId),
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                txb.pure.u64(nonceU64),
                txb.pure.u64(ttlDays),
            ],
        });
    } else if (useMailbox && storePlain) {
        const plainStore = privateMbPlain ? 'store_plaintext_message_stored_private' : 'store_plaintext_message_stored';
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::${plainStore}`,
            arguments: [
                txb.object(CFG.MAILBOX_ID!),
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                txb.pure.u64(nonceU64),
                txb.pure.u64(ttlDays),
            ],
        });
    } else if (useMailbox) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::store_plaintext_message`,
            arguments: [
                txb.object(CFG.MAILBOX_ID!),
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                txb.pure.u64(nonceU64),
                txb.pure.u64(ttlDays),
            ],
        });
    } else {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::send_plaintext_message`,
            arguments: [
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                txb.pure.u64(nonceU64),
            ],
        });
    }
    return signAndExecute(getClient(), txb, senderAddress, walletPassword, options?.signOptions);
}

/** Team-Broadcast: 1× Klartext in Shared Team-Mailbox (`store_team_plaintext_broadcast`, kein recipient). */
export async function storeTeamPlaintextBroadcast(
    teamMailboxObjectId: string,
    senderAddress: string,
    text: Uint8Array,
    nonce: bigint,
    walletPassword?: string,
    options?: { signOptions?: SignAndExecuteOptions }
): Promise<{ digest?: string; status?: string }> {
    const mb = teamMailboxObjectId.trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(mb)) {
        throw new Error('teamMailboxObjectId: 0x + 64 Hex.');
    }
    assertSafeAddress(senderAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    if (mb.toLowerCase() === (CFG.PACKAGE_ID || '').trim().toLowerCase()) {
        throw new Error('Team-Mailbox-ID darf nicht gleich PACKAGE_ID sein.');
    }
    if (!mailboxStoresPlaintext()) {
        throw new Error(
            'Team-Broadcast braucht Mailbox-Klartext-Speicher (MAILBOX_STORE_PLAINTEXT / Move publish mit store_team_plaintext_broadcast).'
        );
    }
    const { validateMessagingMailboxObjectForPackage } = await import('@morgendrot/core/iota');
    const mbCheck = await validateMessagingMailboxObjectForPackage(getClient() as never, mb, CFG.PACKAGE_ID!, 'mailbox');
    if (!mbCheck.ok) {
        throw new Error(mbCheck.error);
    }
    const nonceU64 = nonce != null && typeof nonce === 'bigint' ? nonce : BigInt(Number(nonce) || Date.now() || 0);
    const ttlDays = CFG.DEFAULT_TTL_DAYS != null ? CFG.DEFAULT_TTL_DAYS : 30n;
    const txb = new Transaction();
    txb.setSender(senderAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::store_team_plaintext_broadcast`,
        arguments: [
            txb.object(mb),
            txb.pure(bcs.vector(bcs.u8()).serialize(text)),
            txb.pure.u64(nonceU64),
            txb.pure.u64(ttlDays),
        ],
    });
    return signAndExecute(getClient(), txb, senderAddress, walletPassword, options?.signOptions);
}

/** Team-Broadcast verschlüsselt — 1× AEAD-Blob in Shared Team-Mailbox (`store_team_encrypted_broadcast`). */
export async function storeTeamEncryptedBroadcast(
    teamMailboxObjectId: string,
    senderAddress: string,
    ciphertext: Uint8Array,
    iv: Uint8Array,
    tag: Uint8Array,
    keyEpoch: bigint,
    nonce: bigint,
    walletPassword?: string,
    options?: { signOptions?: SignAndExecuteOptions }
): Promise<{ digest?: string; status?: string }> {
    const mb = teamMailboxObjectId.trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(mb)) {
        throw new Error('teamMailboxObjectId: 0x + 64 Hex.');
    }
    assertSafeAddress(senderAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    if (mb.toLowerCase() === (CFG.PACKAGE_ID || '').trim().toLowerCase()) {
        throw new Error('Team-Mailbox-ID darf nicht gleich PACKAGE_ID sein.');
    }
    const { validateMessagingMailboxObjectForPackage } = await import('@morgendrot/core/iota');
    const mbCheck = await validateMessagingMailboxObjectForPackage(getClient() as never, mb, CFG.PACKAGE_ID!, 'mailbox');
    if (!mbCheck.ok) {
        throw new Error(mbCheck.error);
    }
    const nonceU64 = nonce != null && typeof nonce === 'bigint' ? nonce : BigInt(Number(nonce) || Date.now() || 0);
    const epochU64 = keyEpoch != null && typeof keyEpoch === 'bigint' ? keyEpoch : BigInt(Number(keyEpoch) || 1);
    const ttlDays = CFG.DEFAULT_TTL_DAYS != null ? CFG.DEFAULT_TTL_DAYS : 30n;
    const txb = new Transaction();
    txb.setSender(senderAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::store_team_encrypted_broadcast`,
        arguments: [
            txb.object(mb),
            txb.pure(bcs.vector(bcs.u8()).serialize(ciphertext)),
            txb.pure(bcs.vector(bcs.u8()).serialize(iv)),
            txb.pure(bcs.vector(bcs.u8()).serialize(tag)),
            txb.pure.u64(epochU64),
            txb.pure.u64(nonceU64),
            txb.pure.u64(ttlDays),
        ],
    });
    return signAndExecute(getClient(), txb, senderAddress, walletPassword, options?.signOptions);
}

/** § H.33e — Forensisches Batch-Archiv: mehrere Klartext-Mailbox-Einträge in einer PTB. */
export async function storeForensicPlaintextMailboxBatch(
    recipient: string,
    senderAddress: string,
    items: Array<{ wireUtf8: string; nonce: bigint }>,
    walletPassword?: string,
    options?: { signOptions?: SignAndExecuteOptions }
): Promise<SignAndExecuteResult> {
    if (!items.length) throw new Error('Forensic-Batch: mindestens ein Eintrag nötig.');
    assertSafeAddress(recipient);
    assertSafeAddress(senderAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const mailboxIdValid = CFG.MAILBOX_ID && CFG.MAILBOX_ID.trim() !== (CFG.PACKAGE_ID || '').trim();
    const useMailbox = useMailboxForPlaintext() && mailboxIdValid;
    const creditsId = messengerCreditsObjectIdForTx();
    const storePlain = mailboxStoresPlaintext();
    const { isPrivateMailboxObjectIdOverrideActive } = await import('./mailbox-object-id-scope.js');
    const privateMb = isPrivateMailboxObjectIdOverrideActive();
    if (!useMailbox || !storePlain || creditsId) {
        let last: SignAndExecuteResult = {};
        for (const item of items) {
            last = await storePlaintextMessage(
                recipient,
                senderAddress,
                new TextEncoder().encode(item.wireUtf8),
                item.nonce,
                walletPassword,
                options
            );
        }
        return last;
    }
    const { buildStorePlaintextMailboxBatchTransaction } = await import('@morgendrot/core/iota');
    const txb = buildStorePlaintextMailboxBatchTransaction({
        packageId: CFG.PACKAGE_ID,
        mailboxObjectId: CFG.MAILBOX_ID!,
        senderAddress,
        recipientAddress: recipient,
        ttlDays: CFG.DEFAULT_TTL_DAYS != null ? CFG.DEFAULT_TTL_DAYS : 30n,
        privateMailbox: privateMb,
        stored: true,
        items: items.map((i) => ({
            plaintextUtf8: new TextEncoder().encode(i.wireUtf8),
            nonce: i.nonce,
        })),
    });
    return signAndExecute(getClient(), txb, senderAddress, walletPassword, options?.signOptions);
}

/** § H.33e — Forensisches verschlüsseltes Batch-Archiv (mehrere Mailbox-Einträge in einer PTB). */
export async function storeForensicEncryptedMailboxBatch(
    recipient: string,
    senderAddress: string,
    items: Array<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array; nonce: bigint }>,
    walletPassword?: string,
    options?: { signOptions?: SignAndExecuteOptions }
): Promise<SignAndExecuteResult> {
    if (!items.length) throw new Error('Forensic-Batch: mindestens ein Eintrag nötig.');
    assertSafeAddress(recipient);
    assertSafeAddress(senderAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const mailboxIdValid = CFG.MAILBOX_ID && CFG.MAILBOX_ID.trim() !== (CFG.PACKAGE_ID || '').trim();
    const useMailbox = isMessengerMailboxModeActive() && mailboxIdValid;
    const creditsId = messengerCreditsObjectIdForTx();
    const { isPrivateMailboxObjectIdOverrideActive } = await import('./mailbox-object-id-scope.js');
    const privateMb = isPrivateMailboxObjectIdOverrideActive();
    if (!useMailbox || creditsId) {
        let last: SignAndExecuteResult = {};
        for (const item of items) {
            last = await storeEncryptedMessage(
                recipient,
                senderAddress,
                item.ciphertext,
                item.iv,
                item.tag,
                item.nonce,
                undefined,
                walletPassword,
                { forceLegacyEncrypted: false, signOptions: options?.signOptions }
            );
        }
        return last;
    }
    const { buildStoreEncryptedMailboxBatchTransaction } = await import('@morgendrot/core/iota');
    const txb = buildStoreEncryptedMailboxBatchTransaction({
        packageId: CFG.PACKAGE_ID,
        mailboxObjectId: CFG.MAILBOX_ID!,
        senderAddress,
        recipientAddress: recipient,
        ttlDays: CFG.DEFAULT_TTL_DAYS != null ? CFG.DEFAULT_TTL_DAYS : 30n,
        privateMailbox: privateMb,
        items,
    });
    return signAndExecute(getClient(), txb, senderAddress, walletPassword, options?.signOptions);
}

/** PTB: Dieselbe Plaintext-Nachricht an mehrere Empfaenger in einer TX senden (Boss-Broadcast). */
export async function storePlaintextMessageBatch(
    recipients: string[],
    senderAddress: string,
    text: Uint8Array,
    nonce: bigint,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    const valid = recipients.filter(r => r && /^0x[a-fA-F0-9]{64}$/.test(r.trim()));
    if (valid.length === 0) throw new Error('Mindestens ein gültiger Empfänger nötig (0x…).');
    if (valid.length === 1) return storePlaintextMessage(valid[0], senderAddress, text, nonce, walletPassword, { signOptions });
    assertSafeAddress(senderAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const mailboxIdValid = CFG.MAILBOX_ID && CFG.MAILBOX_ID.trim() !== (CFG.PACKAGE_ID || '').trim();
    const useMailbox = useMailboxForPlaintext() && mailboxIdValid;
    const creditsId = messengerCreditsObjectIdForTx();
    const storePlain = mailboxStoresPlaintext();
    const txb = new Transaction();
    txb.setSender(senderAddress);
    const nonceU64 = nonce != null && typeof nonce === 'bigint' ? nonce : BigInt(Number(nonce) || Date.now() || 0);
    const ttlDays = CFG.DEFAULT_TTL_DAYS != null ? CFG.DEFAULT_TTL_DAYS : 30n;
    for (const recipient of valid) {
        if (useMailbox && creditsId && storePlain) {
            txb.moveCall({
                target: `${CFG.PACKAGE_ID}::messaging::store_plaintext_message_with_credits_stored`,
                arguments: [
                    txb.object(CFG.MAILBOX_ID!),
                    txb.object(creditsId),
                    txb.pure.address(recipient),
                    txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                    txb.pure.u64(nonceU64),
                    txb.pure.u64(ttlDays),
                ],
            });
        } else if (useMailbox && creditsId) {
            txb.moveCall({
                target: `${CFG.PACKAGE_ID}::messaging::store_plaintext_message_with_credits`,
                arguments: [
                    txb.object(CFG.MAILBOX_ID!),
                    txb.object(creditsId),
                    txb.pure.address(recipient),
                    txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                    txb.pure.u64(nonceU64),
                    txb.pure.u64(ttlDays),
                ],
            });
        } else if (useMailbox && storePlain) {
            txb.moveCall({
                target: `${CFG.PACKAGE_ID}::messaging::store_plaintext_message_stored`,
                arguments: [
                    txb.object(CFG.MAILBOX_ID!),
                    txb.pure.address(recipient),
                    txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                    txb.pure.u64(nonceU64),
                    txb.pure.u64(ttlDays),
                ],
            });
        } else if (useMailbox) {
            txb.moveCall({
                target: `${CFG.PACKAGE_ID}::messaging::store_plaintext_message`,
                arguments: [
                    txb.object(CFG.MAILBOX_ID!),
                    txb.pure.address(recipient),
                    txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                    txb.pure.u64(nonceU64),
                    txb.pure.u64(ttlDays),
                ],
            });
        } else {
            txb.moveCall({
                target: `${CFG.PACKAGE_ID}::messaging::send_plaintext_message`,
                arguments: [
                    txb.pure.address(recipient),
                    txb.pure(bcs.vector(bcs.u8()).serialize(text)),
                    txb.pure.u64(nonceU64),
                ],
            });
        }
    }
    return signAndExecute(getClient(), txb, senderAddress, walletPassword, signOptions);
}

/** Purge Handshake aus Mailbox. */
export async function purgeHandshake(
    recipient: string,
    sender: string,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!isMessengerMailboxModeActive() || !CFG.MAILBOX_ID) throw new Error('Mailbox nicht konfiguriert.');
    assertSafeAddress(recipient);
    assertSafeAddress(sender);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::purge_handshake`,
        arguments: [txb.object(CFG.MAILBOX_ID), txb.pure.address(recipient), txb.pure.address(sender)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/** Purge Nachricht aus Mailbox (verschlüsselt oder gespeicherter Klartext). */
export async function purgeMessage(
    recipient: string,
    sender: string,
    nonce: bigint,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!isMessengerMailboxModeActive() || !CFG.MAILBOX_ID) throw new Error('Mailbox nicht konfiguriert.');
    assertSafeAddress(recipient);
    assertSafeAddress(sender);
    assertSafeAddress(signingAddress);
    const client = getClient();
    const mb = CFG.MAILBOX_ID;
    const run = async (target: 'purge_message' | 'purge_plaintext_mail_entry') => {
        const txb = new Transaction();
        txb.setSender(signingAddress);
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::${target}`,
            arguments: [txb.object(mb), txb.pure.address(recipient), txb.pure.address(sender), txb.pure.u64(nonce)],
        });
        return signAndExecute(client, txb, signingAddress, walletPassword, signOptions);
    };
    try {
        return await run('purge_message');
    } catch (e1) {
        try {
            return await run('purge_plaintext_mail_entry');
        } catch {
            throw e1;
        }
    }
}

/** Purge Team-Broadcast aus Shared Team-Mailbox (TeamPlainBroadcastKey). */
export async function purgeTeamPlaintextBroadcast(
    teamMailboxObjectId: string,
    broadcastSender: string,
    nonce: bigint,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    const teamMb = teamMailboxObjectId.trim();
    const broadcaster = broadcastSender.trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(teamMb)) {
        throw new Error('teamMailboxObjectId: 0x + 64 Hex.');
    }
    assertSafeAddress(broadcaster);
    assertSafeAddress(signingAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    if (teamMb.toLowerCase() === (CFG.PACKAGE_ID || '').trim().toLowerCase()) {
        throw new Error('Team-Mailbox-ID darf nicht gleich PACKAGE_ID sein.');
    }
    const { validateMessagingMailboxObjectForPackage } = await import('@morgendrot/core/iota');
    const mbCheck = await validateMessagingMailboxObjectForPackage(
        getClient() as never,
        teamMb,
        CFG.PACKAGE_ID!,
        'mailbox'
    );
    if (!mbCheck.ok) {
        throw new Error(mbCheck.error);
    }
    const nonceU64 = nonce != null && typeof nonce === 'bigint' ? nonce : BigInt(Number(nonce) || 0);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::purge_team_plaintext_broadcast`,
        arguments: [
            txb.object(teamMb),
            txb.pure.address(broadcaster),
            txb.pure.u64(nonceU64),
        ],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/** Vault: Notfall-Purge aktivieren. */
export async function enableEmergencyPurgeVault(
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!CFG.VAULT_REGISTRY_ID) throw new Error('VAULT_REGISTRY_ID nicht gesetzt.');
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::enable_emergency_purge`,
        arguments: [txb.object(CFG.VAULT_REGISTRY_ID)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/** Vault: löschen (nach enable_emergency_purge oder TTL). */
export async function purgeVaultOnChain(
    ownerAddress: string,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!CFG.VAULT_REGISTRY_ID) throw new Error('VAULT_REGISTRY_ID nicht gesetzt.');
    assertSafeAddress(ownerAddress);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::purge_vault`,
        arguments: [txb.object(CFG.VAULT_REGISTRY_ID), txb.pure.address(ownerAddress)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/** PTB: enable_emergency_purge + purge_vault in einer Transaktion (50% Gas-Ersparnis). */
export async function emergencyPurgeVaultPtb(
    ownerAddress: string,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    if (!CFG.VAULT_REGISTRY_ID) throw new Error('VAULT_REGISTRY_ID nicht gesetzt.');
    assertSafeAddress(ownerAddress);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::enable_emergency_purge`,
        arguments: [txb.object(CFG.VAULT_REGISTRY_ID)],
    });
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::purge_vault`,
        arguments: [txb.object(CFG.VAULT_REGISTRY_ID), txb.pure.address(ownerAddress)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/**
 * AccessKey ausstellen. Optional: options.sponsorAddress + options.sponsorPassword für Sponsored Transaction (Gas zahlt Sponsor).
 * LOGIK: Säule 3 (Aktivität). Move: create_access_key → Event AccessKeyCreated.
 * ABHÄNGIGKEIT: PACKAGE_ID, lock + recipient (0x…), Wallet entsperrt.
 * FOLGEAKTION: Key-ID in VAULT_FILE (vault-save); nach TTL /purge-key (Säule 4 Rebate).
 */
export async function createAccessKey(
    lockId: string,
    recipient: string,
    ttlDays: bigint,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    assertSafeAddress(lockId);
    assertSafeAddress(recipient);
    assertSafeAddress(signingAddress);
    const ttl = ttlDays != null && ttlDays !== undefined ? BigInt(ttlDays) : BigInt(30);
    if (ttl <= 0n) throw new Error('TTL (Tage) muss positiv sein.');
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::create_access_key`,
        arguments: [txb.pure.address(lockId), txb.pure.address(recipient), txb.pure.u64(ttl)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** PTB: Mehrere AccessKeys in einer Transaktion erstellen (gleicher lock, recipient, ttl). */
export async function createAccessKeysBatchPtb(
    lockId: string,
    recipient: string,
    ttlDays: bigint,
    count: number,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    assertSafeAddress(lockId);
    assertSafeAddress(recipient);
    assertSafeAddress(signingAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    if (count < 1 || count > 50) throw new Error('Anzahl muss zwischen 1 und 50 liegen.');
    const txb = new Transaction();
    txb.setSender(signingAddress);
    for (let i = 0; i < count; i++) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::create_access_key`,
            arguments: [txb.pure.address(lockId), txb.pure.address(recipient), txb.pure.u64(ttlDays)],
        });
    }
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** PTB: Mehrere Tickets in einer Transaktion erstellen (gleicher event, gleicher recipient). */
export async function createTicketsBatchPtb(
    eventId: string,
    validFromMs: bigint,
    validUntilMs: bigint,
    metadataHex: string,
    recipient: string,
    count: number,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    assertSafeAddress(eventId);
    assertSafeAddress(recipient);
    assertSafeAddress(signingAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    if (count < 1 || count > 50) throw new Error('Anzahl muss zwischen 1 und 50 liegen.');
    const metadata =
        metadataHex && metadataHex.trim() && metadataHex.trim() !== '0x'
            ? new Uint8Array((metadataHex.replace(/^0x/i, '').match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)))
            : new Uint8Array(0);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    for (let i = 0; i < count; i++) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::create_ticket`,
            arguments: [
                txb.pure.address(eventId),
                txb.pure.u64(validFromMs),
                txb.pure.u64(validUntilMs),
                txb.pure(bcs.vector(bcs.u8()).serialize(metadata)),
                txb.pure.address(recipient),
            ],
        });
    }
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/**
 * PTB: AccessKey erstellen und Klartext-Nachricht in einer Transaktion (spart Gas + Zeit).
 * Eine TX statt zwei – für Flows wie „Key ausstellen + Bestätigung senden“.
 */
/** Optional: options für Sponsored Transaction (Sponsor zahlt Gas). */
export async function createAccessKeyAndSendPlain(
    lockId: string,
    recipient: string,
    ttlDays: bigint,
    messageText: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    assertSafeAddress(lockId);
    assertSafeAddress(recipient);
    assertSafeAddress(signingAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::create_access_key`,
        arguments: [txb.pure.address(lockId), txb.pure.address(recipient), txb.pure.u64(ttlDays)],
    });
    const nonce = BigInt(Date.now());
    const textBytes = new TextEncoder().encode(messageText);
    const mailboxIdValid = CFG.MAILBOX_ID && CFG.MAILBOX_ID.trim() !== (CFG.PACKAGE_ID || '').trim();
    if (useMailboxForPlaintext() && mailboxIdValid) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::store_plaintext_message`,
            arguments: [
                txb.object(CFG.MAILBOX_ID!),
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(textBytes)),
                txb.pure.u64(nonce),
                txb.pure.u64(CFG.DEFAULT_TTL_DAYS),
            ],
        });
    } else {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::send_plaintext_message`,
            arguments: [
                txb.pure.address(recipient),
                txb.pure(bcs.vector(bcs.u8()).serialize(textBytes)),
                txb.pure.u64(nonce),
            ],
        });
    }
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** AccessKey: Notfall-Purge aktivieren. */
export async function enableEmergencyPurgeKey(
    keyObjectId: string,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    const id = typeof keyObjectId === 'string' ? keyObjectId.trim() : '';
    if (!id || id.startsWith('<') || id.toLowerCase() === 'undefined' || !/^0x[0-9a-fA-F]+$/.test(id))
        throw new Error('Key-Objekt-ID fehlt (0x…).');
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::enable_emergency_purge_key`,
        arguments: [txb.object(id)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/** AccessKey löschen. */
export async function purgeKey(
    keyObjectId: string,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    const id = typeof keyObjectId === 'string' ? keyObjectId.trim() : '';
    if (!id || id.startsWith('<') || id.toLowerCase() === 'undefined' || !/^0x[0-9a-fA-F]+$/.test(id))
        throw new Error('Key-Objekt-ID fehlt (0x…). Bitte zuerst /list-keys ausführen und eine gültige keyId angeben.');
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::purge_key`,
        arguments: [txb.object(id)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/** Mehrere AccessKeys in einer TX (PTB) löschen – eine Computation Fee, volle Storage Rebates. */
export async function purgeMultipleKeys(
    keyObjectIds: string[],
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    const ids = keyObjectIds.filter((id) => id && typeof id === 'string' && id.trim().length > 0);
    if (ids.length === 0) throw new Error('Mindestens eine Key-Objekt-ID nötig (0x…).');
    if (ids.length === 1) return purgeKey(ids[0], signingAddress, walletPassword, signOptions);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    for (const id of ids) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::purge_key`,
            arguments: [txb.object(id)],
        });
    }
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/** AccessKey an neue Adresse übertragen (Weitergabe). */
export async function transferAccessKey(
    keyObjectId: string,
    newOwner: string,
    signingAddress: string,
    walletPassword?: string
): Promise<{ digest?: string; status?: string }> {
    if (!keyObjectId || typeof keyObjectId !== 'string' || !keyObjectId.trim())
        throw new Error('Key-Objekt-ID fehlt (0x…).');
    assertSafeAddress(newOwner);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::transfer_access_key`,
        arguments: [txb.object(keyObjectId), txb.pure.address(newOwner)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword);
}

export type OwnedAccessKey = {
    objectId: string;
    lockId: string;
    expiresAtMs: number;
    issuer: string;
    /** Storage Rebate in Nano (bei Löschung zurück). */
    storageRebate?: string;
};

/** Eigene AccessKeys auflisten. */
export async function getOwnedAccessKeys(
    client: IotaClient,
    packageId: string,
    ownerAddress: string
): Promise<OwnedAccessKey[]> {
    if (!packageId || !ownerAddress) return [];
    const out: OwnedAccessKey[] = [];
    try {
        let cursor: string | null | undefined = null;
        let hasNext = true;
        while (hasNext) {
            const res = await client.getOwnedObjects({
                owner: ownerAddress,
                filter: { StructType: ACCESS_KEY_STRUCT_TYPE(packageId) },
                options: { showContent: true, showStorageRebate: true },
                limit: 50,
                ...(cursor ? { cursor } : {}),
            } as Parameters<IotaClient['getOwnedObjects']>[0]);
            type Item = { data?: { objectId?: string; content?: { fields?: Record<string, unknown> }; storageRebate?: string }; error?: unknown; objectId?: string; content?: { fields?: Record<string, unknown> }; storageRebate?: string };
            const page = res as { data?: Item[]; nextCursor?: string | null; hasNextPage?: boolean };
            const data = page?.data ?? [];
            for (const item of data) {
                if (item?.error) continue;
                const d = item?.data ?? item;
                const fields = (d?.content?.fields ?? item?.content?.fields) as Record<string, unknown> | undefined;
                if (!fields) continue;
                const expiresAt = typeof fields.expires_at_ms === 'string' ? Number(fields.expires_at_ms) : (fields.expires_at_ms as number | undefined);
                const storageRebate = d?.storageRebate ?? item?.storageRebate;
                const objectId = d?.objectId ?? item?.objectId ?? '';
                out.push({
                    objectId: objectId ? normalizeAddress(objectId) : '',
                    lockId: normalizeAddress((fields.lock_id as string) ?? ''),
                    expiresAtMs: expiresAt ?? 0,
                    issuer: normalizeAddress((fields.issuer as string) ?? ''),
                    storageRebate: storageRebate != null ? String(storageRebate) : undefined,
                });
            }
            cursor = page?.nextCursor ?? null;
            hasNext = !!page?.hasNextPage && !!cursor;
        }
    } catch (err) {
        console.warn('[getOwnedAccessKeys] Fehler:', err instanceof Error ? err.message : String(err));
    }
    return out;
}

// --- Ticket-NFT (Festival/Event) ---

/** Ticket-NFT ausstellen und an recipient übertragen. */
export async function createTicket(
    eventId: string,
    validFromMs: bigint,
    validUntilMs: bigint,
    metadataHex: string,
    recipient: string,
    signingAddress: string,
    walletPassword?: string
): Promise<{ digest?: string; status?: string }> {
    if (validFromMs == null || validUntilMs == null)
        throw new Error('valid_from_ms und valid_until_ms dürfen nicht fehlen (z. B. 0 und Zeitstempel in ms).');
    assertSafeAddress(eventId);
    assertSafeAddress(recipient);
    assertSafeAddress(signingAddress);
    const metadata =
        metadataHex && metadataHex.trim() && metadataHex.trim() !== '0x'
            ? new Uint8Array((metadataHex.replace(/^0x/i, '').match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)))
            : new Uint8Array(0);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::create_ticket`,
        arguments: [
            txb.pure.address(eventId),
            txb.pure.u64(validFromMs),
            txb.pure.u64(validUntilMs),
            txb.pure(bcs.vector(bcs.u8()).serialize(metadata)),
            txb.pure.address(recipient),
        ],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword);
}

/** Ticket einlösen (Einlass). Besitzer ruft auf → used=true. Optional: options.sponsorAddress + options.sponsorPassword → Sponsor (z. B. Boss) zahlt Gas. */
export async function useTicket(
    ticketObjectId: string,
    eventId: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    return useTicketInternal(ticketObjectId, eventId, undefined, signingAddress, walletPassword, options);
}

/** Wie use_ticket, mit device_origin_id (Tiny/Gateway: Herkunftsgerät on-chain festgehalten). */
export async function useTicketWithOrigin(
    ticketObjectId: string,
    eventId: string,
    deviceOriginId: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    return useTicketInternal(ticketObjectId, eventId, deviceOriginId, signingAddress, walletPassword, options);
}

function useTicketInternal(
    ticketObjectId: string,
    eventId: string,
    deviceOriginId: string | undefined,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!ticketObjectId || typeof ticketObjectId !== 'string' || !ticketObjectId.trim())
        throw new Error('Ticket-Objekt-ID fehlt (0x…).');
    assertSafeAddress(eventId);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    if (deviceOriginId && deviceOriginId.trim()) {
        const bytes = new Uint8Array([...new TextEncoder().encode(deviceOriginId.trim())]);
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::use_ticket_with_origin`,
            arguments: [txb.object(ticketObjectId), txb.pure.address(eventId), txb.pure(bcs.vector(bcs.u8()).serialize(bytes))],
        });
    } else {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::use_ticket`,
            arguments: [txb.object(ticketObjectId), txb.pure.address(eventId)],
        });
    }
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** Mehrere use_ticket in einem PTB (Deferred Settlement). deviceOriginId optional pro Eintrag (Tiny-Herkunft). */
export type UseTicketEntry = { ticketObjectId: string; eventId: string; deviceOriginId?: string };

export async function batchUseTickets(
    entries: UseTicketEntry[],
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    const list = entries.filter((e) => e?.ticketObjectId?.trim() && e?.eventId?.trim());
    if (list.length === 0) throw new Error('Mindestens ein Eintrag (ticketObjectId, eventId) nötig.');
    if (list.length === 1) {
        const e = list[0];
        return useTicketInternal(e.ticketObjectId, e.eventId, e.deviceOriginId, signingAddress, walletPassword, options);
    }
    assertSafeAddress(signingAddress);
    for (const e of list) assertSafeAddress(e.eventId);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    for (const e of list) {
        if (e.deviceOriginId?.trim()) {
            const bytes = new Uint8Array([...new TextEncoder().encode(e.deviceOriginId.trim())]);
            txb.moveCall({
                target: `${CFG.PACKAGE_ID}::messaging::use_ticket_with_origin`,
                arguments: [txb.object(e.ticketObjectId), txb.pure.address(e.eventId), txb.pure(bcs.vector(bcs.u8()).serialize(bytes))],
            });
        } else {
            txb.moveCall({
                target: `${CFG.PACKAGE_ID}::messaging::use_ticket`,
                arguments: [txb.object(e.ticketObjectId), txb.pure.address(e.eventId)],
            });
        }
    }
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** Ticket: Notfall-Purge aktivieren (Rückgabe). */
export async function enableEmergencyPurgeTicket(
    ticketObjectId: string,
    signingAddress: string,
    walletPassword?: string
): Promise<{ digest?: string; status?: string }> {
    if (!ticketObjectId || typeof ticketObjectId !== 'string' || !ticketObjectId.trim())
        throw new Error('Ticket-Objekt-ID fehlt (0x…).');
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::enable_emergency_purge_ticket`,
        arguments: [txb.object(ticketObjectId)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword);
}

/** Ticket löschen. Erlaubt: !used (Refund), purge_allowed (Emergency), abgelaufen. */
export async function purgeTicket(
    ticketObjectId: string,
    signingAddress: string,
    walletPassword?: string
): Promise<{ digest?: string; status?: string }> {
    if (!ticketObjectId || typeof ticketObjectId !== 'string' || !ticketObjectId.trim())
        throw new Error('Ticket-Objekt-ID fehlt (0x…). Zuerst /list-tickets ausführen.');
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::purge_ticket`,
        arguments: [txb.object(ticketObjectId)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword);
}

/** Mehrere Tickets in einer TX (PTB) löschen – eine Computation Fee, volle Storage Rebates. */
export async function purgeMultipleTickets(
    ticketObjectIds: string[],
    signingAddress: string,
    walletPassword?: string
): Promise<SignAndExecuteResult> {
    const ids = ticketObjectIds.filter((id) => id && typeof id === 'string' && id.trim().length > 0);
    if (ids.length === 0) throw new Error('Mindestens eine Ticket-Objekt-ID nötig (0x…).');
    if (ids.length === 1) return purgeTicket(ids[0], signingAddress, walletPassword);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    for (const id of ids) {
        txb.moveCall({
            target: `${CFG.PACKAGE_ID}::messaging::purge_ticket`,
            arguments: [txb.object(id)],
        });
    }
    return signAndExecute(getClient(), txb, signingAddress, walletPassword);
}

/** Ticket an neue Adresse übertragen (Weitergabe, Weiterverkauf). */
export async function transferTicket(
    ticketObjectId: string,
    newOwner: string,
    signingAddress: string,
    walletPassword?: string
): Promise<{ digest?: string; status?: string }> {
    if (!ticketObjectId || typeof ticketObjectId !== 'string' || !ticketObjectId.trim())
        throw new Error('Ticket-Objekt-ID fehlt (0x…).');
    assertSafeAddress(newOwner);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::transfer_ticket`,
        arguments: [txb.object(ticketObjectId), txb.pure.address(newOwner)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword);
}

/** Weg 1 – Boss: Registry für Event anlegen (einmalig). Boss wird Owner der Registry. */
export async function createEventRegistry(
    eventId: string,
    signingAddress: string,
    walletPassword?: string
): Promise<{ digest?: string; createdObjectIds?: string[] }> {
    assertSafeAddress(eventId);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::create_event_registry`,
        arguments: [txb.pure.address(eventId)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword);
}

/** Weg 1 – Boss: Ticket in Registry anlegen (recipient = wer am Gate einlösen darf). Rebate bei Purge an Boss. */
export async function createTicketToRegistry(
    registryObjectId: string,
    eventId: string,
    validFromMs: bigint,
    validUntilMs: bigint,
    metadataHex: string,
    recipient: string,
    signingAddress: string,
    walletPassword?: string
): Promise<{ digest?: string }> {
    assertSafeAddress(eventId);
    assertSafeAddress(recipient);
    assertSafeAddress(signingAddress);
    const metadata =
        metadataHex && metadataHex.trim() && metadataHex.trim() !== '0x'
            ? new Uint8Array((metadataHex.replace(/^0x/i, '').match(/.{1,2}/g) ?? []).map((b) => parseInt(b, 16)))
            : new Uint8Array(0);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::create_ticket_to_registry`,
        arguments: [
            txb.object(registryObjectId),
            txb.pure.address(eventId),
            txb.pure.u64(validFromMs),
            txb.pure.u64(validUntilMs),
            txb.pure(bcs.vector(bcs.u8()).serialize(metadata)),
            txb.pure.address(recipient),
        ],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword);
}

/** Weg 1 – Gast: Ticket aus Registry einlösen (nur recipient). Burn-on-Use, Rebate an Sender. Optional: options → Sponsor zahlt Gas. */
export async function useTicketFromRegistry(
    registryObjectId: string,
    ticketId: string,
    eventId: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<{ digest?: string }> {
    assertSafeAddress(eventId);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::use_ticket_from_registry`,
        arguments: [txb.object(registryObjectId), txb.pure.address(ticketId), txb.pure.address(eventId)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** Weg 1 – Boss: Alle abgelaufenen Tickets in der Registry löschen. Rebate an Boss. */
export async function purgeExpiredTickets(
    registryObjectId: string,
    signingAddress: string,
    walletPassword?: string
): Promise<{ digest?: string }> {
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::purge_expired_tickets`,
        arguments: [txb.object(registryObjectId)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword);
}

export type OwnedTicket = {
    objectId: string;
    eventId: string;
    validFromMs: number;
    validUntilMs: number;
    used: boolean;
    issuer: string;
    /** Storage Rebate in Nano (bei Löschung zurück). */
    storageRebate?: string;
};

/** Eigene Tickets auflisten (gültig, abgelaufen, benutzt). */
export async function getOwnedTickets(
    client: IotaClient,
    packageId: string,
    ownerAddress: string
): Promise<OwnedTicket[]> {
    if (!packageId || !ownerAddress) return [];
    const out: OwnedTicket[] = [];
    try {
        let cursor: string | null | undefined = null;
        let hasNext = true;
        while (hasNext) {
            const res = await client.getOwnedObjects({
                owner: ownerAddress,
                filter: { StructType: TICKET_STRUCT_TYPE(packageId) },
                options: { showContent: true, showStorageRebate: true },
                limit: 50,
                ...(cursor ? { cursor } : {}),
            } as Parameters<IotaClient['getOwnedObjects']>[0]);
            type Item = { data?: { objectId?: string; content?: { fields?: Record<string, unknown> }; storageRebate?: string }; error?: unknown; objectId?: string; content?: { fields?: Record<string, unknown> }; storageRebate?: string };
            const page = res as { data?: Item[]; nextCursor?: string | null; hasNextPage?: boolean };
            const data = page?.data ?? [];
            for (const item of data) {
                if (item?.error) continue;
                const d = item?.data ?? item;
                const fields = (d?.content?.fields ?? item?.content?.fields) as Record<string, unknown> | undefined;
                if (!fields) continue;
                const validFrom = typeof fields.valid_from_ms === 'string' ? Number(fields.valid_from_ms) : (fields.valid_from_ms as number | undefined);
                const validUntil = typeof fields.valid_until_ms === 'string' ? Number(fields.valid_until_ms) : (fields.valid_until_ms as number | undefined);
                const storageRebate = d?.storageRebate ?? item?.storageRebate;
                const objectId = d?.objectId ?? item?.objectId ?? '';
                out.push({
                    objectId: objectId ? normalizeAddress(objectId) : '',
                    eventId: normalizeAddress((fields.event_id as string) ?? ''),
                    validFromMs: validFrom ?? 0,
                    validUntilMs: validUntil ?? 0,
                    used: fields.used === true || fields.used === 'true',
                    issuer: normalizeAddress((fields.issuer as string) ?? ''),
                    storageRebate: storageRebate != null ? String(storageRebate) : undefined,
                });
            }
            cursor = page?.nextCursor ?? null;
            hasNext = !!page?.hasNextPage && !!cursor;
        }
    } catch (err) {
        console.warn('[getOwnedTickets] Fehler:', err instanceof Error ? err.message : String(err));
    }
    return out;
}

// --- PhysicalAsset (Asset-Twin / Inventar) ---

export type OwnedPhysicalAssetItem = {
    objectId: string;
    name: string;
    metadata: string;
    streamsAnchorId?: string;
    nfcUid?: string;
    createdAtMs: number;
    storageRebate?: string;
    /** Erzeuger-Adresse (Boss); für Echtheits-Check. */
    creatorAddress?: string;
    /** Ed25519-Signatur über message = object_id (32 B) || creator_address (32 B); Hex. */
    creatorSignature?: string;
};

/** Team-Shared-Mailbox on-chain (`Mailbox`, nicht PrivateMailbox). */
export async function createTeamMailbox(
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    assertSafeAddress(signingAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::create_team_mailbox`,
        arguments: [],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** M4d: eigene PrivateMailbox on-chain (shared Object, `owner` = Sender). */
export async function createPrivateMailbox(
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    assertSafeAddress(signingAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::create_private_mailbox`,
        arguments: [],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** M4d: Owner-Wallet einer PrivateMailbox on-chain (für Kontakt aus nur Object-ID). */
export async function getPrivateMailboxOwnerFromChain(mailboxObjectId: string): Promise<{
    owner: string;
    mailboxObjectId: string;
    isPrivateMailbox: boolean;
}> {
    const oid = mailboxObjectId.trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(oid)) {
        throw new Error('mailboxObjectId: 0x + 64 Hex.');
    }
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const client = getClient();
    const objRes = await client.getObject({
        id: oid,
        options: { showOwner: true, showType: true, showContent: true },
    } as Parameters<IotaClient['getObject']>[0]);
    const data = (objRes as { data?: { type?: string; owner?: unknown; content?: { fields?: Record<string, unknown> } } })
        ?.data;
    if (!data) throw new Error('Object nicht gefunden (Netzwerk / Object-ID).');
    const typeStr = String(data.type ?? '');
    const pkg = (CFG.PACKAGE_ID || '').trim().toLowerCase();
    const isPrivateMailbox = Boolean(pkg && typeStr.toLowerCase().includes(`${pkg}::messaging::privatemailbox`));
    if (!isPrivateMailbox) {
        throw new Error('Object ist keine PrivateMailbox dieses Pakets (PACKAGE_ID prüfen).');
    }
    const ownerField = data.content?.fields?.owner;
    const ownerRaw = ownerField != null ? String(ownerField).trim() : '';
    if (!/^0x[a-fA-F0-9]{64}$/i.test(ownerRaw)) {
        throw new Error('Owner-Feld der PrivateMailbox nicht lesbar.');
    }
    return { owner: normalizeAddress(ownerRaw), mailboxObjectId: oid, isPrivateMailbox: true };
}

/** M4d: PrivateMailbox löschen (Rebate). Nur Owner; Objekt sollte leer sein (keine DF-Einträge). */
export async function purgePrivateMailbox(
    mailboxObjectId: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    if (!mailboxObjectId?.trim() || !/^0x[a-fA-F0-9]{64}$/i.test(mailboxObjectId.trim()))
        throw new Error('Private-Mailbox-Object-ID fehlt (0x + 64 Hex).');
    assertSafeAddress(signingAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const oid = mailboxObjectId.trim();
    const client = getClient();
    try {
        const objRes = await client.getObject({
            id: oid,
            options: { showOwner: true, showType: true, showContent: true },
        } as Parameters<IotaClient['getObject']>[0]);
        const data = (objRes as { data?: { type?: string; owner?: unknown; content?: { fields?: Record<string, unknown> } } })
            ?.data;
        if (!data) throw new Error('Private Mailbox nicht gefunden (Object-ID prüfen).');
        const typeStr = String(data.type ?? '');
        const pkg = (CFG.PACKAGE_ID || '').trim().toLowerCase();
        if (pkg && !typeStr.toLowerCase().includes(`${pkg}::messaging::privatemailbox`)) {
            throw new Error(
                'Object ist keine PrivateMailbox dieses Pakets — PACKAGE_ID in .env zum Objekt passend setzen (ggf. Redeploy).'
            );
        }
        const ownerField = data.content?.fields?.owner;
        if (ownerField != null) {
            const onChainOwner = String(ownerField).trim();
            if (normalizeAddress(onChainOwner) !== normalizeAddress(signingAddress)) {
                throw new Error('Nur der Owner der PrivateMailbox kann Rebate ausführen (andere Wallet?).');
            }
        }
        const owner = data.owner;
        const isShared =
            owner != null && typeof owner === 'object' && ('Shared' in owner || 'shared' in (owner as object));
        if (!isShared) {
            throw new Error('Private Mailbox ist kein Shared-Objekt — unerwarteter Zustand.');
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/not found|exist|404/i.test(msg)) throw new Error('Private Mailbox nicht gefunden (Object-ID / Netzwerk).');
        throw e instanceof Error ? e : new Error(msg);
    }
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::purge_private_mailbox`,
        arguments: [txb.object(oid)],
    });
    return signAndExecute(client, txb, signingAddress, walletPassword, options);
}

/** PhysicalAsset erstellen (name + metadata + optional Streams-Anchor-ID). Owner = Sender. Rebate bei purge_physical_asset. */
export async function createPhysicalAsset(
    name: string,
    metadata: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions,
    streamsAnchorId?: string
): Promise<SignAndExecuteResult> {
    assertSafeAddress(signingAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const nameBytes = new Uint8Array(new TextEncoder().encode(name || ''));
    const metaBytes = new Uint8Array(new TextEncoder().encode(metadata || ''));
    const anchorBytes = new Uint8Array(new TextEncoder().encode(streamsAnchorId?.trim() ?? ''));
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::create_physical_asset`,
        arguments: [
            txb.pure(bcs.vector(bcs.u8()).serialize(nameBytes)),
            txb.pure(bcs.vector(bcs.u8()).serialize(metaBytes)),
            txb.pure(bcs.vector(bcs.u8()).serialize(anchorBytes)),
        ],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** Attestation setzen: Boss-Signatur über message = object_id (32 B) || creator_address (32 B). Nur Ersteller darf aufrufen; nur einmal. */
export async function attestPhysicalAsset(
    assetObjectId: string,
    signatureBytes: Uint8Array,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<SignAndExecuteResult> {
    if (!assetObjectId?.trim() || !/^0x[a-fA-F0-9]+$/.test(assetObjectId.trim()))
        throw new Error('Asset-Objekt-ID fehlt (0x…).');
    assertSafeAddress(signingAddress);
    if (!signatureBytes?.length) throw new Error('Signatur fehlt.');
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::attest_physical_asset`,
        arguments: [
            txb.object(assetObjectId.trim()),
            txb.pure(bcs.vector(bcs.u8()).serialize(Array.from(signatureBytes))),
        ],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** NFC-Hardware-UID einmalig mit dem Asset verknüpfen (nur Besitzer). Kopierschutz / Sicherheitssiegel Grün. */
export async function linkNfcToAsset(
    assetObjectId: string,
    nfcUid: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!assetObjectId?.trim() || !/^0x[a-fA-F0-9]+$/.test(assetObjectId.trim()))
        throw new Error('Asset-Objekt-ID fehlt (0x…).');
    if (!nfcUid?.trim()) throw new Error('NFC-UID fehlt.');
    assertSafeAddress(signingAddress);
    const nfcBytes = new Uint8Array(new TextEncoder().encode(nfcUid.trim()));
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::link_nfc_uid`,
        arguments: [
            txb.object(assetObjectId.trim()),
            txb.pure(bcs.vector(bcs.u8()).serialize(nfcBytes)),
        ],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** PhysicalAsset löschen (nur Besitzer). Rebate an Signer. */
/** PhysicalAsset an neue Adresse übertragen (Besitzwechsel, z. B. Verkauf). */
export async function transferPhysicalAsset(
    assetObjectId: string,
    newOwner: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!assetObjectId?.trim() || !/^0x[a-fA-F0-9]+$/.test(assetObjectId.trim()))
        throw new Error('Asset-Objekt-ID fehlt (0x…).');
    assertSafeAddress(newOwner);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::transfer_physical_asset`,
        arguments: [txb.object(assetObjectId.trim()), txb.pure.address(newOwner)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

export async function purgePhysicalAsset(
    assetObjectId: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!assetObjectId?.trim() || !/^0x[a-fA-F0-9]+$/.test(assetObjectId.trim()))
        throw new Error('Asset-Objekt-ID fehlt (0x…).');
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::purge_physical_asset`,
        arguments: [txb.object(assetObjectId.trim())],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** Asset + Key in einer Transaktion (atomar) an neuen Besitzer übertragen. Für Besitzwechsel: Pumpe verkaufen = Asset + zugehöriger Key gemeinsam übergeben. */
export async function transferAssetAndKeyPtb(
    assetObjectId: string,
    keyObjectId: string,
    newOwner: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!assetObjectId?.trim() || !/^0x[a-fA-F0-9]+$/.test(assetObjectId.trim()))
        throw new Error('Asset-Objekt-ID fehlt (0x…).');
    if (!keyObjectId?.trim() || !/^0x[a-fA-F0-9]+$/.test(keyObjectId.trim()))
        throw new Error('Key-Objekt-ID fehlt (0x…).');
    assertSafeAddress(newOwner);
    assertSafeAddress(signingAddress);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::transfer_physical_asset`,
        arguments: [txb.object(assetObjectId.trim()), txb.pure.address(newOwner)],
    });
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::transfer_access_key`,
        arguments: [txb.object(keyObjectId.trim()), txb.pure.address(newOwner)],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, options);
}

/** Alle PhysicalAssets einer Adresse (für Kachel Asset-Twin / Inventar). */
export async function getOwnedPhysicalAssets(
    client: IotaClient,
    packageId: string,
    ownerAddress: string
): Promise<OwnedPhysicalAssetItem[]> {
    if (!packageId || !ownerAddress) return [];
    const out: OwnedPhysicalAssetItem[] = [];
    try {
        let cursor: string | null | undefined = null;
        let hasNext = true;
        while (hasNext) {
            const res = await client.getOwnedObjects({
                owner: ownerAddress,
                filter: { StructType: PHYSICAL_ASSET_STRUCT_TYPE(packageId) },
                options: { showContent: true, showStorageRebate: true },
                limit: 50,
                ...(cursor ? { cursor } : {}),
            } as Parameters<IotaClient['getOwnedObjects']>[0]);
            type Item = { data?: { objectId?: string; content?: { fields?: Record<string, unknown> }; storageRebate?: string }; error?: unknown; objectId?: string; content?: { fields?: Record<string, unknown> }; storageRebate?: string };
            const page = res as { data?: Item[]; nextCursor?: string | null; hasNextPage?: boolean };
            const data = page?.data ?? [];
            for (const item of data) {
                if (item?.error) continue;
                const d = item?.data ?? item;
                const fields = (d?.content?.fields ?? item?.content?.fields) as Record<string, unknown> | undefined;
                if (!fields) continue;
                const objectId = d?.objectId ?? item?.objectId ?? '';
                const nameBytes = fields.name as number[] | Uint8Array | undefined;
                const metadataBytes = fields.metadata as number[] | Uint8Array | undefined;
                const nameStr = Array.isArray(nameBytes) || nameBytes instanceof Uint8Array
                    ? new TextDecoder().decode(new Uint8Array(nameBytes))
                    : (typeof fields.name === 'string' ? (fields.name as string) : '');
                const metaStr = Array.isArray(metadataBytes) || metadataBytes instanceof Uint8Array
                    ? new TextDecoder().decode(new Uint8Array(metadataBytes))
                    : (typeof fields.metadata === 'string' ? (fields.metadata as string) : '');
                const createdAt = typeof fields.created_at_ms === 'string' ? Number(fields.created_at_ms) : (fields.created_at_ms as number | undefined);
                const storageRebate = d?.storageRebate ?? item?.storageRebate;
                const anchorBytes = fields.streams_anchor_id as number[] | Uint8Array | undefined;
                const streamsAnchorIdStr =
                    Array.isArray(anchorBytes) || anchorBytes instanceof Uint8Array
                        ? new TextDecoder().decode(new Uint8Array(anchorBytes))
                        : (typeof fields.streams_anchor_id === 'string' ? (fields.streams_anchor_id as string) : '');
                const nfcBytes = fields.nfc_uid as number[] | Uint8Array | undefined;
                const nfcUidStr =
                    Array.isArray(nfcBytes) || nfcBytes instanceof Uint8Array
                        ? new TextDecoder().decode(new Uint8Array(nfcBytes))
                        : (typeof fields.nfc_uid === 'string' ? (fields.nfc_uid as string) : '');
                const creatorAddr = parseAddressFromFields(fields.creator_address);
                const creatorSigBytes = fields.creator_signature as number[] | Uint8Array | undefined;
                const creatorSignatureHex =
                    Array.isArray(creatorSigBytes) || creatorSigBytes instanceof Uint8Array
                        ? Buffer.from(creatorSigBytes).toString('hex')
                        : (typeof fields.creator_signature === 'string' ? (fields.creator_signature as string) : undefined);
                out.push({
                    objectId,
                    name: nameStr,
                    metadata: metaStr,
                    streamsAnchorId: streamsAnchorIdStr || undefined,
                    nfcUid: nfcUidStr || undefined,
                    createdAtMs: createdAt ?? 0,
                    storageRebate: storageRebate != null ? String(storageRebate) : undefined,
                    creatorAddress: creatorAddr || undefined,
                    creatorSignature: creatorSignatureHex || undefined,
                });
            }
            cursor = page?.nextCursor ?? null;
            hasNext = !!page?.hasNextPage && !!cursor;
        }
    } catch (err) {
        console.warn('[getOwnedPhysicalAssets] Fehler:', err instanceof Error ? err.message : String(err));
    }
    return out;
}

/** 0x + 64 Hex → 32 Bytes (kanonisch für Attestations-Nachricht). */
export function hexToBytes32(hex: string): Uint8Array {
    const h = (hex || '').replace(/^0x/i, '').trim();
    if (h.length !== 64 || !/^[a-fA-F0-9]+$/.test(h)) throw new Error('Erwarte 0x + 64 Hex (32 Bytes).');
    return new Uint8Array(Buffer.from(h, 'hex'));
}

/** Nachricht M für Boss-Attestation: M = object_id (32 B) ‖ creator_address (32 B). */
export function buildAssetAttestationMessage(objectIdHex: string, creatorAddressHex: string): Uint8Array {
    const a = hexToBytes32(objectIdHex);
    const b = hexToBytes32(creatorAddressHex);
    const out = new Uint8Array(64);
    out.set(a, 0);
    out.set(b, 32);
    return out;
}

/** Prüft: Signatur σ über M = object_id ‖ creator_address gültig und Signer = bossAddress. Verwendet verifyPersonalMessageSignature (IOTA SDK). */
export async function verifyAssetCreatorSignature(
    objectIdHex: string,
    creatorAddressHex: string,
    signatureHex: string,
    bossAddress: string
): Promise<boolean> {
    const norm = (s: string) => (s || '').replace(/^0x/i, '').trim().toLowerCase();
    if (!objectIdHex || !creatorAddressHex || !signatureHex || !bossAddress) return false;
    if (norm(creatorAddressHex) !== norm(bossAddress)) return false;
    try {
        const message = buildAssetAttestationMessage(objectIdHex, creatorAddressHex);
        const sigBytes = Buffer.from((signatureHex || '').replace(/^0x/i, ''), 'hex');
        if (sigBytes.length === 0) return false;
        const sigBase64 = Buffer.from(sigBytes).toString('base64');
        const { verifyPersonalMessageSignature } = await import('@iota/iota-sdk/verify');
        const signerPubKey = await verifyPersonalMessageSignature(message, sigBase64);
        if (!signerPubKey) return false;
        const derivedAddr = (signerPubKey as { toAddress?: () => string; toRaw?: () => Uint8Array }).toAddress?.() ?? (signerPubKey as { toRaw?: () => Uint8Array }).toRaw?.();
        const derivedNorm = typeof derivedAddr === 'string'
            ? norm(derivedAddr)
            : derivedAddr && derivedAddr.length >= 32
                ? Buffer.from(derivedAddr.slice(0, 32)).toString('hex').toLowerCase()
                : '';
        return derivedNorm.length === 64 && derivedNorm === norm(bossAddress);
    } catch {
        return false;
    }
}

/** Eigene EventTicketRegistry-Objekte (Boss = Owner). Für /purge-expired-tickets, wenn keine EVENT_REGISTRY_ID gesetzt. */
export async function getOwnedEventRegistries(
    client: IotaClient,
    packageId: string,
    ownerAddress: string
): Promise<string[]> {
    if (!packageId || !ownerAddress) return [];
    const ids: string[] = [];
    try {
        let cursor: string | null | undefined = null;
        let hasNext = true;
        while (hasNext) {
            const res = await client.getOwnedObjects({
                owner: ownerAddress,
                filter: { StructType: EVENT_REGISTRY_STRUCT_TYPE(packageId) },
                options: {},
                limit: 50,
                ...(cursor ? { cursor } : {}),
            } as Parameters<IotaClient['getOwnedObjects']>[0]);
            type Item = { data?: { objectId?: string }; error?: unknown; objectId?: string };
            const page = res as { data?: Item[]; nextCursor?: string | null; hasNextPage?: boolean };
            const data = page?.data ?? [];
            for (const item of data) {
                if (item?.error) continue;
                const oid = (item?.data?.objectId ?? item?.objectId ?? '').trim();
                if (oid && /^0x[a-fA-F0-9]{64}$/.test(oid)) ids.push(oid);
            }
            cursor = page?.nextCursor ?? null;
            hasNext = !!page?.hasNextPage && !!cursor;
        }
    } catch (err) {
        console.warn('[getOwnedEventRegistries] Fehler:', err instanceof Error ? err.message : String(err));
    }
    return ids;
}

export type OwnedObjectSummary = {
    objectId: string;
    type: string;
    kind: 'coin' | 'key' | 'ticket' | 'asset' | 'kiosk' | 'other';
    label: string;
    rebateable: boolean;
    packageId?: string;
    storageRebate?: string;
};

const PACKAGE_ID_FULL_REGEX = /^0x[a-fA-F0-9]{64}$/;

/** Liest das Objekt-Array aus getOwnedObjects-Response (res.data oder res.result?.data). */
function getOwnedObjectsDataArray(res: unknown): unknown[] {
    if (!res || typeof res !== 'object') return [];
    const r = res as Record<string, unknown>;
    const arr = r.data ?? (r.result as Record<string, unknown> | undefined)?.data;
    return Array.isArray(arr) ? arr : [];
}

/** Typ-String aus einem getOwnedObjects-Item; prüft alle bekannten SDK-Pfade (data.type, data.content.type, data.value.type, type). */
function getTypeFromOwnedObjectItem(item: unknown): string {
    if (!item || typeof item !== 'object') return '';
    const o = item as Record<string, unknown>;
    const data = o.data as Record<string, unknown> | undefined;
    const candidates = [
        data?.type,
        o.type,
        (data?.content as Record<string, unknown> | undefined)?.type,
        (data?.value as Record<string, unknown> | undefined)?.type,
        (o.content as Record<string, unknown> | undefined)?.type,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return '';
}

function extractPackageIdFromType(typeStr: string | null | undefined): string | null {
    const t = (typeStr || '').trim();
    if (!t) return null;
    const first = t.split('::')[0];
    return first && PACKAGE_ID_FULL_REGEX.test(first) ? first : null;
}

function classifyOwnedObjectType(
    typeStr: string | null | undefined,
    ourPackageId: string | null
): { kind: OwnedObjectSummary['kind']; label: string; rebateable: boolean; packageId?: string } {
    const t = (typeStr || '').trim();
    const extractedPkg = extractPackageIdFromType(t);
    if (!t) return { kind: 'other', label: 'Unbekannt', rebateable: false };
    if (/::coin::Coin\b/.test(t) || /^0x2::coin/.test(t)) return { kind: 'coin', label: 'Coin (IOTA)', rebateable: false };
    if (/::messaging::AccessKey\b/.test(t)) {
        const pkg = ourPackageId && t.startsWith(ourPackageId) ? ourPackageId : (extractedPkg ?? undefined);
        return { kind: 'key', label: 'AccessKey', rebateable: !!(ourPackageId && t.startsWith(ourPackageId)), packageId: pkg ?? undefined };
    }
    if (/::[^:]+::Ticket\b/.test(t)) {
        const pkg = ourPackageId && t.startsWith(ourPackageId) ? ourPackageId : (extractedPkg ?? undefined);
        const isOurs = !!(ourPackageId && t.startsWith(ourPackageId));
        let label = 'Ticket';
        if (/::eintrittskarte::Ticket\b/.test(t)) label = 'Ticket (Eintrittskarte)';
        else if (!isOurs) label = 'Ticket (andere Package)';
        return { kind: 'ticket', label, rebateable: isOurs, packageId: pkg ?? undefined };
    }
    if (/::messaging::PhysicalAsset\b/.test(t)) {
        const pkg = ourPackageId && t.startsWith(ourPackageId) ? ourPackageId : (extractedPkg ?? undefined);
        return { kind: 'asset', label: 'PhysicalAsset', rebateable: !!(ourPackageId && t.startsWith(ourPackageId)), packageId: pkg ?? undefined };
    }
    if (/kiosk/i.test(t)) return { kind: 'kiosk', label: 'Kiosk', rebateable: false };
    const short = t.length > 48 ? t.slice(0, 24) + '…' + t.slice(-16) : t;
    return { kind: 'other', label: short, rebateable: false, packageId: extractedPkg ?? undefined };
}

/** Alle Objekte einer Adresse auflisten (ohne Package-Filter), mit Typ-Klassifikation für Übersicht und Rebate. */
export async function getAllOwnedObjects(
    client: IotaClient,
    ownerAddress: string,
    ourPackageId: string | null,
    maxItems: number = 2000
): Promise<OwnedObjectSummary[]> {
    if (!ownerAddress) return [];
    const out: OwnedObjectSummary[] = [];
    let cursor: string | null = null;
    const limit = 50;
    try {
        for (;;) {
            const res = await client.getOwnedObjects({
                owner: ownerAddress,
                filter: undefined,
                options: { showContent: true, showType: true, showStorageRebate: true },
                cursor: cursor ?? undefined,
                limit,
            } as Parameters<IotaClient['getOwnedObjects']>[0]);
            type Item = { data?: { objectId?: string; type?: string; storageRebate?: string }; error?: unknown; reference?: { objectId?: string } };
            const data = getOwnedObjectsDataArray(res) as Item[];
            for (const item of data) {
                if (item?.error) continue;
                const d = item?.data;
                const objectId = (d?.objectId ?? (item as { reference?: { objectId?: string } })?.reference?.objectId ?? '').trim();
                if (!objectId) continue;
                const typeStr = getTypeFromOwnedObjectItem(item);
                const classified = classifyOwnedObjectType(typeStr || undefined, ourPackageId);
                out.push({
                    objectId,
                    type: typeStr || '',
                    kind: classified.kind,
                    label: classified.label,
                    rebateable: classified.rebateable,
                    packageId: classified.packageId,
                    storageRebate: d?.storageRebate ?? undefined,
                });
                if (out.length >= maxItems) return out;
            }
            const hasNext = (res as { hasNextPage?: boolean }).hasNextPage;
            const next = (res as { nextCursor?: string | null }).nextCursor;
            if (!hasNext || !next) break;
            cursor = next;
        }
    } catch {
        // ignore
    }
    return out;
}

/** Ermittelt alle Package-IDs, die in Objekten einer Adresse vorkommen (für Rebate/Historie: alte Packages sichtbar machen). */
export async function getPackageIdsForOwner(
    client: IotaClient,
    ownerAddress: string,
    maxItems: number = 500
): Promise<string[]> {
    if (!ownerAddress || !/^0x[a-fA-F0-9]{64}$/.test(ownerAddress)) return [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    const limit = 50;
    try {
        for (;;) {
            const res = await client.getOwnedObjects({
                owner: ownerAddress,
                filter: undefined,
                options: { showType: true, showContent: false },
                cursor: cursor ?? undefined,
                limit,
            } as Parameters<IotaClient['getOwnedObjects']>[0]);
            const data = getOwnedObjectsDataArray(res);
            for (const item of data) {
                if ((item as { error?: unknown })?.error) continue;
                const typeStr = getTypeFromOwnedObjectItem(item);
                const pkg = extractPackageIdFromType(typeStr);
                if (pkg) seen.add(pkg);
                if (seen.size >= maxItems) return [...seen];
            }
            const resAny = res as { hasNextPage?: boolean; nextCursor?: string | null };
            const hasNext = resAny?.hasNextPage ?? (res as { result?: { hasNextPage?: boolean } })?.result?.hasNextPage;
            const next = resAny?.nextCursor ?? (res as { result?: { nextCursor?: string | null } })?.result?.nextCursor;
            if (!hasNext || !next) break;
            cursor = next;
        }
    } catch (e) {
        console.warn('[getPackageIdsForOwner] Fehler (Chain/RPC):', String((e as Error)?.message ?? e));
    }
    return [...seen];
}

/** Package-IDs aus dem Ergebnis von getAllOwnedObjects extrahieren (Fallback, wenn getPackageIdsForOwner leer bleibt). */
export function extractPackageIdsFromOwnedObjects(objects: OwnedObjectSummary[]): string[] {
    const seen = new Set<string>();
    for (const o of objects) {
        const pkg = o.packageId || extractPackageIdFromType(o.type);
        if (pkg && PACKAGE_ID_FULL_REGEX.test(pkg)) seen.add(pkg);
    }
    return [...seen];
}

export type OwnedObjectsDebugItem = {
    objectId?: string;
    topLevelKeys: string[];
    typeFromData?: string;
    typeFromTop?: string;
    typeFromContent?: string;
    typeFromValue?: string;
    resolvedType?: string;
    extractedPackageId?: string | null;
    hasError?: boolean;
};

/** Rohdaten-Debug für getOwnedObjects: zeigt Struktur und Typ-Felder pro Objekt (damit discovered-Parsing angepasst werden kann). */
export async function getOwnedObjectsDebug(
    client: IotaClient,
    ownerAddress: string,
    maxItems: number = 50
): Promise<{ totalFetched: number; items: OwnedObjectsDebugItem[]; error?: string }> {
    const out: OwnedObjectsDebugItem[] = [];
    if (!ownerAddress || !/^0x[a-fA-F0-9]{64}$/.test(ownerAddress)) {
        return { totalFetched: 0, items: [], error: 'Ungültige ownerAddress' };
    }
    try {
        const res = await client.getOwnedObjects({
            owner: ownerAddress,
            filter: undefined,
            options: { showType: true, showContent: false },
            cursor: undefined,
            limit: Math.min(maxItems, 100),
        } as Parameters<IotaClient['getOwnedObjects']>[0]);
        const data = getOwnedObjectsDataArray(res);
        for (const item of data) {
            const topLevelKeys = typeof item === 'object' && item !== null ? Object.keys(item as object) : [];
            const d = (item as { data?: Record<string, unknown> })?.data;
            const content = d?.content as Record<string, unknown> | undefined;
            const value = d?.value as Record<string, unknown> | undefined;
            const resolvedType = getTypeFromOwnedObjectItem(item);
            const rawObjectId = d?.objectId ?? (item as { reference?: { objectId?: string } })?.reference?.objectId;
            const objectId =
                typeof rawObjectId === 'string' ? rawObjectId.trim() || undefined : undefined;
            out.push({
                objectId,
                topLevelKeys,
                typeFromData: typeof d?.type === 'string' ? (d.type as string) : undefined,
                typeFromTop: typeof (item as { type?: string }).type === 'string' ? (item as { type?: string }).type : undefined,
                typeFromContent: typeof content?.type === 'string' ? (content.type as string) : undefined,
                typeFromValue: typeof value?.type === 'string' ? (value.type as string) : undefined,
                resolvedType: resolvedType || undefined,
                extractedPackageId: resolvedType ? extractPackageIdFromType(resolvedType) : null,
                hasError: !!(item as { error?: unknown })?.error,
            });
        }
        return { totalFetched: out.length, items: out };
    } catch (e) {
        return { totalFetched: 0, items: [], error: String(e instanceof Error ? e.message : e) };
    }
}

/** Max. Größe des verschlüsselten Vault-Payloads (On-Chain-Objekt-Limit ~250 KB; Reserve für Objekt-Overhead). */
export const VAULT_PAYLOAD_MAX_BYTES = 200_000;

function assertVaultPayloadSize(payload: Uint8Array): void {
    if (payload.length > VAULT_PAYLOAD_MAX_BYTES) {
        throw new Error(
            `Vault-Payload zu groß (${payload.length} > ${VAULT_PAYLOAD_MAX_BYTES} Byte). ` +
            'On-Chain-Objekt-Limit einhalten oder Daten aufteilen (Chaining).'
        );
    }
}

/** On-Chain-Vault erstellen. Bei bestehendem Vault: altes Objekt wird ersetzt (Rebate an Sender).
 * Signatur auf Chain: create_vault(registry, owner: address, encrypted_data, auto_purge_after_days). */
export async function createVaultOnChain(
    encryptedPayload: Uint8Array,
    ttlDays: bigint,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!CFG.VAULT_REGISTRY_ID) throw new Error('VAULT_REGISTRY_ID nicht gesetzt.');
    assertSafeAddress(signingAddress);
    assertVaultPayloadSize(encryptedPayload);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::create_vault`,
        arguments: [
            txb.object(CFG.VAULT_REGISTRY_ID),
            txb.pure.address(signingAddress),
            txb.pure.vector('u8', Array.from(encryptedPayload)),
            txb.pure.u64(ttlDays),
        ],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/** On-Chain-Vault aktualisieren (Objekt bleibt, nur encrypted_data wird ersetzt → kein Rebate-Verlust). Vault muss existieren.
 * Signatur auf Chain: update_vault(registry, owner: address, encrypted_data, auto_purge_after_days). */
export async function updateVaultOnChain(
    encryptedPayload: Uint8Array,
    ttlDays: bigint,
    signingAddress: string,
    walletPassword?: string,
    signOptions?: SignAndExecuteOptions
): Promise<{ digest?: string; status?: string }> {
    if (!CFG.VAULT_REGISTRY_ID) throw new Error('VAULT_REGISTRY_ID nicht gesetzt.');
    assertSafeAddress(signingAddress);
    assertVaultPayloadSize(encryptedPayload);
    const txb = new Transaction();
    txb.setSender(signingAddress);
    txb.moveCall({
        target: `${CFG.PACKAGE_ID}::messaging::update_vault`,
        arguments: [
            txb.object(CFG.VAULT_REGISTRY_ID),
            txb.pure.address(signingAddress),
            txb.pure.vector('u8', Array.from(encryptedPayload)),
            txb.pure.u64(ttlDays),
        ],
    });
    return signAndExecute(getClient(), txb, signingAddress, walletPassword, signOptions);
}

/** Handshake aus Mailbox lesen (Discovery). Optional `parentMailboxObjectId` (Default: Server-`MAILBOX_ID`). */
export async function getHandshakeFromMailbox(
    recipient: string,
    sender: string,
    parentMailboxObjectId?: string
): Promise<{ sender: string; pubKeyRaw: Uint8Array; nonce: bigint } | null> {
    const parentId = (parentMailboxObjectId || CFG.MAILBOX_ID || '').trim();
    if (!isMessengerMailboxModeActive() || !parentId || !CFG.PACKAGE_ID) return null;
    try {
        const resp = await getClient().getDynamicFieldObject({
            parentObjectId: parentId,
            name: { type: typeName('HsKey'), value: { recipient, sender } },
            options: { showContent: true },
        } as Parameters<IotaClient['getDynamicFieldObject']>[0]);
        const fields = (resp as { data?: { content?: { fields?: Record<string, unknown> } } })?.data?.content?.fields;
        if (!fields?.pub_key) return null;
        return {
            sender,
            pubKeyRaw: new Uint8Array(fields.pub_key as number[]),
            nonce: BigInt((fields.nonce as string) ?? 0),
        };
    } catch {
        return null;
    }
}

export type MailboxHandshakeCandidate = { recipient: string; sender: string; objectId?: string; storageRebate?: string };
export type MailboxMessageCandidate = {
    recipient: string;
    sender: string;
    nonce: string;
    objectId?: string;
    storageRebate?: string;
    /** Dynamic-Field-Typ für Purge-Zielwahl. */
    wireKind?: 'encrypted' | 'plain';
};

/** Dynamic Fields unter einer Mailbox-Object-ID (Shared oder PrivateMailbox). */
export async function getDynamicFieldRebateCandidates(
    parentMailboxObjectId: string,
    myAddress: string
): Promise<{ handshakes: MailboxHandshakeCandidate[]; messages: MailboxMessageCandidate[] }> {
    const out = { handshakes: [] as MailboxHandshakeCandidate[], messages: [] as MailboxMessageCandidate[] };
    const parentId = (parentMailboxObjectId || '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(parentId) || !CFG.PACKAGE_ID || !myAddress) return out;
    const norm = (a: string) => (a || '').trim().toLowerCase();
    const me = norm(myAddress);
    try {
        const allEntries: Array<{ name?: { type?: string; value?: Record<string, unknown> }; objectId?: string }> = [];
        let cursor: string | null = null;
        const maxPages = 20;
        const pageLimit = 500;
        for (let pageNum = 0; pageNum < maxPages; pageNum++) {
            const page = await getClient().getDynamicFields({
                parentId,
                limit: pageLimit,
                ...(cursor ? { cursor } : {}),
            } as Parameters<IotaClient['getDynamicFields']>[0]);
            const chunk = (page as { data?: typeof allEntries })?.data ?? [];
            allEntries.push(...chunk);
            const hasNext = (page as { hasNextPage?: boolean })?.hasNextPage === true;
            const nextCursor = (page as { nextCursor?: string | null })?.nextCursor;
            if (!hasNext || !nextCursor) break;
            cursor = nextCursor;
        }
        const entries = allEntries;
        const hsEntries: { recipient: string; sender: string; objectId: string }[] = [];
        const msgEntries: { recipient: string; sender: string; nonce: string; objectId: string; wireKind: 'encrypted' | 'plain' }[] = [];
        for (const e of entries) {
            const name = e?.name?.value as Record<string, string> | undefined;
            const typeStr = (e?.name?.type as string) ?? '';
            const objId = (e as { objectId?: string }).objectId ?? '';
            if (!objId) continue;
            const recipient = norm(String(name?.recipient ?? ''));
            const sender = norm(String(name?.sender ?? ''));
            const canPurge = me === recipient || me === sender;
            if (!canPurge) continue;
            if (typeStr.includes('HsKey') || typeStr.endsWith('::messaging::HsKey')) {
                hsEntries.push({ recipient: String(name?.recipient ?? ''), sender: String(name?.sender ?? ''), objectId: objId });
            } else if (typeStr.includes('PlainMsgKey') || typeStr.endsWith('::messaging::PlainMsgKey')) {
                const nonce = String(name?.nonce ?? '');
                msgEntries.push({
                    recipient: String(name?.recipient ?? ''),
                    sender: String(name?.sender ?? ''),
                    nonce,
                    objectId: objId,
                    wireKind: 'plain',
                });
            } else if (typeStr.includes('MsgKey') || typeStr.endsWith('::messaging::MsgKey')) {
                const nonce = String(name?.nonce ?? '');
                msgEntries.push({
                    recipient: String(name?.recipient ?? ''),
                    sender: String(name?.sender ?? ''),
                    nonce,
                    objectId: objId,
                    wireKind: 'encrypted',
                });
            }
        }
        const allIds = [...hsEntries.map((h) => h.objectId), ...msgEntries.map((m) => m.objectId)];
        if (allIds.length === 0) return out;
        const rebateById = new Map<string, string>();
        const BATCH = 50;
        for (let off = 0; off < allIds.length; off += BATCH) {
            const slice = allIds.slice(off, off + BATCH);
            const objs = await getClient().multiGetObjects({
                ids: slice,
                options: { showStorageRebate: true },
            } as Parameters<IotaClient['multiGetObjects']>[0]);
            const objList = (objs as unknown[]) ?? [];
            for (let i = 0; i < slice.length; i++) {
                const o = objList[i] as { data?: { storageRebate?: string }; error?: unknown };
                if (o?.error) continue;
                const rb = o?.data?.storageRebate;
                if (rb != null) rebateById.set(slice[i], String(rb));
            }
        }
        for (const h of hsEntries) {
            out.handshakes.push({
                recipient: h.recipient,
                sender: h.sender,
                objectId: h.objectId,
                storageRebate: rebateById.get(h.objectId),
            });
        }
        for (const m of msgEntries) {
            out.messages.push({
                recipient: m.recipient,
                sender: m.sender,
                nonce: m.nonce,
                objectId: m.objectId,
                wireKind: m.wireKind,
                storageRebate: rebateById.get(m.objectId),
            });
        }
    } catch {
        // ignore
    }
    return out;
}

/** Mailbox-Inhalte auflisten, die die angegebene Adresse rebaten kann (Handshakes + Nachrichten). */
export async function getMailboxRebateCandidates(myAddress: string): Promise<{ handshakes: MailboxHandshakeCandidate[]; messages: MailboxMessageCandidate[] }> {
    if (!isMessengerMailboxModeActive() || !CFG.MAILBOX_ID) {
        return { handshakes: [], messages: [] };
    }
    return getDynamicFieldRebateCandidates(CFG.MAILBOX_ID, myAddress);
}

/** M4d: Inhalte einer PrivateMailbox (Dynamic Fields), die der Owner/sender/recipient purgen darf. */
export async function getPrivateMailboxRebateCandidates(
    mailboxObjectId: string,
    myAddress: string
): Promise<{ handshakes: MailboxHandshakeCandidate[]; messages: MailboxMessageCandidate[] }> {
    return getDynamicFieldRebateCandidates(mailboxObjectId, myAddress);
}

const PRIVATE_MB_CLEANUP_MAX_OPS_PER_TX = 20;

export type PrivateMailboxCleanupResult = {
    digest?: string;
    status?: string;
    purgedHandshakes: number;
    purgedMessages: number;
    transactions: number;
};

/** M4d: Alle purgbaren Dynamic Fields in einer PrivateMailbox löschen (eine oder mehrere TX). */
export async function cleanupPrivateMailbox(
    mailboxObjectId: string,
    signingAddress: string,
    walletPassword?: string,
    options?: SignAndExecuteOptions
): Promise<PrivateMailboxCleanupResult> {
    const oid = mailboxObjectId.trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(oid)) throw new Error('Private-Mailbox-Object-ID fehlt (0x + 64 Hex).');
    assertSafeAddress(signingAddress);
    if (!CFG.PACKAGE_ID) throw new Error('PACKAGE_ID fehlt.');
    const { handshakes, messages } = await getPrivateMailboxRebateCandidates(oid, signingAddress);
    const ops: Array<{ kind: 'hs' | 'msg' | 'plain'; recipient: string; sender: string; nonce?: bigint }> = [];
    for (const h of handshakes) {
        ops.push({ kind: 'hs', recipient: h.recipient, sender: h.sender });
    }
    for (const m of messages) {
        const nonceBn = BigInt(m.nonce || '0');
        if (m.wireKind === 'plain') {
            ops.push({ kind: 'plain', recipient: m.recipient, sender: m.sender, nonce: nonceBn });
        } else {
            ops.push({ kind: 'msg', recipient: m.recipient, sender: m.sender, nonce: nonceBn });
        }
    }
    if (!ops.length) {
        return { purgedHandshakes: 0, purgedMessages: 0, transactions: 0, status: 'success' };
    }
    const client = getClient();
    let purgedHandshakes = 0;
    let purgedMessages = 0;
    let transactions = 0;
    let lastDigest: string | undefined;
    let lastStatus: string | undefined;
    for (let off = 0; off < ops.length; off += PRIVATE_MB_CLEANUP_MAX_OPS_PER_TX) {
        const chunk = ops.slice(off, off + PRIVATE_MB_CLEANUP_MAX_OPS_PER_TX);
        const txb = new Transaction();
        txb.setSender(signingAddress);
        for (const op of chunk) {
            if (op.kind === 'hs') {
                txb.moveCall({
                    target: `${CFG.PACKAGE_ID}::messaging::purge_handshake_private`,
                    arguments: [txb.object(oid), txb.pure.address(op.recipient), txb.pure.address(op.sender)],
                });
                purgedHandshakes++;
            } else if (op.kind === 'msg') {
                txb.moveCall({
                    target: `${CFG.PACKAGE_ID}::messaging::purge_message_private`,
                    arguments: [
                        txb.object(oid),
                        txb.pure.address(op.recipient),
                        txb.pure.address(op.sender),
                        txb.pure.u64(op.nonce ?? 0n),
                    ],
                });
                purgedMessages++;
            } else {
                txb.moveCall({
                    target: `${CFG.PACKAGE_ID}::messaging::purge_plaintext_mail_entry_private`,
                    arguments: [
                        txb.object(oid),
                        txb.pure.address(op.recipient),
                        txb.pure.address(op.sender),
                        txb.pure.u64(op.nonce ?? 0n),
                    ],
                });
            }
        }
        try {
            const res = await signAndExecute(client, txb, signingAddress, walletPassword, options);
            transactions++;
            lastDigest = res.digest;
            lastStatus = res.status;
            const check = evaluateChainTxResult(res, 'cleanup_private_mailbox');
            if (!check.ok) throw new Error(check.message);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (/purge_handshake_private|purge_message_private|function not found|Could not resolve/i.test(msg)) {
                throw new Error(
                    'Aufräumen on-chain nicht im Paket — Redeploy mit purge_*_private (M4d). Bis dahin Einträge einzeln purgen.'
                );
            }
            throw e instanceof Error ? e : new Error(msg);
        }
    }
    return {
        digest: lastDigest,
        status: lastStatus,
        purgedHandshakes,
        purgedMessages,
        transactions,
    };
}

/** Ersten eingehenden Handshake in der Mailbox finden (recipient = ich), ohne Partneradresse zu kennen. */
export async function findAnyIncomingMailboxHandshake(
    myAddress: string
): Promise<{ sender: string; pubKeyRaw: Uint8Array; nonce: bigint } | null> {
    if (!isMessengerMailboxModeActive() || !CFG.MAILBOX_ID) return null;
    const me = normalizeAddress(myAddress);
    if (!me.startsWith('0x') || me.length !== 66) return null;
    try {
        const page = await getClient().getDynamicFields({
            parentId: CFG.MAILBOX_ID,
            limit: 250,
        } as Parameters<IotaClient['getDynamicFields']>[0]);
        const entries = (page as { data?: Array<{ name?: { type?: string; value?: Record<string, unknown> } }> })?.data ?? [];
        const senders: string[] = [];
        for (const e of entries) {
            const typeStr = (e.name?.type as string) ?? '';
            const val = e.name?.value as Record<string, string> | undefined;
            if (!typeStr.includes('HsKey') && !typeStr.endsWith('::messaging::HsKey')) continue;
            const rec = normalizeAddress(String(val?.recipient ?? ''));
            const sen = String(val?.sender ?? '').trim();
            if (!sen.startsWith('0x')) continue;
            if (rec === me && normalizeAddress(sen) !== me) senders.push(sen);
        }
        for (const sender of senders) {
            const hs = await getHandshakeFromMailbox(myAddress, sender);
            if (hs) return hs;
        }
    } catch {
        // ignore
    }
    return null;
}

/** Handshake in Events suchen (recipient = myAddress, sender beliebig). */
export async function findPeerHandshake(myAddress: string): Promise<{ pubKeyRaw: Uint8Array; sender: string; nonce: bigint } | null> {
    if (!CFG.PACKAGE_ID) return null;
    const me = normalizeAddress(myAddress);
    try {
        const events = await queryMessagingEvents({ eventStruct: 'EcdhInit', limit: 100, order: 'descending' });
        const rows = events.data as Array<{
            type?: string;
            parsedJson?: { recipient?: string; sender?: string; pub_key?: unknown; pubKey?: unknown; nonce?: number | string };
        }>;
        const match = rows.find((e) => {
            if (!e.type?.endsWith('::messaging::EcdhInit') || !e.parsedJson) return false;
            const rec = normalizeAddress(String(e.parsedJson.recipient ?? ''));
            const sen = normalizeAddress(String(e.parsedJson.sender ?? ''));
            return rec === me && sen !== '' && sen !== me;
        });
        if (match?.parsedJson) {
            const d = match.parsedJson;
            const pubKeyRaw = coerceParsedJsonByteVector(d.pub_key ?? d.pubKey);
            if (!pubKeyRaw?.length) return null;
            const senderRaw = String(d.sender ?? '').trim();
            if (!senderRaw.startsWith('0x')) return null;
            return { pubKeyRaw, sender: senderRaw, nonce: BigInt(d.nonce ?? 0) };
        }
    } catch {
        // ignore
    }
    return null;
}

export type IncomingHandshakeOffer = {
    sender: string
    nonce: string
    source: 'mailbox' | 'event'
}

export type OutgoingHandshakeOffer = {
    recipient: string
    nonce: string
    source: 'mailbox' | 'event'
}

async function collectIncomingHsSenderNormsFromMailbox(parentId: string, me: string): Promise<Set<string>> {
    const incomingSenders = new Set<string>()
    let cursor: string | null = null
    for (let pageNum = 0; pageNum < 8; pageNum++) {
        const page = await getClient().getDynamicFields({
            parentId,
            limit: 500,
            ...(cursor ? { cursor } : {}),
        } as Parameters<IotaClient['getDynamicFields']>[0])
        const entries =
            (page as { data?: Array<{ name?: { type?: string; value?: Record<string, string> } }> })?.data ?? []
        for (const e of entries) {
            const typeStr = (e.name?.type as string) ?? ''
            if (!typeStr.includes('HsKey') && !typeStr.endsWith('::messaging::HsKey')) continue
            const val = e.name?.value
            const rec = normalizeAddress(String(val?.recipient ?? ''))
            const sen = String(val?.sender ?? '').trim()
            if (rec !== me || !sen.startsWith('0x')) continue
            incomingSenders.add(normalizeAddress(sen))
        }
        const hasNext = (page as { hasNextPage?: boolean })?.hasNextPage === true
        const nextCursor = (page as { nextCursor?: string | null })?.nextCursor
        if (!hasNext || !nextCursor) break
        cursor = nextCursor
    }
    return incomingSenders
}

async function collectOutgoingHsRecipientNormsFromMailbox(parentId: string, me: string): Promise<Set<string>> {
    const outgoingRecipients = new Set<string>()
    let cursor: string | null = null
    for (let pageNum = 0; pageNum < 8; pageNum++) {
        const page = await getClient().getDynamicFields({
            parentId,
            limit: 500,
            ...(cursor ? { cursor } : {}),
        } as Parameters<IotaClient['getDynamicFields']>[0])
        const entries =
            (page as { data?: Array<{ name?: { type?: string; value?: Record<string, string> } }> })?.data ?? []
        for (const e of entries) {
            const typeStr = (e.name?.type as string) ?? ''
            if (!typeStr.includes('HsKey') && !typeStr.endsWith('::messaging::HsKey')) continue
            const val = e.name?.value
            const rec = String(val?.recipient ?? '').trim()
            const sen = normalizeAddress(String(val?.sender ?? ''))
            if (sen !== me || !rec.startsWith('0x')) continue
            outgoingRecipients.add(normalizeAddress(rec))
        }
        const hasNext = (page as { hasNextPage?: boolean })?.hasNextPage === true
        const nextCursor = (page as { nextCursor?: string | null })?.nextCursor
        if (!hasNext || !nextCursor) break
        cursor = nextCursor
    }
    return outgoingRecipients
}

/** Eingehende Handshake-Angebote (Mailbox HsKey + EcdhInit-Events), pro Absender höchste Nonce. */
export async function listIncomingHandshakeOffers(
    myAddress: string,
    opts?: { limit?: number; extraMailboxIds?: string[] }
): Promise<IncomingHandshakeOffer[]> {
    const limit = Math.min(50, Math.max(1, opts?.limit ?? 20))
    const me = normalizeAddress(myAddress)
    if (!me.startsWith('0x') || me.length !== 66) return []

    const best = new Map<string, { sender: string; nonce: bigint; source: 'mailbox' | 'event' }>()

    const upsert = (senderRaw: string, nonce: bigint, source: 'mailbox' | 'event') => {
        const sen = String(senderRaw || '').trim()
        if (!sen.startsWith('0x')) return
        const sn = normalizeAddress(sen)
        if (sn === me || !/^0x[a-f0-9]{64}$/.test(sn)) return
        const prev = best.get(sn)
        if (!prev || nonce > prev.nonce) {
            best.set(sn, { sender: sen, nonce, source })
        } else if (prev && nonce === prev.nonce && source === 'mailbox') {
            best.set(sn, { sender: sen, nonce, source: 'mailbox' })
        }
    }

    if (isMessengerMailboxModeActive()) {
        const mbSeen = new Set<string>()
        const mailboxIds: string[] = []
        const addMb = (raw: string) => {
            const id = raw.trim()
            const n = id.toLowerCase()
            if (!/^0x[a-fA-F0-9]{64}$/.test(id) || mbSeen.has(n)) return
            mbSeen.add(n)
            mailboxIds.push(id)
        }
        for (const id of getInboxUnionIdsForStatus().mailboxIds) addMb(id)
        for (const id of opts?.extraMailboxIds ?? []) addMb(id)

        for (const parentId of mailboxIds) {
            try {
                const incomingSenders = await collectIncomingHsSenderNormsFromMailbox(parentId, me)
                for (const sn of incomingSenders) {
                    const hs = await getHandshakeFromMailbox(myAddress, sn, parentId)
                    if (hs) upsert(hs.sender, hs.nonce ?? 0n, 'mailbox')
                }
            } catch {
                // ignore
            }
        }
    }

    if (CFG.PACKAGE_ID) {
        try {
            const events = await queryMessagingEvents({ eventStruct: 'EcdhInit', limit: 200, order: 'descending' })
            const rows = events.data as Array<{
                type?: string
                parsedJson?: { recipient?: string; sender?: string; nonce?: number | string }
            }>
            for (const e of rows) {
                if (!e.type?.endsWith('::messaging::EcdhInit') || !e.parsedJson) continue
                const rec = normalizeAddress(String(e.parsedJson.recipient ?? ''))
                const sen = normalizeAddress(String(e.parsedJson.sender ?? ''))
                if (rec !== me || !sen || sen === me) continue
                const nonce = BigInt(e.parsedJson.nonce ?? 0)
                upsert(sen, nonce, 'event')
            }
        } catch {
            // ignore
        }
    }

    return [...best.values()]
        .sort((a, b) => (a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0))
        .slice(0, limit)
        .map((o) => ({ sender: o.sender, nonce: String(o.nonce), source: o.source }))
}

/** Gesendete Handshake-Angebote (HsKey/EcdhInit mit sender = ich), pro Empfänger höchste Nonce. */
export async function listOutgoingHandshakeOffers(
    myAddress: string,
    opts?: { limit?: number; extraMailboxIds?: string[] }
): Promise<OutgoingHandshakeOffer[]> {
    const limit = Math.min(50, Math.max(1, opts?.limit ?? 20))
    const me = normalizeAddress(myAddress)
    if (!me.startsWith('0x') || me.length !== 66) return []

    const best = new Map<string, { recipient: string; nonce: bigint; source: 'mailbox' | 'event' }>()

    const upsert = (recipientRaw: string, nonce: bigint, source: 'mailbox' | 'event') => {
        const recRaw = String(recipientRaw || '').trim()
        if (!recRaw.startsWith('0x')) return
        const rn = normalizeAddress(recRaw)
        if (rn === me || !/^0x[a-f0-9]{64}$/.test(rn)) return
        const prev = best.get(rn)
        if (!prev || nonce > prev.nonce) {
            best.set(rn, { recipient: recRaw, nonce, source })
        } else if (prev && nonce === prev.nonce && source === 'mailbox') {
            best.set(rn, { recipient: recRaw, nonce, source: 'mailbox' })
        }
    }

    if (isMessengerMailboxModeActive()) {
        const mbSeen = new Set<string>()
        const mailboxIds: string[] = []
        const addMb = (raw: string) => {
            const id = raw.trim()
            const n = id.toLowerCase()
            if (!/^0x[a-fA-F0-9]{64}$/.test(id) || mbSeen.has(n)) return
            mbSeen.add(n)
            mailboxIds.push(id)
        }
        for (const id of getInboxUnionIdsForStatus().mailboxIds) addMb(id)
        for (const id of opts?.extraMailboxIds ?? []) addMb(id)

        for (const parentId of mailboxIds) {
            try {
                const outgoingRecipients = await collectOutgoingHsRecipientNormsFromMailbox(parentId, me)
                for (const rn of outgoingRecipients) {
                    const hs = await getHandshakeFromMailbox(rn, myAddress, parentId)
                    if (hs) upsert(rn, hs.nonce ?? 0n, 'mailbox')
                }
            } catch {
                // ignore
            }
        }
    }

    if (CFG.PACKAGE_ID) {
        try {
            const events = await queryMessagingEvents({ eventStruct: 'EcdhInit', limit: 200, order: 'descending' })
            const rows = events.data as Array<{
                type?: string
                parsedJson?: { recipient?: string; sender?: string; nonce?: number | string }
            }>
            for (const e of rows) {
                if (!e.type?.endsWith('::messaging::EcdhInit') || !e.parsedJson) continue
                const rec = normalizeAddress(String(e.parsedJson.recipient ?? ''))
                const sen = normalizeAddress(String(e.parsedJson.sender ?? ''))
                if (sen !== me || !rec || rec === me) continue
                const nonce = BigInt(e.parsedJson.nonce ?? 0)
                upsert(rec, nonce, 'event')
            }
        } catch {
            // ignore
        }
    }

    return [...best.values()]
        .sort((a, b) => (a.nonce > b.nonce ? -1 : a.nonce < b.nonce ? 1 : 0))
        .slice(0, limit)
        .map((o) => ({ recipient: o.recipient, nonce: String(o.nonce), source: o.source }))
}

/** Handshake von bestimmtem Peer suchen (recipient = myAddress, sender = peerAddress). */
export async function findPeerHandshakeFrom(myAddress: string, peerAddress: string): Promise<{ pubKeyRaw: Uint8Array; sender: string; nonce: bigint } | null> {
    if (!CFG.PACKAGE_ID) return null;
    const me = normalizeAddress(myAddress);
    const peer = normalizeAddress(peerAddress);
    try {
        const events = await queryMessagingEvents({ eventStruct: 'EcdhInit', limit: 100, order: 'descending' });
        const rows = events.data as Array<{
            type?: string;
            parsedJson?: { recipient?: string; sender?: string; pub_key?: unknown; pubKey?: unknown; nonce?: number | string };
        }>;
        const match = rows.find((e) => {
            if (!e.type?.endsWith('::messaging::EcdhInit') || !e.parsedJson) return false;
            const rec = normalizeAddress(String(e.parsedJson.recipient ?? ''));
            const sen = normalizeAddress(String(e.parsedJson.sender ?? ''));
            return rec === me && sen === peer;
        });
        if (match?.parsedJson) {
            const d = match.parsedJson;
            const pubKeyRaw = coerceParsedJsonByteVector(d.pub_key ?? d.pubKey);
            if (!pubKeyRaw?.length) return null;
            const senderRaw = String(d.sender ?? '').trim();
            if (!senderRaw.startsWith('0x')) return null;
            return { pubKeyRaw, sender: senderRaw, nonce: BigInt(d.nonce ?? 0) };
        }
    } catch {
        // ignore
    }
    return null;
}

/** 1 IOTA = 10^9 MIST (IOTA Rebased, 9 Dezimalstellen). Beträge on-chain sind in MIST. */
const IOTA_TO_MIST = 1_000_000_000;

/** Anzeige: Komma 2 Stellen nach rechts (Faktor 100), damit 0,01 als 1 angezeigt wird. */
const DISPLAY_IOTA_FACTOR = 100;

/** MIST-Betrag für Anzeige in IOTA umrechnen (Komma 2 Stellen nach rechts). */
export function mistToDisplayIota(amountMist: string | bigint): string {
    const n = typeof amountMist === 'string' ? Number(amountMist) : Number(amountMist);
    if (!Number.isFinite(n) || n < 0) return '0';
    const iota = (n / Number(IOTA_TO_MIST)) * DISPLAY_IOTA_FACTOR;
    if (iota === 0) return '0';
    if (iota >= 1000) return String(Math.round(iota));
    if (iota >= 1) return iota.toFixed(2);
    if (iota >= 0.01) return iota.toFixed(4);
    return iota.toFixed(6);
}

/**
 * Eingehende Zahlungen an recipientAddress ermitteln (TXs, bei denen recipient als Empfänger Balance-Zuwachs hat).
 * Für Zahlungs-Trigger: Lock prüft periodisch, ob jemand IOTA an die Lock-Adresse gesendet hat.
 * @param client IOTA-Client
 * @param recipientAddress Adresse des Empfängers (z. B. LOCK_ID)
 * @param limit Max. Anzahl TXs pro Abfrage (Default 20)
 * @returns Liste { digest, amountMist } – amountMist ist Summe aller positiven Balance-Changes für recipient (native Coin).
 */
export async function queryIncomingPayments(
    client: IotaClient,
    recipientAddress: string,
    limit = 20
): Promise<Array<{ digest: string; amountMist: string; memo?: string }>> {
    assertSafeAddress(recipientAddress);
    const recipientNorm = recipientAddress.trim().toLowerCase();
    const out: Array<{ digest: string; amountMist: string; memo?: string }> = [];
    try {
        const res = await client.queryTransactionBlocks({
            filter: { ToAddress: recipientAddress },
            options: { showBalanceChanges: true, showInput: true },
            limit,
            order: 'descending',
        });
        const list = (res as { data?: Array<{ digest?: string; balanceChanges?: Array<{ amount?: string; owner?: { AddressOwner?: string } }>; transaction?: { data?: { message?: { data?: unknown } } } }> }).data ?? [];
        for (const tx of list) {
            const digest = tx.digest;
            if (!digest) continue;
            const changes = tx.balanceChanges ?? [];
            let sum = BigInt(0);
            for (const c of changes) {
                const owner = c.owner as { AddressOwner?: string } | undefined;
                const addr = owner?.AddressOwner?.trim().toLowerCase();
                if (addr !== recipientNorm) continue;
                const amt = c.amount;
                if (amt == null || amt === '') continue;
                const n = BigInt(amt);
                if (n > 0n) sum += n;
            }
            let memo: string | undefined;
            try {
                const txData = tx as { transaction?: { data?: { message?: { data?: string } } } };
                memo = txData?.transaction?.data?.message?.data;
            } catch {
                // Memo nicht verfügbar (API-Struktur variiert)
            }
            if (sum > 0n) out.push({ digest, amountMist: String(sum), memo });
        }
    } catch {
        // ignore
    }
    return out;
}

/** Konvertiert Mindestbetrag in IOTA (z. B. "0.001", "1.000") in MIST. Leer = 0. */
export function minIotaToMist(minIotaStr: string): bigint {
    const s = minIotaStr?.trim();
    if (!s) return 0n;
    const normalized = normalizeAmountStr(s);
    const num = parseFloat(normalized);
    if (!Number.isFinite(num) || num < 0) return 0n;
    return BigInt(Math.round(num * IOTA_TO_MIST));
}

/**
 * Normalisiert Zahlen-String (DE: 1.000 = 1000, 1,5 = 1.5; EN: 1,000 = 1000, 1.5 = 1.5).
 * Entfernt Tausendertrennzeichen nur bei Zahlen ≥ 1 (z. B. 1.000), nie bei 0.xxx (Dezimalbruch).
 */
function normalizeAmountStr(s: string): string {
    const t = s.trim();
    if (!t) return '';
    if (t.includes(',')) {
        const [intPart, fracPart] = t.split(',');
        return (intPart?.replace(/\./g, '') ?? '') + '.' + (fracPart?.trim() || '0');
    }
    if (/\.\d{3}$/.test(t) && !t.includes(',') && !/^0\./.test(t)) {
        return t.replace(/\./g, '');
    }
    return t;
}

/** IOTA-String (z. B. "0.1", "1.000", "1,5") in MIST (BigInt). */
export function iotaToMist(iotaStr: string): bigint {
    const s = (iotaStr ?? '').trim();
    if (!s) return 0n;
    const normalized = normalizeAmountStr(s);
    const num = parseFloat(normalized);
    if (!Number.isFinite(num) || num < 0) return 0n;
    return BigInt(Math.round(num * Number(IOTA_TO_MIST)));
}

/**
 * Native Coins (IOTA/MIST) an eine Adresse senden.
 * Verwendet splitCoins vom Gas-Coin und transferObjects.
 */
/** IOTA-Saldo einer Adresse in MIST (BigInt). Nutzt getBalance für 0x2::iota::IOTA. */
export async function getBalanceInMist(owner: string): Promise<bigint> {
    assertSafeAddress(owner);
    const client = getClient();
    const balance = await client.getBalance({ owner });
    return BigInt((balance as { totalBalance: string }).totalBalance || '0');
}

/** Saldo auf explizitem RPC (z. B. Mainnet-Balance während Testnet aktiv). */
export async function getBalanceInMistForRpc(owner: string, rpcUrl: string): Promise<bigint> {
    assertSafeAddress(owner);
    const url = (rpcUrl || '').trim();
    if (!url) throw new Error('RPC-URL fehlt.');
    const client = new IotaClient({
        transport: new IotaHTTPTransport({ url, fetch: createRpcFetch() }),
    });
    const balance = await client.getBalance({ owner });
    return BigInt((balance as { totalBalance: string }).totalBalance || '0');
}

/**
 * Aktuellen Referenz-Gas-Preis von der Chain abfragen (NANOS pro Computation-Unit).
 * Wird für Echtzeit-Veto benötigt: Rebate vs. Gas-Kosten.
 */
export async function getReferenceGasPrice(): Promise<bigint> {
    const client = getClient();
    const price = await (client as any).getReferenceGasPrice();
    return BigInt(String(price ?? '1000'));
}

/**
 * Native Coins (IOTA/MIST) an eine Adresse senden.
 * Verwendet splitCoins vom Gas-Coin und transferObjects.
 */
export async function transferCoins(
    recipient: string,
    amountMist: bigint,
    signingAddress: string,
    walletPassword?: string
): Promise<{ digest?: string; status?: string }> {
    assertSafeAddress(recipient);
    assertSafeAddress(signingAddress);
    if (amountMist <= 0n) throw new Error('Betrag muss größer als 0 sein.');
    const client = getClient();
    const txb = new Transaction();
    txb.setSender(signingAddress);
    const coin = txb.splitCoins(txb.gas, [amountMist]);
    txb.transferObjects([coin], recipient);
    return signAndExecute(client, txb, signingAddress, walletPassword);
}
