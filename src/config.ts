import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'node:crypto';
import { normalizeAddress } from './utils.js';
import type { InitialProfile } from './initial-profile-provision.js';
dotenv.config();

const ADDR_64_HEX = /^0x[a-fA-F0-9]{64}$/;

/** JSON in .env: welche Chain-Adresse welche Hierarchie-Rolle hat (Boss-Steuerung, nicht Move). */
export function parseDeviceRolesFromEnv(raw?: string): Record<string, string> {
    try {
        if (!raw?.trim()) return {};
        const j = JSON.parse(raw) as Record<string, unknown>;
        const allowed = new Set(['arbeiter', 'kommandant', 'boss', 'lock', 'monitor', 'messenger', 'waerter']);
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(j)) {
            const key = String(k).trim();
            if (!ADDR_64_HEX.test(key)) continue;
            const r = String(v).trim().toLowerCase();
            if (allowed.has(r)) out[key] = r;
        }
        return out;
    } catch {
        return {};
    }
}

const PACKAGE_ID_FILE = process.env.PACKAGE_ID_FILE || '.morgendrot-package-id';
const PACKAGE_ID_HISTORY_FILE = process.env.PACKAGE_ID_HISTORY_FILE || '.morgendrot-package-id-history';
const PACKAGE_ID_HINTS_FILE = process.env.PACKAGE_ID_HINTS_FILE || '.morgendrot-package-hints.json';
const STREAMS_ANCHOR_HISTORY_FILE = process.env.STREAMS_ANCHOR_HISTORY_FILE || '.morgendrot-streams-anchor-history';
const PARTNER_ADDRESS_FILE = process.env.PARTNER_ADDRESS_FILE || '.morgendrot-partner';
const MAX_PACKAGE_ID_HISTORY = 20;
const MAX_STREAMS_ANCHOR_HISTORY = 20;
const PACKAGE_ID_REGEX = /^0x[a-fA-F0-9]{64}$/;
/** Anchor-IDs sind oft 0x + 64 Hex (wie Adressen) oder andere von der Bridge zurückgegebene IDs. */
const ANCHOR_ID_REGEX = /^0x[a-fA-F0-9]{64}$|^[a-fA-F0-9]{64}$|^[a-zA-Z0-9_-]{20,}$/;

/** Doppelte Kanäle vermeiden: gleiche ID in anderer Schreibweise (Groß/Klein) nur einmal. Erste Schreibweise gewinnt. */
export function dedupeStreamAnchorIds(ids: string[]): string[] {
    const map = new Map<string, string>();
    for (const raw of ids) {
        const id = (raw || '').trim();
        if (!id) continue;
        const k = id.toLowerCase();
        if (!map.has(k)) map.set(k, id);
    }
    return [...map.values()];
}

function readPackageIdFromFile(): string {
    try {
        const p = path.resolve(process.cwd(), PACKAGE_ID_FILE);
        if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').trim();
    } catch {}
    return '';
}

/** Liest die Liste früherer Package-IDs (eine pro Zeile). Für /fetch mit alter ID – keine Geheimnisse, nur öffentliche On-Chain-IDs. */
export function readPackageIdHistory(): string[] {
    try {
        const p = path.resolve(process.cwd(), PACKAGE_ID_HISTORY_FILE);
        if (!fs.existsSync(p)) return [];
        const lines = fs.readFileSync(p, 'utf-8').split(/\r?\n/).map((s) => s.trim()).filter((s) => PACKAGE_ID_REGEX.test(s));
        return [...new Set(lines)].slice(-MAX_PACKAGE_ID_HISTORY);
    } catch {}
    return [];
}

/** Hängt eine ID an die Verlauf-Datei an (z. B. die bisher aktuelle vor dem Wechsel). Duplikate und aktuelle werden nicht doppelt eingetragen. */
function appendPackageIdToHistory(id: string): void {
    if (!id || !id.trim() || !PACKAGE_ID_REGEX.test(id.trim())) return;
    const current = readPackageIdFromFile();
    if (normalizeId(id) === normalizeId(current)) return;
    try {
        const p = path.resolve(process.cwd(), PACKAGE_ID_HISTORY_FILE);
        const existing = readPackageIdHistory();
        const normalizedNew = normalizeId(id);
        if (existing.some((e) => normalizeId(e) === normalizedNew)) return;
        const lines = [...existing, id.trim()].slice(-MAX_PACKAGE_ID_HISTORY);
        fs.writeFileSync(p, lines.join('\n') + '\n', 'utf-8');
    } catch {}
}

/** Nimmt eine genutzte Package-ID in die Verlauf-Datei auf (z. B. wenn /fetch mit anderer Package-ID aufgerufen wird). So erscheinen alle genutzten IDs in der Liste für Nachrichten/Rebate. */
export function ensurePackageIdInHistory(id: string): void {
    appendPackageIdToHistory(id);
}
function normalizeId(id: string): string {
    return (id || '').trim().toLowerCase();
}

/** Optionale Hinweise pro Package-ID (z. B. Adresse, mit wem geschrieben, wofür). Keine Geheimnisse. */
export type PackageIdHint = { label?: string; peer?: string; note?: string };

export function readPackageIdHints(): Record<string, PackageIdHint> {
    try {
        const p = path.resolve(process.cwd(), PACKAGE_ID_HINTS_FILE);
        if (!fs.existsSync(p)) return {};
        const raw = fs.readFileSync(p, 'utf-8').trim();
        if (!raw) return {};
        const data = JSON.parse(raw) as Record<string, { label?: string; peer?: string; note?: string }>;
        const out: Record<string, PackageIdHint> = {};
        for (const [k, v] of Object.entries(data)) {
            if (PACKAGE_ID_REGEX.test(k) && v && typeof v === 'object') {
                out[k.toLowerCase()] = { label: String(v.label ?? '').trim() || undefined, peer: String(v.peer ?? '').trim() || undefined, note: String(v.note ?? '').trim() || undefined };
            }
        }
        return out;
    } catch {}
    return {};
}

export function savePackageIdHint(packageId: string, hint: PackageIdHint): void {
    const id = (packageId || '').trim().toLowerCase();
    if (!id || !PACKAGE_ID_REGEX.test(id)) return;
    try {
        const p = path.resolve(process.cwd(), PACKAGE_ID_HINTS_FILE);
        const existing = readPackageIdHints();
        const next = { ...(existing[id] || {}), ...hint };
        if (!next.label && !next.peer && !next.note) {
            delete existing[id];
        } else {
            existing[id] = next;
        }
        fs.writeFileSync(p, JSON.stringify(existing, null, 2), 'utf-8');
    } catch {}
}

function readPartnerFromFile(): string {
    try {
        const p = path.resolve(process.cwd(), PARTNER_ADDRESS_FILE);
        if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').trim();
    } catch {}
    return '';
}

/** Speichert Package-ID in .morgendrot-package-id (wird beim nächsten Start automatisch geladen). Die bisherige ID wird in den Verlauf geschrieben. */
export function savePackageIdToFile(id: string): void {
    if (!id || !id.trim()) return;
    try {
        const p = path.resolve(process.cwd(), PACKAGE_ID_FILE);
        const previous = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8').trim() : '';
        if (previous && PACKAGE_ID_REGEX.test(previous) && normalizeId(previous) !== normalizeId(id)) {
            appendPackageIdToHistory(previous);
        }
        fs.writeFileSync(p, id.trim(), 'utf-8');
    } catch {}
}

/** Speichert Partner-Adresse in .morgendrot-partner (wird beim nächsten Start geladen, wenn PARTNER_ADDRESS in .env leer). Nach /connect oder Handshake an Adresse wird der Partner so automatisch gespeichert. */
export function savePartnerToFile(address: string): void {
    if (!address || !address.trim() || !address.startsWith('0x')) return;
    try {
        fs.writeFileSync(path.resolve(process.cwd(), PARTNER_ADDRESS_FILE), address.trim(), 'utf-8');
    } catch {}
}

/** Liest die Liste bekannter Streams-Anchor-IDs (für Kanal-Wechsel). */
export function readStreamsAnchorIdHistory(): string[] {
    try {
        const p = path.resolve(process.cwd(), STREAMS_ANCHOR_HISTORY_FILE);
        if (!fs.existsSync(p)) return [];
        const lines = fs.readFileSync(p, 'utf-8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 0);
        return dedupeStreamAnchorIds(lines).slice(-MAX_STREAMS_ANCHOR_HISTORY);
    } catch {}
    return [];
}

/** Hängt eine Anchor-ID an die Verlauf-Datei an (z. B. vor dem Wechsel auf einen anderen Kanal). */
function appendStreamsAnchorIdToHistory(id: string): void {
    const trimmed = (id || '').trim();
    if (!trimmed || !ANCHOR_ID_REGEX.test(trimmed)) return;
    try {
        const p = path.resolve(process.cwd(), STREAMS_ANCHOR_HISTORY_FILE);
        const existing = readStreamsAnchorIdHistory();
        if (existing.some((e) => e.toLowerCase() === trimmed.toLowerCase())) return;
        const lines = dedupeStreamAnchorIds([...existing, trimmed]).slice(-MAX_STREAMS_ANCHOR_HISTORY);
        fs.writeFileSync(p, lines.join('\n') + '\n', 'utf-8');
    } catch {}
}

/** Nimmt eine benutzte Streams-Anchor-ID in die Verlauf-Datei auf. */
export function ensureStreamsAnchorIdInHistory(id: string): void {
    appendStreamsAnchorIdToHistory(id);
}

/** Sammelt bekannte Streams-Anchors aus vorhandenen Result-/Demo-Dateien. */
export function seedStreamsAnchorHistoryFromKnownFiles(): string[] {
    const candidates = [
        'realworld-echte-tx-result.json',
        'firma-realworld-result.json',
        '.streams-mock-data.json',
        path.join('tmp', 'heartbeat-demo-state.json'),
    ];
    const found = new Set<string>();
    for (const rel of candidates) {
        try {
            const p = path.resolve(process.cwd(), rel);
            if (!fs.existsSync(p)) continue;
            const raw = fs.readFileSync(p, 'utf-8');
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const anchor = String(parsed.anchorId ?? parsed.streamsAnchorId ?? parsed.anchor_id ?? '').trim();
            if (anchor && ANCHOR_ID_REGEX.test(anchor)) found.add(anchor);
            // .streams-mock-data.json: Keys sind Anchor-IDs (Kanal-UUIDs), alle übernehmen
            if (rel === '.streams-mock-data.json' && typeof parsed === 'object') {
                for (const key of Object.keys(parsed)) {
                    if (key && ANCHOR_ID_REGEX.test(key.trim())) found.add(key.trim());
                }
            }
        } catch {
            // ignore malformed demo files
        }
    }
    for (const id of found) appendStreamsAnchorIdToHistory(id);
    return [...found];
}

/** Keys, die NIEMALS per API/UI gesetzt werden dürfen (Code-Ausführung, Secrets, SSRF). Industrie-/Militärstandard. */
const SETENV_BLOCKLIST = new Set([
    'OPEN_COMMAND', 'OPEN_URL', 'OPEN_COMMAND_LIST_FILE', 'OPEN_COMMAND_LIST_KEY',
    'REMOTE_SIGNER_URL', 'REMOTE_SIGNER_TOKEN', 'WALLET_PASSWORD', 'ENCRYPTED_ENV_FILE',
    'MONITOR_ALARM_WEBHOOK_URL', 'BOSS_SIGNER_TOKEN',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
    'SHOP_CLAIM_NOTIFY_SECRET', 'SHOP_MINT_BOSS_WALLET_PASSWORD', 'BOSS_WALLET_PASSWORD',
]);

/** Schreibt KEY=VALUE in .env (überschreibt vorhanden, fügt neu hinzu). Wirkt nach Neustart (bei verschlüsselter Env: .env übersteuert). */
export function setEnvKey(key: string, value: string): { ok: boolean; error?: string; path?: string; value?: string } {
    const k = key.trim();
    if (!k || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
        return { ok: false, error: 'Ungültiger Schlüssel' };
    }
    if (SETENV_BLOCKLIST.has(k)) {
        return { ok: false, error: `Schlüssel ${k} darf aus Sicherheitsgründen nicht per API gesetzt werden. Bitte in .env bearbeiten.` };
    }
    const envPath = path.resolve(process.cwd(), '.env');
    let content = '';
    try {
        if (fs.existsSync(envPath)) content = fs.readFileSync(envPath, 'utf-8');
    } catch (e: any) {
        return { ok: false, error: String(e?.message || e) };
    }
    if (/\r|\n/.test(value)) {
        return { ok: false, error: 'Wert darf keine Zeilenumbrüche enthalten (Sicherheit).' };
    }
    const needQuotes = /[\s#"']|=/.test(value);
    const line = `${k}=${needQuotes ? `"${value.replace(/"/g, '\\"')}"` : value}`;
    // Vor Überschreiben: alte Streams-Anchor-ID in Verlauf, damit Nutzer den Kanal wechseln kann
    if (k === 'STREAMS_ANCHOR_ID' && CFG.STREAMS_ANCHOR_ID && CFG.STREAMS_ANCHOR_ID.trim() !== value.trim()) {
        appendStreamsAnchorIdToHistory(CFG.STREAMS_ANCHOR_ID);
    }
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const keyMatch = new RegExp(`^\\s*${escaped}\\s*=.*$`, 'm');
    if (keyMatch.test(content)) {
        content = content.replace(keyMatch, line);
    } else {
        content = content.trimEnd() + (content ? '\n' : '') + line + '\n';
    }
    try {
        fs.writeFileSync(envPath, content, 'utf-8');
        process.env[k] = value;
        applyEnvToCfg(k, value); // CFG sofort aktualisieren
        return { ok: true, path: envPath, value };
    } catch (e: any) {
        return { ok: false, error: String(e?.message || e) };
    }
}

/**
 * Boss-.env: Gerät (Chain-Adresse) einer Hierarchie-Rolle zuordnen.
 * Aktualisiert DEVICE_ROLES, WORKER_ADDRESSES und KOMMANDANT_ADDRESSES konsistent.
 */
export function assignDeviceRoleInEnv(address: string, roleInput: string): { ok: boolean; error?: string; message?: string } {
    let role = String(roleInput || '').trim().toLowerCase();
    if (role === 'worker') role = 'arbeiter';
    const allowed = new Set(['arbeiter', 'kommandant', 'boss', 'lock', 'monitor', 'messenger', 'waerter']);
    if (!allowed.has(role)) return { ok: false, error: 'Rolle ungültig (arbeiter, kommandant, boss, lock, monitor, messenger, waerter).' };
    const addr = String(address || '').trim();
    if (!ADDR_64_HEX.test(addr)) return { ok: false, error: 'Adresse muss 0x + 64 Hex-Zeichen sein.' };
    const norm = normalizeAddress(addr);
    const keyAddr = addr.trim().toLowerCase();

    let workers = CFG.WORKER_ADDRESSES.filter((w) => normalizeAddress(w) !== norm);
    let komms = CFG.KOMMANDANT_ADDRESSES.filter((w) => normalizeAddress(w) !== norm);
    if (role === 'arbeiter') {
        if (!workers.some((w) => normalizeAddress(w) === norm)) workers.push(keyAddr);
    } else if (role === 'kommandant') {
        if (!komms.some((w) => normalizeAddress(w) === norm)) komms.push(keyAddr);
    }

    const rolesMap: Record<string, string> = { ...CFG.DEVICE_ROLES };
    for (const k of Object.keys(rolesMap)) {
        if (normalizeAddress(k) === norm) delete rolesMap[k];
    }
    rolesMap[keyAddr] = role;

    const compactJson = JSON.stringify(rolesMap);
    const w1 = setEnvKey('WORKER_ADDRESSES', workers.join(','));
    if (!w1.ok) return w1;
    const w2 = setEnvKey('KOMMANDANT_ADDRESSES', komms.join(','));
    if (!w2.ok) return w2;
    const w3 = setEnvKey('DEVICE_ROLES', compactJson);
    if (!w3.ok) return w3;
    return {
        ok: true,
        message: `Gerät ${keyAddr.slice(0, 12)}… als „${role}“ eingetragen (WORKER/KOMMANDANT + DEVICE_ROLES).`,
    };
}

/** Aktualisiert CFG sofort, wenn Env-Key per UI gesetzt wurde (ohne Neustart). */
function applyEnvToCfg(key: string, value: string): void {
    const v = value.trim();
    const truthy = (x: string) => x === 'true' || x === '1' || x === 'yes';
    switch (key) {
        case 'SIGNER':
            if (v === 'sdk' || v === 'cli' || v === 'remote') CFG.SIGNER = v;
            break;
        case 'MY_ADDRESS': CFG.MY_ADDRESS = v; break;
        case 'PARTNER_ADDRESS': CFG.PARTNER_ADDRESS = v; break;
        case 'PARTNER_ADDRESSES': CFG.PARTNER_ADDRESSES = v.split(',').map((s) => s.trim()).filter(Boolean); break;
        case 'RPC_URL': {
            CFG.RPC_URL = v || 'https://api.testnet.iota.cafe';
            void import('./chain-access.js').then((m) => m.resetRpcClient('primary'));
            break;
        }
        case 'RPC_URLS': {
            CFG.RPC_URLS_EXTRA = parseRpcUrlsFromRaw(v);
            void import('./chain-access.js').then((m) => m.resetRpcClient('same'));
            break;
        }
        case 'RPC_HTTP_PROXY': {
            CFG.RPC_HTTP_PROXY = v;
            void import('./chain-access.js').then((m) => m.resetRpcClient('same'));
            break;
        }
        case 'RPC_SOCKS_PROXY': {
            CFG.RPC_SOCKS_PROXY = v;
            void import('./chain-access.js').then((m) => m.resetRpcClient('same'));
            break;
        }
        case 'NETWORK_TRUST_TIER': {
            CFG.NETWORK_TRUST_TIER = Math.min(3, Math.max(1, parseInt(v, 10) || 1));
            break;
        }
        case 'ENABLE_HD_CONTACT_ADDRESSES': CFG.ENABLE_HD_CONTACT_ADDRESSES = truthy(v); break;
        case 'PACKAGE_ID': CFG.PACKAGE_ID = v; break;
        case 'VAULT_REGISTRY_ID': CFG.VAULT_REGISTRY_ID = v; break;
        case 'MAILBOX_ID': CFG.MAILBOX_ID = v; break;
        case 'COMMAND_REGISTRY_ID': CFG.COMMAND_REGISTRY_ID = v; break;
        case 'EVENT_REGISTRY_ID': CFG.EVENT_REGISTRY_ID = v; break;
        case 'VAULT_FILE': CFG.VAULT_FILE = v; break;
        case 'LOCK_ID': CFG.LOCK_ID = v; break;
        case 'ROLE': {
            const lo = v.toLowerCase();
            const ok = ['lock', 'monitor', 'boss', 'kommandant', 'arbeiter', 'messenger', 'waerter'] as const;
            CFG.ROLE = (ok.includes(lo as (typeof ok)[number]) ? lo : 'messenger') as typeof CFG.ROLE;
            break;
        }
        case 'ROLE_ID': (CFG as { ROLE_ID: number }).ROLE_ID = Math.max(0, Math.min(63, parseInt(v, 10) || 0)); break;
        case 'BOSS_ADDRESS': CFG.BOSS_ADDRESS = v; break;
        case 'KOMMANDANT_ADDRESSES': CFG.KOMMANDANT_ADDRESSES = v.split(',').map((s) => s.trim()).filter(Boolean); break;
        case 'WORKER_ADDRESSES': CFG.WORKER_ADDRESSES = v.split(',').map((s) => s.trim()).filter(Boolean); break;
        case 'DEVICE_ROLES': CFG.DEVICE_ROLES = parseDeviceRolesFromEnv(v); break;
        case 'BROADCAST_PINNWAND_ADDRESS': CFG.BROADCAST_PINNWAND_ADDRESS = v; break;
        case 'BROADCAST_AUTHORIZED_SENDERS': CFG.BROADCAST_AUTHORIZED_SENDERS = v.split(',').map((s) => s.trim()).filter(Boolean); break;
        case 'AUTHORIZED_SENDERS': CFG.AUTHORIZED_SENDERS = v.split(',').map((s) => s.trim()).filter(Boolean); break;
        case 'ENABLE_PAIRWISE_GROUPS': (CFG as { ENABLE_PAIRWISE_GROUPS: boolean }).ENABLE_PAIRWISE_GROUPS = truthy(v); break;
        case 'ENABLE_BROADCAST_PINNWAND': (CFG as { ENABLE_BROADCAST_PINNWAND: boolean }).ENABLE_BROADCAST_PINNWAND = truthy(v); break;
        case 'ENABLE_PURGE': (CFG as { ENABLE_PURGE: boolean }).ENABLE_PURGE = truthy(v); break;
        case 'ENABLE_AUTO_EXECUTE': (CFG as { ENABLE_AUTO_EXECUTE: boolean }).ENABLE_AUTO_EXECUTE = truthy(v); break;
        case 'ENABLE_LISTENER': (CFG as { ENABLE_LISTENER: boolean }).ENABLE_LISTENER = truthy(v); break;
        case 'ENABLE_PLAINTEXT_CHANNEL': (CFG as { ENABLE_PLAINTEXT_CHANNEL: boolean }).ENABLE_PLAINTEXT_CHANNEL = truthy(v); break;
        case 'MAILBOX_STORE_PLAINTEXT': (CFG as { MAILBOX_STORE_PLAINTEXT: boolean }).MAILBOX_STORE_PLAINTEXT = truthy(v); break;
        case 'ENABLE_REPLAY_PROTECTION': (CFG as { ENABLE_REPLAY_PROTECTION: boolean }).ENABLE_REPLAY_PROTECTION = truthy(v); break;
        case 'ENABLE_HARDWARE_OPEN': (CFG as { ENABLE_HARDWARE_OPEN: boolean }).ENABLE_HARDWARE_OPEN = truthy(v); break;
        case 'PAYMENT_TRIGGER_ENABLED': (CFG as { PAYMENT_TRIGGER_ENABLED: boolean }).PAYMENT_TRIGGER_ENABLED = truthy(v); break;
        case 'OFFLINE_OPEN_ENABLED': (CFG as { OFFLINE_OPEN_ENABLED: boolean }).OFFLINE_OPEN_ENABLED = truthy(v); break;
        case 'USE_MAILBOX': (CFG as { USE_MAILBOX: boolean }).USE_MAILBOX = truthy(v); break;
        case 'USE_ENCRYPTED_DISCOVERY': (CFG as { USE_ENCRYPTED_DISCOVERY: boolean }).USE_ENCRYPTED_DISCOVERY = truthy(v); break;
        case 'ENABLE_FETCH_COMMAND': (CFG as { ENABLE_FETCH_COMMAND: boolean }).ENABLE_FETCH_COMMAND = truthy(v); break;
        case 'ENABLE_FILE_LOGGING': (CFG as { ENABLE_FILE_LOGGING: boolean }).ENABLE_FILE_LOGGING = truthy(v); break;
        case 'LOG_VERBOSE': (CFG as { LOG_VERBOSE: boolean }).LOG_VERBOSE = truthy(v); break;
        case 'ENABLE_UI': (CFG as { ENABLE_UI: boolean }).ENABLE_UI = truthy(v); break;
        case 'SERVE_LITE_UI_STATIC':
            (CFG as { SERVE_LITE_UI_STATIC: boolean }).SERVE_LITE_UI_STATIC = truthy(v);
            break;
        case 'MESSENGER_EDITION': {
            const lo = v.toLowerCase();
            (CFG as { MESSENGER_EDITION: 'standalone' | 'sales' }).MESSENGER_EDITION =
                lo === 'sales' ? 'sales' : 'standalone';
            if (lo === 'sales') (CFG as { UI_VARIANT: 'full' | 'messenger' }).UI_VARIANT = 'messenger';
            break;
        }
        case 'UI_VARIANT': {
            const lo = v.toLowerCase();
            (CFG as { UI_VARIANT: 'full' | 'messenger' }).UI_VARIANT = lo === 'messenger' ? 'messenger' : 'full';
            break;
        }
        case 'PAIRING_WAIT_TIMEOUT_MS':
            (CFG as { PAIRING_WAIT_TIMEOUT_MS: number }).PAIRING_WAIT_TIMEOUT_MS = Math.max(15_000, parseInt(v, 10) || 120_000);
            break;
        case 'PAIRING_FIND_MAX_CANDIDATES':
            (CFG as { PAIRING_FIND_MAX_CANDIDATES: number }).PAIRING_FIND_MAX_CANDIDATES = Math.max(
                10,
                Math.min(2000, parseInt(v, 10) || 250)
            );
            break;
        case 'PAIRING_FIND_MAX_DECRYPT_ATTEMPTS':
            (CFG as { PAIRING_FIND_MAX_DECRYPT_ATTEMPTS: number }).PAIRING_FIND_MAX_DECRYPT_ATTEMPTS = Math.max(
                5,
                Math.min(500, parseInt(v, 10) || 80)
            );
            break;
        case 'ENABLE_HEARTBEAT': (CFG as { ENABLE_HEARTBEAT: boolean }).ENABLE_HEARTBEAT = truthy(v); break;
        case 'ENABLE_MONITOR': (CFG as { ENABLE_MONITOR: boolean }).ENABLE_MONITOR = truthy(v); break;
        case 'ENABLE_CHAIN_ANCHOR': (CFG as { ENABLE_CHAIN_ANCHOR: boolean }).ENABLE_CHAIN_ANCHOR = truthy(v); break;
        case 'ENABLE_COMMAND_DOWN': (CFG as { ENABLE_COMMAND_DOWN: boolean }).ENABLE_COMMAND_DOWN = truthy(v); break;
        case 'ENABLE_KEY_ISSUE': (CFG as { ENABLE_KEY_ISSUE: boolean }).ENABLE_KEY_ISSUE = truthy(v); break;
        case 'ENABLE_REVOKE_DOWN': (CFG as { ENABLE_REVOKE_DOWN: boolean }).ENABLE_REVOKE_DOWN = truthy(v); break;
        case 'ENABLE_STATUS_READ_DOWN': (CFG as { ENABLE_STATUS_READ_DOWN: boolean }).ENABLE_STATUS_READ_DOWN = truthy(v); break;
        case 'ENABLE_STATUS_READ_UP': (CFG as { ENABLE_STATUS_READ_UP: boolean }).ENABLE_STATUS_READ_UP = truthy(v); break;
        case 'ENABLE_CONFIG_CHANGE': (CFG as { ENABLE_CONFIG_CHANGE: boolean }).ENABLE_CONFIG_CHANGE = truthy(v); break;
        case 'ENABLE_HIERARCHY_CHANGE': (CFG as { ENABLE_HIERARCHY_CHANGE: boolean }).ENABLE_HIERARCHY_CHANGE = truthy(v); break;
        case 'OPEN_STREAMS_ENABLED': (CFG as { OPEN_STREAMS_ENABLED: boolean }).OPEN_STREAMS_ENABLED = truthy(v); break;
        case 'STREAMS_LISTEN_ENABLED': (CFG as { STREAMS_LISTEN_ENABLED: boolean }).STREAMS_LISTEN_ENABLED = truthy(v); break;
        case 'STREAMS_BRIDGE_URL': (CFG as { STREAMS_BRIDGE_URL: string }).STREAMS_BRIDGE_URL = v; break;
        case 'ENABLE_FACTORY_IO': (CFG as { ENABLE_FACTORY_IO: boolean }).ENABLE_FACTORY_IO = truthy(v); break;
        case 'FACTORY_IO_URL': CFG.FACTORY_IO_URL = v; break;
        case 'FACTORY_IO_POLL_MS': {
            const n = parseInt(v, 10);
            CFG.FACTORY_IO_POLL_MS = Number.isFinite(n) ? Math.min(86400000, Math.max(500, n)) : 10000;
            break;
        }
        case 'STREAMS_ANCHOR_ID': (CFG as { STREAMS_ANCHOR_ID: string }).STREAMS_ANCHOR_ID = v; break;
        case 'STREAMS_TOPIC': (CFG as { STREAMS_TOPIC: string }).STREAMS_TOPIC = v; break;
        case 'AUDIT_STREAMS_ENABLED': (CFG as { AUDIT_STREAMS_ENABLED: boolean }).AUDIT_STREAMS_ENABLED = truthy(v); break;
        case 'MONITOR_DEVICES': (CFG as { MONITOR_DEVICES: string[] }).MONITOR_DEVICES = v.split(',').map(s => s.trim()).filter(Boolean); break;
        case 'HEARTBEAT_INTERVAL_MS': (CFG as { HEARTBEAT_INTERVAL_MS: number }).HEARTBEAT_INTERVAL_MS = parseInt(v, 10) || 60000; break;
        case 'DEVICE_NAMES': process.env.DEVICE_NAMES = v; break;
        case 'BOSS_SIGNER_PUBLIC_URL': (CFG as { BOSS_SIGNER_PUBLIC_URL: string }).BOSS_SIGNER_PUBLIC_URL = v; break;
        case 'MESSENGER_AUTO_SPONSOR': (CFG as { MESSENGER_AUTO_SPONSOR: boolean }).MESSENGER_AUTO_SPONSOR = truthy(v); break;
        case 'MESSENGER_LICENSE_NFT_OBJECT_ID':
            (CFG as { MESSENGER_LICENSE_NFT_OBJECT_ID: string | undefined }).MESSENGER_LICENSE_NFT_OBJECT_ID = v || undefined;
            break;
        case 'MESSENGER_CREDITS_OBJECT_ID':
            (CFG as { MESSENGER_CREDITS_OBJECT_ID: string | undefined }).MESSENGER_CREDITS_OBJECT_ID =
                v && PACKAGE_ID_REGEX.test(v) ? normalizeAddress(v) : undefined;
            break;
        case 'PAIRING_GATE_NFT_OBJECT_ID':
            (CFG as { PAIRING_GATE_NFT_OBJECT_ID: string | undefined }).PAIRING_GATE_NFT_OBJECT_ID = v || undefined;
            break;
        case 'VERIFIED_IOTA_NAME_PACKAGE_IDS':
            (CFG as { VERIFIED_IOTA_NAME_PACKAGE_IDS: string[] }).VERIFIED_IOTA_NAME_PACKAGE_IDS =
                parseVerifiedIotaNamePackageIds(v);
            break;
        case 'MESSENGER_GAS_STATE_FILE':
            if (v) process.env.MESSENGER_GAS_STATE_FILE = v;
            else delete process.env.MESSENGER_GAS_STATE_FILE;
            break;
        case 'IOTA_GAS_STATION_URL':
            (CFG as { IOTA_GAS_STATION_URL: string | undefined }).IOTA_GAS_STATION_URL = v || undefined;
            break;
        case 'SHADOW_SWEEP_GAS_RESERVE_MIST': {
            try {
                const n = BigInt(v.trim());
                (CFG as { SHADOW_SWEEP_GAS_RESERVE_MIST: bigint }).SHADOW_SWEEP_GAS_RESERVE_MIST =
                    n > 0n ? n : 55_000_000n;
            } catch {
                (CFG as { SHADOW_SWEEP_GAS_RESERVE_MIST: bigint }).SHADOW_SWEEP_GAS_RESERVE_MIST = 55_000_000n;
            }
            break;
        }
        case 'SPONSORED_TRANSACTION_ENABLED':
            (CFG as { SPONSORED_TRANSACTION_ENABLED: boolean }).SPONSORED_TRANSACTION_ENABLED = truthy(v);
            break;
        case 'SPONSOR_GAS_OWNER':
            (CFG as { SPONSOR_GAS_OWNER: string | undefined }).SPONSOR_GAS_OWNER = v || undefined;
            break;
        case 'SPONSOR_GAS_PASSWORD':
            (CFG as { SPONSOR_GAS_PASSWORD: string | undefined }).SPONSOR_GAS_PASSWORD = v || undefined;
            break;
        case 'GAS_BUDGET': {
            const n = parseInt(v, 10);
            (CFG as { GAS_BUDGET: number }).GAS_BUDGET = Number.isFinite(n) && n > 0 ? n : 10_000_000;
            break;
        }
        default: break;
    }
}

function envBool(key: string, defaultVal: boolean): boolean {
    const v = process.env[key];
    if (v === undefined || v === '') return defaultVal;
    return v === 'true' || v === '1' || v === 'yes';
}

function envInt(key: string, defaultVal: number): number {
    const v = process.env[key];
    if (v === undefined || v === '') return defaultVal;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? defaultVal : n;
}

/** Ganzzahlige TTL (Tage); ungültig/negativ → defaultVal. Verhindert BigInt('30.5')-Fehler. */
function envTTLDays(key: string, defaultVal: bigint): bigint {
    const v = process.env[key];
    if (v === undefined || v === '') return defaultVal;
    const n = parseInt(String(v).trim(), 10);
    return Number.isNaN(n) || n < 0 ? defaultVal : BigInt(n);
}

/** Poll-Intervalle (ms); mindestens 1000, um RPC-Hammering zu vermeiden. */
function envPollMs(key: string, defaultVal: number): number {
    const n = envInt(key, defaultVal);
    return n < 1000 ? 1000 : n;
}

/** Mehrere RPC-URLs (Komma/Leerzeichen); nur http(s). Für CFG.RPC_URLS_EXTRA und setEnvKey. */
export function parseRpcUrlsFromRaw(raw: string | undefined): string[] {
    const r = String(raw ?? '').trim();
    if (!r) return [];
    return [...new Set(r.split(/[\s,]+/).map((s) => s.trim()).filter((u) => /^https?:\/\//i.test(u)))];
}

/** Komma-/Leerzeichen-getrennte 0x+64-Hex Package-IDs: NFT-Typ des IOTA-Names darf nur von diesen Paketen stammen (Partner-Whitelist). */
export function parseVerifiedIotaNamePackageIds(raw: string | undefined): string[] {
    const r = String(raw ?? '').trim();
    if (!r) return [];
    const ids = r
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => /^0x[a-fA-F0-9]{64}$/.test(s))
        .map((s) => s.toLowerCase());
    return [...new Set(ids)];
}

type SignerMode = 'cli' | 'sdk' | 'remote';
type RuntimeConfig = { signer?: SignerMode; walletDerivationPath?: string };

const RUNTIME_CONFIG_PATH = path.resolve(process.cwd(), process.env.RUNTIME_CONFIG_FILE?.trim() || '.morgendrot-runtime-config.json');
const RUNTIME_CONFIG_ALLOWED_SIGNERS: SignerMode[] = ['cli', 'sdk', 'remote'];
let runtimeSignerSource: 'env' | 'runtime' = 'env';
let runtimeWalletDerivationPathSource: 'env' | 'runtime' = 'env';

function parseRuntimeSigner(raw: unknown): SignerMode | undefined {
    const v = String(raw ?? '').trim().toLowerCase();
    if ((RUNTIME_CONFIG_ALLOWED_SIGNERS as string[]).includes(v)) return v as SignerMode;
    return undefined;
}

function readRuntimeConfig(): RuntimeConfig {
    try {
        if (!fs.existsSync(RUNTIME_CONFIG_PATH)) return {};
        const raw = fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as { signer?: unknown; walletDerivationPath?: unknown };
        const signer = parseRuntimeSigner(parsed.signer);
        const walletDerivationPath = String(parsed.walletDerivationPath ?? '').trim();
        const out: RuntimeConfig = {};
        if (signer) out.signer = signer;
        if (walletDerivationPath) out.walletDerivationPath = walletDerivationPath;
        return out;
    } catch {
        return {};
    }
}

function writeRuntimeConfig(cfg: RuntimeConfig): { ok: boolean; error?: string; path?: string } {
    try {
        const payload: RuntimeConfig = {};
        if (cfg.signer) payload.signer = cfg.signer;
        if (cfg.walletDerivationPath) payload.walletDerivationPath = cfg.walletDerivationPath;
        fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
        return { ok: true, path: RUNTIME_CONFIG_PATH };
    } catch (e: any) {
        return { ok: false, error: String(e?.message || e) };
    }
}

function applyRuntimeConfigToCfg(): void {
    const runtime = readRuntimeConfig();
    if (runtime.signer) {
        CFG.SIGNER = runtime.signer;
        runtimeSignerSource = 'runtime';
    } else {
        runtimeSignerSource = 'env';
    }
    if (runtime.walletDerivationPath) {
        CFG.WALLET_DERIVATION_PATH = runtime.walletDerivationPath;
        runtimeWalletDerivationPathSource = 'runtime';
    } else {
        runtimeWalletDerivationPathSource = 'env';
    }
}

export function setRuntimeConfigKey(key: string, value: string): { ok: boolean; error?: string; path?: string; value?: string } {
    const k = String(key || '').trim().toUpperCase();
    const v = String(value ?? '').trim();
    if (k !== 'SIGNER' && k !== 'WALLET_DERIVATION_PATH') {
        return { ok: false, error: `Runtime key ${k || '(leer)'} wird noch nicht unterstützt.` };
    }
    const next = readRuntimeConfig();
    if (k === 'SIGNER') {
        const signer = parseRuntimeSigner(v);
        if (!signer) return { ok: false, error: 'SIGNER muss einer von: cli | sdk | remote sein.' };
        next.signer = signer;
    } else if (v) {
        next.walletDerivationPath = v;
    } else {
        delete next.walletDerivationPath;
    }
    const written = writeRuntimeConfig(next);
    if (!written.ok) return written;
    applyRuntimeConfigToCfg();
    return {
        ok: true,
        path: written.path,
        value: k === 'SIGNER' ? (CFG.SIGNER || '') : (CFG.WALLET_DERIVATION_PATH || '(default)'),
    };
}

export function getSignerConfigSource(): 'env' | 'runtime' {
    return runtimeSignerSource;
}

export function getWalletDerivationPathConfigSource(): 'env' | 'runtime' {
    return runtimeWalletDerivationPathSource;
}

export const CFG = {
    // --- Netzwerk ---
    RPC_URL: process.env.RPC_URL || 'https://api.testnet.iota.cafe',
    /** Zusätzliche öffentliche Nodes für Stufe-1-Rotation (Haupt-RPC bleibt RPC_URL). */
    RPC_URLS_EXTRA: parseRpcUrlsFromRaw(process.env.RPC_URLS),
    /** HTTP(S)-Proxy für RPC-Requests (z. B. Privoxy vor Tor). Siehe RPC_HTTP_PROXY in .env.example. */
    RPC_HTTP_PROXY: (process.env.RPC_HTTP_PROXY || '').trim(),
    /** SOCKS5-Host für RPC (z. B. Tor 127.0.0.1:9050). Vorrang vor RPC_HTTP_PROXY wenn gesetzt. */
    RPC_SOCKS_PROXY: (process.env.RPC_SOCKS_PROXY || '').trim(),
    /** 1 = Standard-Rotation, 2 = Proxy empfohlen, 3 = eigener Node – nur Hinweis für UI/Doku. */
    NETWORK_TRUST_TIER: Math.min(3, Math.max(1, parseInt(process.env.NETWORK_TRUST_TIER || '1', 10) || 1)),

    // --- Package & Shared Objects ---
    /** Wird aus .env oder aus Datei .morgendrot-package-id geladen (automatisch). */
    PACKAGE_ID: process.env.PACKAGE_ID || readPackageIdFromFile(),
    VAULT_REGISTRY_ID: process.env.VAULT_REGISTRY_ID || '',
    MAILBOX_ID: process.env.MAILBOX_ID || '',

    // --- Wallet & Rolle ---
    MY_ADDRESS: process.env.MY_ADDRESS || '',
    /** Wird aus .env oder aus .morgendrot-partner geladen. Wird automatisch gespeichert, wenn du /connect oder Handshake an eine Adresse nutzt. */
    PARTNER_ADDRESS: process.env.PARTNER_ADDRESS || readPartnerFromFile(),
    /** Mehrere Partner (Pairwise-Groups). Kommagetrennt. Wenn gesetzt, wird PARTNER_ADDRESS ignoriert. */
    PARTNER_ADDRESSES: (process.env.PARTNER_ADDRESSES || '').split(',').map((s) => s.trim()).filter(Boolean),
    /** Pairwise-Groups: Mehrere Partner, jeder mit eigenem Handshake. Teurer (n TX pro Nachricht), sicherer. */
    ENABLE_PAIRWISE_GROUPS: envBool('ENABLE_PAIRWISE_GROUPS', false),
    /** Broadcast-Pinnwand: Alle hören auf eine Adresse (Status/Alarm). Klartext, nur für nicht-sensible Meldungen. */
    ENABLE_BROADCAST_PINNWAND: envBool('ENABLE_BROADCAST_PINNWAND', false),
    /** Adresse der Pinnwand (gemeinsamer recipient). Pflicht wenn ENABLE_BROADCAST_PINNWAND. */
    BROADCAST_PINNWAND_ADDRESS: process.env.BROADCAST_PINNWAND_ADDRESS?.trim() || '',
    /** Nur diese Adressen dürfen an die Pinnwand senden (kommagetrennt). Pflicht wenn ENABLE_BROADCAST_PINNWAND. */
    BROADCAST_AUTHORIZED_SENDERS: (process.env.BROADCAST_AUTHORIZED_SENDERS || '').split(',').map((s) => s.trim()).filter(Boolean),
    /** Ameisen-Modell: Boss-Adresse (ROLE=boss sendet an Kommandanten). */
    BOSS_ADDRESS: process.env.BOSS_ADDRESS?.trim() || '',
    /** Ameisen: Kommandanten-Adressen (kommagetrennt). Boss sendet hierhin; Arbeiter akzeptieren von Boss + Kommandanten. */
    KOMMANDANT_ADDRESSES: (process.env.KOMMANDANT_ADDRESSES || '').split(',').map((s) => s.trim()).filter(Boolean),
    /** Ameisen: Arbeiter-Adressen (kommagetrennt). Kommandant leitet Befehle hierhin weiter. */
    WORKER_ADDRESSES: (process.env.WORKER_ADDRESSES || '').split(',').map((s) => s.trim()).filter(Boolean),
    /** 0x…64 → Rolle (JSON in .env); Boss setzt per /set-role mit Zieladresse + Rolle. */
    DEVICE_ROLES: parseDeviceRolesFromEnv(process.env.DEVICE_ROLES),
    /** Hierarchie-Rechte (optional, alle default true): Wer darf was? Boss = alle, Kommandant = Befehl/Status/Widerruf, Arbeiter = nur Status von oben lesen. */
    ENABLE_COMMAND_DOWN: envBool('ENABLE_COMMAND_DOWN', true),
    ENABLE_KEY_ISSUE: envBool('ENABLE_KEY_ISSUE', true),
    ENABLE_REVOKE_DOWN: envBool('ENABLE_REVOKE_DOWN', true),
    ENABLE_STATUS_READ_DOWN: envBool('ENABLE_STATUS_READ_DOWN', true),
    ENABLE_STATUS_READ_UP: envBool('ENABLE_STATUS_READ_UP', true),
    ENABLE_CONFIG_CHANGE: envBool('ENABLE_CONFIG_CHANGE', true),
    ENABLE_HIERARCHY_CHANGE: envBool('ENABLE_HIERARCHY_CHANGE', true),
    /** messenger = Chat; lock = M2M-Schloss; monitor = Offline-Überwachung; boss/kommandant/arbeiter = Ameisen-Hierarchie. Jeder andere Wert → messenger. */
    ROLE: (() => {
        const r = process.env.ROLE?.trim().toLowerCase();
        if (r === 'lock') return 'lock';
        if (r === 'monitor') return 'monitor';
        if (r === 'boss') return 'boss';
        if (r === 'kommandant') return 'kommandant';
        if (r === 'arbeiter') return 'arbeiter';
        if (r === 'waerter') return 'waerter';
        return 'messenger';
    })(),
    /** 64-Punkt-Rollensystem (6-Bit): D(32)+LW(16)+BW(8)+L(4)+S(2)+P(1). Steuert feingranulare Berechtigungen. */
    ROLE_ID: Math.max(0, Math.min(63, parseInt(process.env.ROLE_ID || '0', 10) || 0)),
    LOCK_ID: process.env.LOCK_ID || '',

    // --- Zeit / TTL (optional) ---
    DEFAULT_TTL_DAYS: envTTLDays('DEFAULT_TTL_DAYS', 30n),
    /** Standard-TTL für neue AccessKey-NFTs (Tage). /create-keys nutzt dies, wenn kein ttl angegeben. */
    DEFAULT_KEY_TTL_DAYS: envTTLDays('DEFAULT_KEY_TTL_DAYS', envTTLDays('DEFAULT_TTL_DAYS', 30n)),
    /** Listener: Abstand zwischen Event-Abfragen (ms). Min. 1000. Default 5000 */
    LISTENER_POLL_MS: envPollMs('LISTENER_POLL_MS', 5000),
    /** Handshake-Watch: Abstand zwischen Prüfungen (ms). Min. 1000. Default 5000 */
    HANDSHAKE_REFRESH_MS: envPollMs('HANDSHAKE_REFRESH_MS', 5000),
    /** Lock: Abstand für PeerMap-Update (ms). Min. 1000. Default 15000 */
    LOCK_PEER_REFRESH_MS: envPollMs('LOCK_PEER_REFRESH_MS', 15000),
    /** Lock: Abstand für Befehls-Poll (ms). Min. 1000. Default 3000 */
    LOCK_COMMAND_POLL_MS: envPollMs('LOCK_COMMAND_POLL_MS', 3000),

    // --- Features (optional, true/false) — modular, flag-gesteuert ---
    /** Lokaler Vault: Pfad = aktiv, leer = aus. */
    VAULT_FILE: process.env.VAULT_FILE || '',
    /** Mailbox nutzen. false = nur Events. Default true wenn MAILBOX_ID gesetzt. */
    USE_MAILBOX: envBool('USE_MAILBOX', Boolean(process.env.MAILBOX_ID)),
    /** Ausführliches Logging. Default false */
    LOG_VERBOSE: envBool('LOG_VERBOSE', false),
    /** Log-Datei (logs/). false = nur Console – minimal lokal. Default true */
    ENABLE_FILE_LOGGING: envBool('ENABLE_FILE_LOGGING', true),
    /** Replay-Schutz (Lock) aktivieren. Default true wenn REPLAY_STATE_FILE gesetzt. */
    ENABLE_REPLAY_PROTECTION: envBool('ENABLE_REPLAY_PROTECTION', Boolean(process.env.REPLAY_STATE_FILE)),
    /** Bei OPEN Hardware ausführen (OPEN_COMMAND/OPEN_URL). Default true wenn einer gesetzt. */
    ENABLE_HARDWARE_OPEN: envBool('ENABLE_HARDWARE_OPEN', Boolean(process.env.OPEN_COMMAND || process.env.OPEN_URL)),

    /** Optional: Zusätzlich Klartext-Events emittieren (Test/Demo, im Explorer sichtbar). Default false. Regel 2: Allow Cleartext. */
    ENABLE_PLAINTEXT_CHANNEL: envBool('ENABLE_PLAINTEXT_CHANNEL', false),
    /**
     * Wenn true und Mailbox aktiv: Klartext wird zusätzlich als Objekt in der Mailbox gespeichert (purgebar / Storage-Rebate).
     * Sonst nur PlaintextMessage-Event (wie bisher).
     */
    MAILBOX_STORE_PLAINTEXT: envBool('MAILBOX_STORE_PLAINTEXT', false),
    /** Purge-Befehle erlauben. false = alle Purge-Befehle werden abgelehnt (Daten bleiben dauerhaft). Regel 5. Default true. */
    ENABLE_PURGE: envBool('ENABLE_PURGE', true),
    /** Optional: Purge nur erlauben wenn Storage-Rebate (in Mist) >= dieser Wert. 0 = aus. Verhindert Geldverbrennung bei unwirtschaftlichem Purge. */
    PURGE_MIN_REBATE_MIST: Math.max(0, envInt('PURGE_MIN_REBATE_MIST', 0)),
    /** Discovery über verschlüsselte Kanäle (z.B. Streams). Geplant. Regel 4. Default false. */
    USE_ENCRYPTED_DISCOVERY: envBool('USE_ENCRYPTED_DISCOVERY', false),
    /** Listener: false = kein Abfragen/Empfangen von Nachrichten (komplett aus). Default true. */
    ENABLE_LISTENER: envBool('ENABLE_LISTENER', true),
    /** Beim Start (nach /connect) die letzten N Nachrichten von der Chain holen. 0 = aus. Default 0. */
    FETCH_LAST_ON_START: Math.max(0, envInt('FETCH_LAST_ON_START', 0)),
    /** Befehl "hole letzten N" / "/fetch N" erlauben. Default true. */
    ENABLE_FETCH_COMMAND: envBool('ENABLE_FETCH_COMMAND', true),
    /** Auto-Befehle: false = empfangene Befehle nur anzeigen, nicht ausführen (Kill-Switch). Lock: "open" nicht ausführen. Default true. */
    ENABLE_AUTO_EXECUTE: envBool('ENABLE_AUTO_EXECUTE', true),
    /** Nur diese Adressen dürfen Auto-Befehle auslösen (kommagetrennt). Leer = keine Zusatz-Whitelist. Bei ROLE=arbeiter: falls leer, wird aus BOSS_ADDRESS+KOMMANDANT_ADDRESSES abgeleitet. */
    AUTHORIZED_SENDERS: (process.env.AUTHORIZED_SENDERS || '').split(',').map((s) => s.trim()).filter(Boolean),
    /** Max. Betrag (in IOTA) pro Auto-Befehl "sende X coins" (zukünftig). Leer = kein Limit. */
    MAX_SEND_AMOUNT_IOTA: process.env.MAX_SEND_AMOUNT_IOTA?.trim() || '',

    // --- Zahlungs-Trigger (Lock): bei eingehender Zahlung an MY_ADDRESS Aktion auslösen (z. B. Ladevorgang). Siehe docs/STREAMS-INTEGRATION.md §8.3. ---
    /** Bei Zahlung an Lock-Adresse OPEN_COMMAND/OPEN_URL auslösen. Default false. */
    PAYMENT_TRIGGER_ENABLED: envBool('PAYMENT_TRIGGER_ENABLED', false),
    /** Mindestbetrag (in IOTA, z. B. "0.001") – nur dann Aktion. Leer = jede Zahlung. */
    PAYMENT_TRIGGER_MIN_IOTA: process.env.PAYMENT_TRIGGER_MIN_IOTA?.trim() || '',
    /** Abstand zwischen Prüfungen (ms). Min. 1000. Default 15000. */
    PAYMENT_TRIGGER_POLL_MS: envPollMs('PAYMENT_TRIGGER_POLL_MS', 15000),
    /** Optional: Datei für bereits verarbeitete TX-Digests (Replay-Schutz). Leer = nur in-memory. */
    PAYMENT_TRIGGER_STATE_FILE: process.env.PAYMENT_TRIGGER_STATE_FILE?.trim() || '',

    // --- Replay-Schutz (Lock): Datei für letzte Nonce pro Sender. Leer = nur in-memory (kein Schutz nach Neustart) ---
    REPLAY_STATE_FILE: process.env.REPLAY_STATE_FILE || '',

    // --- Hardware (Lock): Bei OPEN ausführen. Leer = nur Log. Kein shell=true → kein Command-Injection. ---
    /** Befehl (z. B. "node relay-on.js"). Wird per spawn ohne Shell ausgeführt. */
    OPEN_COMMAND: process.env.OPEN_COMMAND || '',
    /** HTTP-URL (GET), z. B. Smart-Lock-Webhook. Nur aus .env, nicht aus Nutzerinput. */
    OPEN_URL: process.env.OPEN_URL || '',
    /** Kommagetrennte Liste der Wörter, die „Tür öffnen“ auslösen (Kleinbuchstaben). Default: open,öffnen. Wird nur genutzt, wenn weder On-Chain noch AES-Datei gesetzt. */
    OPEN_COMMAND_WORDS: (process.env.OPEN_COMMAND_WORDS || 'open,öffnen').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean),
    /** Optional: AES-verschlüsselte Datei mit Öffnen-Wörtern (kommagetrennt). Format: 12 Byte IV + AES-256-GCM Ciphertext. */
    OPEN_COMMAND_LIST_FILE: process.env.OPEN_COMMAND_LIST_FILE?.trim() || '',
    /** 32-Byte-Key als Hex (64 Zeichen) für OPEN_COMMAND_LIST_FILE. */
    OPEN_COMMAND_LIST_KEY: process.env.OPEN_COMMAND_LIST_KEY?.trim() || '',
    /** Optional: CommandRegistry-Objekt-ID für on-chain Öffnen-Wörter (set_open_words). */
    COMMAND_REGISTRY_ID: process.env.COMMAND_REGISTRY_ID?.trim() || '',
    /** Optional: EventTicketRegistry-Objekt-ID für /purge-expired-tickets (nicht Package-ID). */
    EVENT_REGISTRY_ID: process.env.EVENT_REGISTRY_ID?.trim() || '',
    /** Optional: IOTA Streams als letzte Meile (feeless, <1s). Bei OPEN GRANTED zusätzlich Nachricht auf Streams-Kanal. Siehe docs/STREAMS-INTEGRATION.md. */
    OPEN_STREAMS_ENABLED: envBool('OPEN_STREAMS_ENABLED', false),
    /** Streams: Anchor-ID des Kanals (API-abhängig). Nur bei OPEN_STREAMS_ENABLED. */
    STREAMS_ANCHOR_ID: process.env.STREAMS_ANCHOR_ID?.trim() || '',
    /** Streams: Topic/Branch (optional, API-abhängig). */
    STREAMS_TOPIC: process.env.STREAMS_TOPIC?.trim() || '',
    /** Streams: Auf eingehende Nachrichten hören (alternativer Transport). Default false. */
    STREAMS_LISTEN_ENABLED: envBool('STREAMS_LISTEN_ENABLED', false),
    /** Streams: HTTP-Bridge-URL zum Pollen (z. B. https://streams-bridge.local/messages). Leer = Stub. */
    STREAMS_BRIDGE_URL: process.env.STREAMS_BRIDGE_URL?.trim() || '',
    /**
     * Factory-I/O-Feeder (Demos/Industrie-Simulation) – kein Bestandteil des Messenger-Kernflows.
     * false: keine Factory-Keys in /api/config und Copy-Popup (siehe env.factory-io.example).
     */
    ENABLE_FACTORY_IO: envBool('ENABLE_FACTORY_IO', false),
    /** Optional: Factory-I/O-Web-API (nur wenn ENABLE_FACTORY_IO). Leer = aus. */
    FACTORY_IO_URL: process.env.FACTORY_IO_URL?.trim() || '',
    /** Poll-Intervall für Factory-I/O-Feeder (ms). 500–86400000. */
    FACTORY_IO_POLL_MS: Math.max(500, Math.min(86400000, envInt('FACTORY_IO_POLL_MS', 10000))),

    // --- Offline-Fähigkeit (Lock): OPEN auch ohne Chain, wenn AccessKey gecacht. Optional. ---
    /** Bei Netzausfall OPEN mit gecachtem AccessKey erlauben. Default false. */
    OFFLINE_OPEN_ENABLED: envBool('OFFLINE_OPEN_ENABLED', false),
    /** Gültigkeit des AccessKey-Caches (ms). Default 24h. Nur bei OFFLINE_OPEN_ENABLED. */
    OFFLINE_CACHE_TTL_MS: envInt('OFFLINE_CACHE_TTL_MS', 86400000),
    /** Lokale Datei als Offline-Queue (eine JSON-Zeile pro Befehl: {"sender":"0x...","cmd":"open","nonce":123}). Leer = aus. */
    OFFLINE_QUEUE_FILE: process.env.OFFLINE_QUEUE_FILE?.trim() || '',

    /** Deferred-Settlement: Offline-Bestätigungen in Queue, asynchron per Batch-PTB on-chain. */
    SETTLEMENT_QUEUE_ENABLED: envBool('SETTLEMENT_QUEUE_ENABLED', false),
    SETTLEMENT_QUEUE_FILE: process.env.SETTLEMENT_QUEUE_FILE?.trim() || '.morgendrot-settlement-queue.jsonl',
    SETTLEMENT_QUEUE_BATCH_SIZE: Math.max(1, envInt('SETTLEMENT_QUEUE_BATCH_SIZE', 20)),
    SETTLEMENT_QUEUE_INTERVAL_MS: Math.max(5000, envInt('SETTLEMENT_QUEUE_INTERVAL_MS', 15000)),
    /** Tiny-Geräte: JSON-Datei { "deviceId": "base64Secret" } oder Env TINY_DEVICE_SECRET_<id>. Leer = keine HMAC-Prüfung. */
    TINY_DEVICES_FILE: process.env.TINY_DEVICES_FILE?.trim() || '',

    // --- Monitoring: Heartbeat + Offline-Alarm (optional) ---
    /** Lock sendet Heartbeat via Streams („ich bin online“). Default false. */
    ENABLE_HEARTBEAT: envBool('ENABLE_HEARTBEAT', false),
    /** Abstand zwischen Heartbeats (ms). Min. 60000. Default 600000 (10 Min). */
    HEARTBEAT_INTERVAL_MS: Math.max(60_000, envInt('HEARTBEAT_INTERVAL_MS', 600000)),
    /** Monitor parallel zu Messenger: true = bei ROLE=messenger zusätzlich Offline-Überwachung + Webhook. */
    ENABLE_MONITOR: envBool('ENABLE_MONITOR', false),
    /** Monitor: Kommagetrennte Geräte-Adressen. ROLE=monitor oder ENABLE_MONITOR. */
    MONITOR_DEVICES: (process.env.MONITOR_DEVICES || '').split(',').map((s) => s.trim()).filter(Boolean),
    /** Monitor: Timeout bis Offline-Alarm (ms). Default 1800000 (30 Min). */
    MONITOR_OFFLINE_TIMEOUT_MS: envInt('MONITOR_OFFLINE_TIMEOUT_MS', 1800000),
    /** Monitor: Datei für letzten Heartbeat pro Gerät. */
    MONITOR_STATE_FILE: process.env.MONITOR_STATE_FILE?.trim() || '',
    /** Monitor: Abstand zwischen Offline-Prüfungen (ms). Default 300000 (5 Min). */
    MONITOR_CHECK_INTERVAL_MS: envPollMs('MONITOR_CHECK_INTERVAL_MS', 300000),
    /** Monitor: Webhook-URL bei Offline-Alarm (POST JSON). Leer = nur Log. */
    MONITOR_ALARM_WEBHOOK_URL: process.env.MONITOR_ALARM_WEBHOOK_URL?.trim() || '',
    /** Monitor: Max. Temperatur (°C) – darüber → Alarm (Kühlkette). NaN = keine Prüfung. */
    MONITOR_SENSOR_MAX_TEMP: process.env.MONITOR_SENSOR_MAX_TEMP?.trim() ? parseFloat(process.env.MONITOR_SENSOR_MAX_TEMP) : NaN,
    /** Monitor: Min. Temperatur (°C) – darunter → Alarm. NaN = keine Prüfung. */
    MONITOR_SENSOR_MIN_TEMP: process.env.MONITOR_SENSOR_MIN_TEMP?.trim() ? parseFloat(process.env.MONITOR_SENSOR_MIN_TEMP) : NaN,
    /** Monitor: Datei für letzten Sensor-Wert pro Gerät. */
    MONITOR_SENSOR_STATE_FILE: process.env.MONITOR_SENSOR_STATE_FILE?.trim() || '',
    /** Monitor: Abstand zwischen Eskalationsstufen (ms). Default 300000 (5 Min). */
    MONITOR_ESCALATION_DELAY_MS: envInt('MONITOR_ESCALATION_DELAY_MS', 300000),
    /** Monitor: Eskalation Level 2 – Webhook-URL (z.B. Disponent). Leer = aus. */
    MONITOR_ESCALATION_WEBHOOK_2: process.env.MONITOR_ESCALATION_WEBHOOK_2?.trim() || '',
    /** Monitor: Eskalation Level 3 – Webhook-URL (z.B. Chef). Leer = aus. */
    MONITOR_ESCALATION_WEBHOOK_3: process.env.MONITOR_ESCALATION_WEBHOOK_3?.trim() || '',
    /** Monitor: Purge bei Lieferung – nach X Tagen Inaktivität Nachrichten purgebar. 0 = aus. */
    MONITOR_PURGE_AFTER_DAYS: Math.max(0, envInt('MONITOR_PURGE_AFTER_DAYS', 0)),

    // --- Zahlungs-Trigger: Münzcode (optional) ---
    /** Nur bei Zahlung mit Memo/Metadata enthält diesen Code (Substring). Leer = keine Prüfung. */
    PAYMENT_TRIGGER_REQUIRE_MEMO: process.env.PAYMENT_TRIGGER_REQUIRE_MEMO?.trim() || '',

    // --- Chain-Anchor (optional): Hash des Zustands on-chain ---
    /** Periodisch Zustands-Hash on-chain anker (Messenger). Default false. */
    ENABLE_CHAIN_ANCHOR: envBool('ENABLE_CHAIN_ANCHOR', false),
    /** Abstand zwischen Anchors (ms). Default 86400000 (24h). */
    ANCHOR_INTERVAL_MS: envInt('ANCHOR_INTERVAL_MS', 86400000),

    // --- Log-Rotation & Audit ---
    /** Audit-Log für Lieferkette (CSV-Export). Leer = logs/audit.jsonl. */
    AUDIT_LOG_FILE: process.env.AUDIT_LOG_FILE?.trim() || '',
    /** Max. Anzahl Log-Dateien (Rotation). 0 = unbegrenzt. Default 7. */
    LOG_MAX_FILES: envInt('LOG_MAX_FILES', 7),
    /** Max. Größe pro Log-Datei (z. B. "20m"). Default "20m". */
    LOG_MAX_SIZE: process.env.LOG_MAX_SIZE?.trim() || '20m',

    // --- Signer: cli (lokal) | remote (Boss) | sdk (Mnemonic im Prozess, keine CLI) ---
    /** cli = IOTA-CLI. remote = Boss-Service. sdk = Mnemonic eingeben, Signatur im Prozess (PC2 ohne CLI). */
    SIGNER: (process.env.SIGNER || 'cli') as 'cli' | 'remote' | 'sdk',
    /** URL des Boss-Signer-Services (z. B. https://boss.example/sign). Nur bei SIGNER=remote. */
    REMOTE_SIGNER_URL: process.env.REMOTE_SIGNER_URL || '',
    /** Optional: Bearer-Token für REMOTE_SIGNER_URL. */
    REMOTE_SIGNER_TOKEN: process.env.REMOTE_SIGNER_TOKEN || '',
    /**
     * Öffentliche URL des Boss-Signer-Services, **so wie Geräte im LAN sie erreichen** (nicht localhost vom Boss).
     * Wird bei Provisioning (Hardware „IoT-Gateway“) in die exportierte Geräte-.env als REMOTE_SIGNER_URL übernommen.
     */
    BOSS_SIGNER_PUBLIC_URL: process.env.BOSS_SIGNER_PUBLIC_URL?.trim() || '',
    /** Nur bei SIGNER=sdk: Ableitungspfad (z. B. m/44'/4218'/0'/0'/0'). Leer = Default. */
    WALLET_DERIVATION_PATH: process.env.WALLET_DERIVATION_PATH?.trim() || '',
    /** Phase 2: HD-abgeleitete Kontakt-Adressen (Modul hd-contact-derivation; Flag ohne Logik = nur Vorbereitung). */
    ENABLE_HD_CONTACT_ADDRESSES: envBool('ENABLE_HD_CONTACT_ADDRESSES', false),

    // --- Gas (optional) ---
    GAS_BUDGET: envInt('GAS_BUDGET', 10_000_000),
    /** Sponsored Transactions: Adresse, die Gas für eine TX übernimmt (z. B. Boss/Vermieter). Wenn gesetzt und von signingAddress verschieden, kann signAndExecute mit sponsorPassword die TX als gesponsert bauen. */
    SPONSOR_GAS_OWNER: (process.env.SPONSOR_GAS_OWNER || '').trim() || undefined as string | undefined,
    /** Passwort des Sponsor-Wallets (für use_ticket: Wärter kann SPONSOR_GAS_PASSWORD=Boss-Passwort setzen, damit Boss Gas zahlt). Leer = bei Bedarf getWalletPassword(). */
    SPONSOR_GAS_PASSWORD: (process.env.SPONSOR_GAS_PASSWORD || '').trim() || undefined as string | undefined,
    /** Sponsored Transactions aktivieren (SPONSOR_GAS_OWNER muss gesetzt sein). */
    SPONSORED_TRANSACTION_ENABLED: envBool('SPONSORED_TRANSACTION_ENABLED', false),
    /** Gas Station: Boss überweist automatisch IOTA an Worker unter Schwellwert. Default false. */
    GAS_STATION_ENABLED: envBool('GAS_STATION_ENABLED', false),
    /** Gas Station: Schwellwert (IOTA) – darunter wird nachgefüllt. Default 0.1. */
    GAS_STATION_MIN_IOTA: Math.max(0, parseFloat(process.env.GAS_STATION_MIN_IOTA || '0.1') || 0.1),
    /** Gas Station: Nachfüll-Betrag (IOTA) pro Worker. Default 1. */
    GAS_STATION_TOPUP_IOTA: Math.max(0.001, parseFloat(process.env.GAS_STATION_TOPUP_IOTA || '1') || 1),
    /** Gas Station: Abstand zwischen Prüfungen (ms). Default 300000 (5 Min). */
    GAS_STATION_CHECK_MS: Math.max(60_000, envInt('GAS_STATION_CHECK_MS', 300000)),
    /**
     * Optional: Basis-URL der IOTA Gas Station (Remote-Sponsor). Noch ohne aktive Client-Logik –
     * für DLT.green / spätere Anbindung; Konfiguration und UI-Feld sind vorbereitet.
     */
    IOTA_GAS_STATION_URL: (process.env.IOTA_GAS_STATION_URL || '').trim() || undefined as string | undefined,
    /**
     * Messenger: Nach mindestens einer erfolgreichen selbstbezahlten TX (.messenger-gas-state.json) und Besitz von
     * MESSENGER_LICENSE_NFT_OBJECT_ID → Gas durch SPONSOR_GAS_OWNER (SPONSORED_TRANSACTION_ENABLED + SPONSOR_GAS_PASSWORD nötig).
     */
    MESSENGER_AUTO_SPONSOR: envBool('MESSENGER_AUTO_SPONSOR', false),
    /** Objekt-ID (0x+64 Hex) des Lizenz-NFT für Auto-Sponsor ab der 2. TX. */
    MESSENGER_LICENSE_NFT_OBJECT_ID: (process.env.MESSENGER_LICENSE_NFT_OBJECT_ID || '').trim() || undefined as string | undefined,
    /**
     * Optional: Prepaid Messenger-Credits (owned object). Wenn gesetzt und Mailbox aktiv → Move nutzt *_with_credits (Abbuchung pro Handshake/Nachricht).
     * Objekt-ID nach Boss-Mint oder aus Export (.env MESSENGER_CREDITS_OBJECT_ID).
     */
    MESSENGER_CREDITS_OBJECT_ID: (process.env.MESSENGER_CREDITS_OBJECT_ID || '').trim() || undefined as string | undefined,
    /**
     * Optional: Geheimnis-Peering nur wenn diese Wallet das angegebene NFT besitzt („Türsteher“ für private Kreise).
     */
    PAIRING_GATE_NFT_OBJECT_ID: (process.env.PAIRING_GATE_NFT_OBJECT_ID || '').trim() || undefined as string | undefined,
    /** IOTA Names: erlaubte Move-Pakete für das Registrierungs-NFT (Indexer-Lookup + Typ-Check). */
    VERIFIED_IOTA_NAME_PACKAGE_IDS: parseVerifiedIotaNamePackageIds(process.env.VERIFIED_IOTA_NAME_PACKAGE_IDS),
    /**
     * Shadow-Sweep: Reserve in MIST auf der Schatten-Adresse (Rest nach Sweep). Default 55_000_000.
     */
    SHADOW_SWEEP_GAS_RESERVE_MIST: ((): bigint => {
        const raw = process.env.SHADOW_SWEEP_GAS_RESERVE_MIST?.trim();
        if (!raw) return 55_000_000n;
        try {
            const n = BigInt(raw);
            return n > 0n ? n : 55_000_000n;
        } catch {
            return 55_000_000n;
        }
    })(),

    // --- Audit (optional: Streams für Blackbox) ---
    /** Audit-Events zusätzlich als Hash in Streams schreiben (fälschungssicher). Default false. */
    AUDIT_STREAMS_ENABLED: envBool('AUDIT_STREAMS_ENABLED', false),

    // --- Multi-Sig Boss (Governance, optional) ---
    /** Kommagetrennte Boss-Adressen für 2-of-N. Leer = kein Multi-Sig. */
    BOSS_MULTISIG_ADDRESSES: (process.env.BOSS_MULTISIG_ADDRESSES || '').split(',').map((s) => s.trim()).filter((s) => s.startsWith('0x')),
    /** Anzahl nötiger Signaturen (z. B. 2). 0 = nicht aktiv. */
    BOSS_MULTISIG_THRESHOLD: Math.max(0, envInt('BOSS_MULTISIG_THRESHOLD', 0)),

    // --- Euro-Orakel (Zahlungs-Trigger in EUR) ---
    /** URL für IOTA/EUR-Kurs (JSON mit rate: IOTA pro 1 EUR). Leer = keine Umrechnung. */
    IOTA_EUR_ORACLE_URL: (process.env.IOTA_EUR_ORACLE_URL || '').trim() || undefined as string | undefined,

    // --- Optionale Offline-UI (zukünftig) ---
    /** Lokale Web-UI für Config/Log. Default false. */
    ENABLE_UI: envBool('ENABLE_UI', false),
    /** Port der lokalen UI. Default 3341. */
    UI_PORT: envInt('UI_PORT', 3341),
    /**
     * Lite-UI (ui/) am API-Port ausliefern (GET /, *.css, …). Default true (Standalone-Export, klassischer Flow).
     * false = nur REST /api/* am API-Port; Oberfläche nur noch Next unter UI_PORT (weniger Doppel-UI im Dev).
     * Env: SERVE_LITE_UI_STATIC=false
     */
    SERVE_LITE_UI_STATIC: envBool('SERVE_LITE_UI_STATIC', true),
    /** Port der API (Status, Befehle). Default 3342. Nur bei ENABLE_UI. */
    API_PORT: envInt('API_PORT', 3342),
    /**
     * Vor dem Listen: ggf. laufende Morgendrot-API auf demselben Port per /restart beenden.
     * Bei zweiter Instanz auf demselben PC auf false setzen, sonst wird die erste API neu gestartet.
     */
    API_KILL_PREVIOUS_INSTANCE: envBool('API_KILL_PREVIOUS_INSTANCE', true),
    /**
     * Zwei Messenger-Produkte aus einem Code: standalone = Plug-and-Play (Boss-Export, Entwickler);
     * sales = Kunden-Bundle (Fokus Schatten-Seed / Sweep, SIGNER=sdk empfohlen). sales erzwingt Messenger-UI.
     * Env: MESSENGER_EDITION=standalone | sales
     */
    MESSENGER_EDITION: ((): 'standalone' | 'sales' => {
        const e = (process.env.MESSENGER_EDITION || 'standalone').trim().toLowerCase();
        return e === 'sales' ? 'sales' : 'standalone';
    })(),
    /**
     * Lite-UI (ui/index.html): full = alle Kacheln; messenger = nur Nachrichten + Minibar (IOTA, Package).
     * Gleiches Backend/Binary – nur Darstellung. Env: UI_VARIANT=messenger
     */
    UI_VARIANT: (() => {
        const edition = (process.env.MESSENGER_EDITION || 'standalone').trim().toLowerCase();
        if (edition === 'sales') return 'messenger';
        const v = (process.env.UI_VARIANT || 'full').trim().toLowerCase();
        return v === 'messenger' ? 'messenger' : 'full';
    })(),
    /** Geheimnis-Peering: max. Wartezeit (ms) für /pairing-wait. Default 120000, min 15000. */
    PAIRING_WAIT_TIMEOUT_MS: Math.max(15_000, envInt('PAIRING_WAIT_TIMEOUT_MS', 120_000)),
    /** Max. PairingOffer-Kandidaten pro /pairing-find (RPC-Pagination). 10–2000, Default 250. */
    PAIRING_FIND_MAX_CANDIDATES: Math.max(10, Math.min(2000, envInt('PAIRING_FIND_MAX_CANDIDATES', 250))),
    /** Max. Entschlüsselungsversuche pro /pairing-find (nur noch gültige Offers). 5–500, Default 80. */
    PAIRING_FIND_MAX_DECRYPT_ATTEMPTS: Math.max(5, Math.min(500, envInt('PAIRING_FIND_MAX_DECRYPT_ATTEMPTS', 80))),
    /**
     * UI „Lite“: optionaler Standard-Briefkasten (0x+64 Hex). Leer = Button „Voreinstellung“ inaktiv bis gesetzt.
     * Env: MORGENDROT_LITE_PACKAGE_ID
     */
    LITE_PRESET_PACKAGE_ID: process.env.MORGENDROT_LITE_PACKAGE_ID?.trim() || '',
    /** Lite-RPC; leer → /api/messenger-presets liefert CFG.RPC_URL als Fallback-Anzeige. */
    LITE_PRESET_RPC_URL: process.env.MORGENDROT_LITE_RPC_URL?.trim() || '',
    /** Rate-Limit für POST /api/command (Anfragen pro Minute pro IP). 0 = aus. Default 0. */
    API_RATE_LIMIT_COMMANDS_PER_MINUTE: Math.max(0, envInt('API_RATE_LIMIT_COMMANDS_PER_MINUTE', 0)),
    /**
     * Öffentlicher Claim-Token-Endpunkt POST /api/voucher-claim (Shop-E-Mail, Idempotenz-Datei).
     * Default false — bewusst aktivieren auf Fulfillment-Hosts.
     */
    ENABLE_VOUCHER_CLAIM_API: envBool('ENABLE_VOUCHER_CLAIM_API', false),
    /** Rate-Limit für POST /api/voucher-claim pro IP (Anfragen/Minute). 0 = aus. Default 30. */
    VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE: Math.max(0, envInt('VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE', 30)),

    /**
     * Integrierter Shop (Stripe Checkout, kein Kartendaten-Touch — nur serverseitige Session + Webhook).
     * Siehe docs/API-SHOP-SPEC.md
     */
    ENABLE_SHOP_API: envBool('ENABLE_SHOP_API', false),
    /** Basis-URL für Stripe success/cancel (z. B. https://app.example.com oder http://127.0.0.1:3341). Ohne trailing slash. */
    SHOP_PUBLIC_BASE_URL: (process.env.SHOP_PUBLIC_BASE_URL || '').trim().replace(/\/$/, ''),
    /** Rate-Limit POST /api/shop/checkout-session und /api/shop/session-claim pro IP/Minute. 0 = aus. */
    SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE: Math.max(0, envInt('SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE', 20)),
    /** Stripe Secret Key (sk_test_… / sk_live_…) — niemals an Client oder Git. */
    STRIPE_SECRET_KEY: (process.env.STRIPE_SECRET_KEY || '').trim(),
    /** Webhook-Signing-Secret (whsec_…) für POST /api/shop/webhook/stripe */
    STRIPE_WEBHOOK_SECRET: (process.env.STRIPE_WEBHOOK_SECRET || '').trim(),
    /**
     * Nach Stripe-Zahlung: optional `mint_messenger_credits_batch` an Empfänger-Adresse,
     * wenn Checkout `recipientIotaAddress` mitschickt (Metadata) und Boss-Wallet entsperrt/Passwort.
     */
    ENABLE_SHOP_CHAIN_MINT: envBool('ENABLE_SHOP_CHAIN_MINT', false),
    /** Optional: HTTPS POST nach ausgestelltem Claim (z. B. eigenes Mail-Backend). Body siehe docs/API-SHOP-SPEC.md */
    SHOP_CLAIM_NOTIFY_WEBHOOK_URL: (process.env.SHOP_CLAIM_NOTIFY_WEBHOOK_URL || '').trim().replace(/\/$/, ''),
    SHOP_CLAIM_NOTIFY_SECRET: (process.env.SHOP_CLAIM_NOTIFY_SECRET || '').trim(),

    // --- Optional: AI (Intent-Matcher und/oder Ollama) ---
    /** Intent-Matcher (Variante 1): Beispielphrasen → Befehl, ohne LLM. Klein, schnell, optional neben Ollama. */
    ENABLE_AI_INTENT_MATCHER: envBool('ENABLE_AI_INTENT_MATCHER', false),
    /** AI-Copilot in Säule 3 / Hauptseite (Ollama o. ä.). Default false. Kann mit ENABLE_AI_INTENT_MATCHER kombiniert werden. */
    ENABLE_AI_COPILOT: envBool('ENABLE_AI_COPILOT', false),
    /** Basis-URL des Ollama-Servers (z. B. http://127.0.0.1:11434). Nur bei ENABLE_AI_COPILOT. */
    OLLAMA_URL: (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').trim().replace(/\/$/, ''),
    /** Ollama-Modell. Empfohlen: qwen2.5-coder:1.5b (Code/Befehle) oder :7b; qwen2:0.5b für schwache Hardware. */
    OLLAMA_MODEL: (process.env.OLLAMA_MODEL || 'qwen2.5-coder:1.5b').trim() || 'qwen2.5-coder:1.5b',
    /** RAG: Embedding-Modell für Chunk-Suche (z. B. nomic-embed-text). Nur bei aktivem RAG. */
    RAG_EMBEDDING_MODEL: (process.env.RAG_EMBEDDING_MODEL || 'nomic-embed-text').trim() || 'nomic-embed-text',
    /** RAG: Anzahl der ähnlichsten Chunks pro Anfrage (im Prompt). Default 3. Bei RAG_TOP_K_RETRIEVE>RAG_TOP_K werden mehr Kandidaten geholt, nur Top-K ins Prompt. */
    RAG_TOP_K: Math.max(1, Math.min(20, parseInt(process.env.RAG_TOP_K || '3', 10) || 3)),
    /** RAG: Wie viele Chunks beim Abruf berücksichtigt werden (Recall). Wenn > RAG_TOP_K, wird nur die beste Teilmenge (RAG_TOP_K) ins Prompt genommen. Default 0 = wie RAG_TOP_K. */
    RAG_TOP_K_RETRIEVE: Math.max(0, Math.min(20, parseInt(process.env.RAG_TOP_K_RETRIEVE || '0', 10) || 0)),
    /** RAG: 1-Hop-Erweiterung (referenzierte Chunks mit einbeziehen). Default true. */
    RAG_EXPAND_REFERENCES: process.env.RAG_EXPAND_REFERENCES !== 'false',
    /** RAG: Minimum-Score (0–1). Chunks unter diesem Score werden verworfen. Default 0.3. */
    RAG_MIN_SCORE: Math.min(1, Math.max(0, parseFloat(process.env.RAG_MIN_SCORE || '0.3') || 0.3)),
    /** Confidence-Gate: Ab diesem Wert (0–1) darf die UI den Befehl automatisch ausführen. Darunter nur Vorschlag (Gelb). Empfohlen 0.78–0.82. Default 0.80. */
    AI_COPILOT_CONFIDENCE_THRESHOLD: Math.min(1, Math.max(0, parseFloat(process.env.AI_COPILOT_CONFIDENCE_THRESHOLD || '0.80') || 0.80)),
    /** Bei true: Prompt (System + User) und Raw-Ollama-Response in die Logs (logger.info). Für Debug von Template-Müll. */
    AI_DEBUG_OLLAMA: envBool('AI_DEBUG_OLLAMA', false),
};

applyRuntimeConfigToCfg();

/**
 * Einheitliche Bedingung: Messenger nutzt Mailbox-Move-Pfad (HsKey/MsgKey im Mailbox-Objekt) statt reinem Event-Pfad.
 * PACKAGE_ID + MAILBOX_ID + USE_MAILBOX – dieselbe Logik überall (chain-access, fetch, listener).
 */
export function isMessengerMailboxModeActive(): boolean {
    return Boolean(CFG.PACKAGE_ID && CFG.MAILBOX_ID && CFG.USE_MAILBOX);
}

/** Adressen für /connect: PARTNER_ADDRESSES (Pairwise), KOMMANDANT_ADDRESSES (Boss), [BOSS, ...WORKER] (Kommandant), oder [PARTNER]. */
export function getConnectAddresses(): string[] {
    if (CFG.ENABLE_PAIRWISE_GROUPS && CFG.PARTNER_ADDRESSES.length > 0) return CFG.PARTNER_ADDRESSES;
    if (CFG.ROLE === 'boss' && CFG.KOMMANDANT_ADDRESSES.length > 0) return CFG.KOMMANDANT_ADDRESSES;
    if (CFG.ROLE === 'kommandant' && (CFG.BOSS_ADDRESS || CFG.WORKER_ADDRESSES.length > 0)) {
        return [CFG.BOSS_ADDRESS, ...CFG.WORKER_ADDRESSES].filter(Boolean);
    }
    const p = CFG.PARTNER_ADDRESS || readPartnerFromFile();
    return p ? [p] : [];
}

/** Effektive AUTHORIZED_SENDERS: explizit gesetzt, oder bei ROLE=arbeiter aus BOSS_ADDRESS+KOMMANDANT_ADDRESSES. */
export function getEffectiveAuthorizedSenders(): string[] {
    if (CFG.AUTHORIZED_SENDERS.length > 0) return CFG.AUTHORIZED_SENDERS;
    if (CFG.ROLE === 'arbeiter' && (CFG.BOSS_ADDRESS || CFG.KOMMANDANT_ADDRESSES.length > 0)) {
        return [CFG.BOSS_ADDRESS, ...CFG.KOMMANDANT_ADDRESSES].filter(Boolean);
    }
    return [];
}

/** Rechte-Matrix Ameisen: Boss ⊇ Kommandant ⊇ Arbeiter. Nur bei ROLE boss/kommandant/arbeiter; sonst alle true (keine Filterung). */
export type HierarchyPermissions = {
    commandDown: boolean;   // Befehl senden (Boss→K/A, K→A)
    keyIssue: boolean;     // Schlüssel ausstellen (nur Boss)
    revokeDown: boolean;   // Widerruf/Sperren (Boss alle, K nur Arbeiter)
    statusReadDown: boolean; // Status von unten lesen (Boss/K)
    statusReadUp: boolean;   // Status von oben lesen (K→Boss, A→Boss+K)
    configChange: boolean;  // Konfig ändern (nur Boss)
    hierarchyChange: boolean; // Hierarchie ändern (nur Boss)
};

const HIERARCHY_KEYS = new Set(['ROLE', 'ROLE_ID', 'BOSS_ADDRESS', 'KOMMANDANT_ADDRESSES', 'WORKER_ADDRESSES', 'DEVICE_ROLES']);

/** 64-Punkt-Rollensystem: Bit-Konstanten für feingranulare Berechtigungsprüfung. */
export const ROLE_BITS = { D: 32, LW: 16, BW: 8, L: 4, S: 2, P: 1 } as const;

export function hasRoleBit(bit: number): boolean {
    return (CFG.ROLE_ID & bit) !== 0;
}

export function isHierarchyConfigKey(key: string): boolean {
    return HIERARCHY_KEYS.has(String(key || '').trim());
}

export function getHierarchyPermissions(role: string): HierarchyPermissions {
    const r = String(role || '').toLowerCase();
    const on = (flag: boolean) => flag;
    const cmd = on(CFG.ENABLE_COMMAND_DOWN);
    const key = on(CFG.ENABLE_KEY_ISSUE);
    const rev = on(CFG.ENABLE_REVOKE_DOWN);
    const down = on(CFG.ENABLE_STATUS_READ_DOWN);
    const up = on(CFG.ENABLE_STATUS_READ_UP);
    const cfg = on(CFG.ENABLE_CONFIG_CHANGE);
    const hier = on(CFG.ENABLE_HIERARCHY_CHANGE);
    if (r !== 'boss' && r !== 'kommandant' && r !== 'arbeiter') {
        return { commandDown: true, keyIssue: true, revokeDown: true, statusReadDown: true, statusReadUp: true, configChange: true, hierarchyChange: true };
    }
    if (r === 'boss') {
        return { commandDown: cmd, keyIssue: key, revokeDown: rev, statusReadDown: down, statusReadUp: true, configChange: cfg, hierarchyChange: hier };
    }
    if (r === 'kommandant') {
        return { commandDown: cmd, keyIssue: false, revokeDown: rev, statusReadDown: down, statusReadUp: up, configChange: false, hierarchyChange: false };
    }
    // arbeiter: nur Status von oben lesen
    return { commandDown: false, keyIssue: false, revokeDown: false, statusReadDown: false, statusReadUp: up, configChange: false, hierarchyChange: false };
}

/** Maskiert sensible Werte für Anzeige (Token/Passwort nie im Klartext). */
function mask(s: string, showChars = 6): string {
    if (!s) return '(leer)';
    if (s.length <= showChars * 2) return '***';
    return s.slice(0, showChars) + '…' + s.slice(-2);
}

/** Alle Konfigurationswerte für Anzeige (Terminal/UI). Sensible Werte maskiert. */
export function getConfigDisplay(): Array<{ key: string; value: string; envKey: string }> {
    return [
        { key: 'RPC_URL', value: CFG.RPC_URL || '(default)', envKey: 'RPC_URL' },
        {
            key: 'RPC_URLS',
            value: CFG.RPC_URLS_EXTRA.length ? `${CFG.RPC_URLS_EXTRA.length} URL(s), Rotation: POST /api/rpc-rotate` : '(leer)',
            envKey: 'RPC_URLS',
        },
        { key: 'RPC_HTTP_PROXY', value: CFG.RPC_HTTP_PROXY ? mask(CFG.RPC_HTTP_PROXY, 14) : '(leer)', envKey: 'RPC_HTTP_PROXY' },
        { key: 'RPC_SOCKS_PROXY', value: CFG.RPC_SOCKS_PROXY ? mask(CFG.RPC_SOCKS_PROXY, 14) : '(leer)', envKey: 'RPC_SOCKS_PROXY' },
        { key: 'NETWORK_TRUST_TIER', value: String(CFG.NETWORK_TRUST_TIER) + ' (1=öffentlich … 3=eigener Node, Hinweis)', envKey: 'NETWORK_TRUST_TIER' },
        { key: 'PACKAGE_ID', value: CFG.PACKAGE_ID ? mask(CFG.PACKAGE_ID, 10) : '(leer)', envKey: 'PACKAGE_ID' },
        { key: 'PACKAGE_ID_FILE', value: process.env.PACKAGE_ID_FILE || '.morgendrot-package-id', envKey: 'PACKAGE_ID_FILE' },
        { key: 'VAULT_REGISTRY_ID', value: CFG.VAULT_REGISTRY_ID ? mask(CFG.VAULT_REGISTRY_ID, 8) : '(leer)', envKey: 'VAULT_REGISTRY_ID' },
        { key: 'MAILBOX_ID', value: CFG.MAILBOX_ID ? mask(CFG.MAILBOX_ID, 8) : '(leer)', envKey: 'MAILBOX_ID' },
        { key: 'MY_ADDRESS', value: CFG.MY_ADDRESS ? mask(CFG.MY_ADDRESS, 10) : '(leer)', envKey: 'MY_ADDRESS' },
        { key: 'PARTNER_ADDRESS', value: CFG.PARTNER_ADDRESS ? mask(CFG.PARTNER_ADDRESS, 8) : '(leer)', envKey: 'PARTNER_ADDRESS' },
        { key: 'PARTNER_ADDRESS_FILE', value: process.env.PARTNER_ADDRESS_FILE || '.morgendrot-partner', envKey: 'PARTNER_ADDRESS_FILE' },
        { key: 'PARTNER_ADDRESSES', value: CFG.PARTNER_ADDRESSES.length ? CFG.PARTNER_ADDRESSES.map((a) => mask(a, 6)).join(', ') : '(leer)', envKey: 'PARTNER_ADDRESSES' },
        { key: 'ENABLE_PAIRWISE_GROUPS', value: String(CFG.ENABLE_PAIRWISE_GROUPS), envKey: 'ENABLE_PAIRWISE_GROUPS' },
        { key: 'ENABLE_BROADCAST_PINNWAND', value: String(CFG.ENABLE_BROADCAST_PINNWAND), envKey: 'ENABLE_BROADCAST_PINNWAND' },
        { key: 'BROADCAST_PINNWAND_ADDRESS', value: CFG.BROADCAST_PINNWAND_ADDRESS ? mask(CFG.BROADCAST_PINNWAND_ADDRESS, 8) : '(leer)', envKey: 'BROADCAST_PINNWAND_ADDRESS' },
        { key: 'BROADCAST_AUTHORIZED_SENDERS', value: CFG.BROADCAST_AUTHORIZED_SENDERS.length ? CFG.BROADCAST_AUTHORIZED_SENDERS.map((a) => mask(a, 6)).join(', ') : '(leer)', envKey: 'BROADCAST_AUTHORIZED_SENDERS' },
        { key: 'BOSS_ADDRESS', value: CFG.BOSS_ADDRESS ? mask(CFG.BOSS_ADDRESS, 8) : '(leer)', envKey: 'BOSS_ADDRESS' },
        { key: 'KOMMANDANT_ADDRESSES', value: CFG.KOMMANDANT_ADDRESSES.length ? CFG.KOMMANDANT_ADDRESSES.map((a) => mask(a, 6)).join(', ') : '(leer)', envKey: 'KOMMANDANT_ADDRESSES' },
        { key: 'WORKER_ADDRESSES', value: CFG.WORKER_ADDRESSES.length ? CFG.WORKER_ADDRESSES.map((a) => mask(a, 6)).join(', ') : '(leer)', envKey: 'WORKER_ADDRESSES' },
        {
            key: 'DEVICE_ROLES',
            value: Object.keys(CFG.DEVICE_ROLES).length
                ? `${Object.keys(CFG.DEVICE_ROLES).length} Einträge (JSON)`
                : '(leer)',
            envKey: 'DEVICE_ROLES',
        },
        { key: 'DEVICE_NAMES', value: process.env.DEVICE_NAMES || '{}', envKey: 'DEVICE_NAMES' },
        { key: 'ROLE', value: CFG.ROLE, envKey: 'ROLE' },
        { key: 'ROLE_ID', value: String(CFG.ROLE_ID), envKey: 'ROLE_ID' },
        { key: 'ENABLE_COMMAND_DOWN', value: String(CFG.ENABLE_COMMAND_DOWN), envKey: 'ENABLE_COMMAND_DOWN' },
        { key: 'ENABLE_KEY_ISSUE', value: String(CFG.ENABLE_KEY_ISSUE), envKey: 'ENABLE_KEY_ISSUE' },
        { key: 'ENABLE_REVOKE_DOWN', value: String(CFG.ENABLE_REVOKE_DOWN), envKey: 'ENABLE_REVOKE_DOWN' },
        { key: 'ENABLE_STATUS_READ_DOWN', value: String(CFG.ENABLE_STATUS_READ_DOWN), envKey: 'ENABLE_STATUS_READ_DOWN' },
        { key: 'ENABLE_STATUS_READ_UP', value: String(CFG.ENABLE_STATUS_READ_UP), envKey: 'ENABLE_STATUS_READ_UP' },
        { key: 'ENABLE_CONFIG_CHANGE', value: String(CFG.ENABLE_CONFIG_CHANGE), envKey: 'ENABLE_CONFIG_CHANGE' },
        { key: 'ENABLE_HIERARCHY_CHANGE', value: String(CFG.ENABLE_HIERARCHY_CHANGE), envKey: 'ENABLE_HIERARCHY_CHANGE' },
        { key: 'LOCK_ID', value: CFG.LOCK_ID ? mask(CFG.LOCK_ID, 8) : '(leer)', envKey: 'LOCK_ID' },
        { key: 'DEFAULT_TTL_DAYS', value: String(CFG.DEFAULT_TTL_DAYS), envKey: 'DEFAULT_TTL_DAYS' },
        { key: 'DEFAULT_KEY_TTL_DAYS', value: String(CFG.DEFAULT_KEY_TTL_DAYS), envKey: 'DEFAULT_KEY_TTL_DAYS' },
        { key: 'LISTENER_POLL_MS', value: String(CFG.LISTENER_POLL_MS), envKey: 'LISTENER_POLL_MS' },
        { key: 'HANDSHAKE_REFRESH_MS', value: String(CFG.HANDSHAKE_REFRESH_MS), envKey: 'HANDSHAKE_REFRESH_MS' },
        { key: 'LOCK_PEER_REFRESH_MS', value: String(CFG.LOCK_PEER_REFRESH_MS), envKey: 'LOCK_PEER_REFRESH_MS' },
        { key: 'LOCK_COMMAND_POLL_MS', value: String(CFG.LOCK_COMMAND_POLL_MS), envKey: 'LOCK_COMMAND_POLL_MS' },
        { key: 'VAULT_FILE', value: CFG.VAULT_FILE || '(aus)', envKey: 'VAULT_FILE' },
        { key: 'USE_MAILBOX', value: String(CFG.USE_MAILBOX), envKey: 'USE_MAILBOX' },
        { key: 'LOG_VERBOSE', value: String(CFG.LOG_VERBOSE), envKey: 'LOG_VERBOSE' },
        { key: 'ENABLE_FILE_LOGGING', value: String(CFG.ENABLE_FILE_LOGGING), envKey: 'ENABLE_FILE_LOGGING' },
        { key: 'ENABLE_REPLAY_PROTECTION', value: String(CFG.ENABLE_REPLAY_PROTECTION), envKey: 'ENABLE_REPLAY_PROTECTION' },
        { key: 'ENABLE_HARDWARE_OPEN', value: String(CFG.ENABLE_HARDWARE_OPEN), envKey: 'ENABLE_HARDWARE_OPEN' },
        { key: 'ENABLE_PLAINTEXT_CHANNEL', value: String(CFG.ENABLE_PLAINTEXT_CHANNEL), envKey: 'ENABLE_PLAINTEXT_CHANNEL' },
        { key: 'MAILBOX_STORE_PLAINTEXT', value: String(CFG.MAILBOX_STORE_PLAINTEXT), envKey: 'MAILBOX_STORE_PLAINTEXT' },
        { key: 'ENABLE_PURGE', value: String(CFG.ENABLE_PURGE), envKey: 'ENABLE_PURGE' },
        { key: 'USE_ENCRYPTED_DISCOVERY', value: String(CFG.USE_ENCRYPTED_DISCOVERY), envKey: 'USE_ENCRYPTED_DISCOVERY' },
        { key: 'ENABLE_LISTENER', value: String(CFG.ENABLE_LISTENER), envKey: 'ENABLE_LISTENER' },
        { key: 'FETCH_LAST_ON_START', value: String(CFG.FETCH_LAST_ON_START), envKey: 'FETCH_LAST_ON_START' },
        { key: 'ENABLE_FETCH_COMMAND', value: String(CFG.ENABLE_FETCH_COMMAND), envKey: 'ENABLE_FETCH_COMMAND' },
        { key: 'ENABLE_AUTO_EXECUTE', value: String(CFG.ENABLE_AUTO_EXECUTE), envKey: 'ENABLE_AUTO_EXECUTE' },
        { key: 'AUTHORIZED_SENDERS', value: CFG.AUTHORIZED_SENDERS.length ? CFG.AUTHORIZED_SENDERS.map((a) => mask(a, 6)).join(', ') : '(leer)', envKey: 'AUTHORIZED_SENDERS' },
        { key: 'MAX_SEND_AMOUNT_IOTA', value: CFG.MAX_SEND_AMOUNT_IOTA || '(aus)', envKey: 'MAX_SEND_AMOUNT_IOTA' },
        { key: 'PAYMENT_TRIGGER_ENABLED', value: String(CFG.PAYMENT_TRIGGER_ENABLED), envKey: 'PAYMENT_TRIGGER_ENABLED' },
        { key: 'PAYMENT_TRIGGER_MIN_IOTA', value: CFG.PAYMENT_TRIGGER_MIN_IOTA || '(jede)', envKey: 'PAYMENT_TRIGGER_MIN_IOTA' },
        { key: 'PAYMENT_TRIGGER_POLL_MS', value: String(CFG.PAYMENT_TRIGGER_POLL_MS), envKey: 'PAYMENT_TRIGGER_POLL_MS' },
        { key: 'PAYMENT_TRIGGER_STATE_FILE', value: CFG.PAYMENT_TRIGGER_STATE_FILE || '(aus)', envKey: 'PAYMENT_TRIGGER_STATE_FILE' },
        { key: 'PAYMENT_TRIGGER_REQUIRE_MEMO', value: CFG.PAYMENT_TRIGGER_REQUIRE_MEMO ? '***' : '(aus)', envKey: 'PAYMENT_TRIGGER_REQUIRE_MEMO' },
        { key: 'ENABLE_HEARTBEAT', value: String(CFG.ENABLE_HEARTBEAT), envKey: 'ENABLE_HEARTBEAT' },
        { key: 'ENABLE_MONITOR', value: String(CFG.ENABLE_MONITOR), envKey: 'ENABLE_MONITOR' },
        { key: 'HEARTBEAT_INTERVAL_MS', value: String(CFG.HEARTBEAT_INTERVAL_MS), envKey: 'HEARTBEAT_INTERVAL_MS' },
        { key: 'MONITOR_DEVICES', value: CFG.MONITOR_DEVICES.length ? CFG.MONITOR_DEVICES.map((d) => mask(d, 6)).join(', ') : '(leer)', envKey: 'MONITOR_DEVICES' },
        { key: 'MONITOR_OFFLINE_TIMEOUT_MS', value: String(CFG.MONITOR_OFFLINE_TIMEOUT_MS), envKey: 'MONITOR_OFFLINE_TIMEOUT_MS' },
        { key: 'MONITOR_STATE_FILE', value: CFG.MONITOR_STATE_FILE || '(aus)', envKey: 'MONITOR_STATE_FILE' },
        { key: 'MONITOR_CHECK_INTERVAL_MS', value: String(CFG.MONITOR_CHECK_INTERVAL_MS), envKey: 'MONITOR_CHECK_INTERVAL_MS' },
        { key: 'MONITOR_ALARM_WEBHOOK_URL', value: CFG.MONITOR_ALARM_WEBHOOK_URL ? mask(CFG.MONITOR_ALARM_WEBHOOK_URL, 12) : '(aus)', envKey: 'MONITOR_ALARM_WEBHOOK_URL' },
        { key: 'ENABLE_CHAIN_ANCHOR', value: String(CFG.ENABLE_CHAIN_ANCHOR), envKey: 'ENABLE_CHAIN_ANCHOR' },
        { key: 'ANCHOR_INTERVAL_MS', value: String(CFG.ANCHOR_INTERVAL_MS), envKey: 'ANCHOR_INTERVAL_MS' },
        { key: 'LOG_MAX_FILES', value: String(CFG.LOG_MAX_FILES), envKey: 'LOG_MAX_FILES' },
        { key: 'LOG_MAX_SIZE', value: CFG.LOG_MAX_SIZE, envKey: 'LOG_MAX_SIZE' },
        { key: 'REPLAY_STATE_FILE', value: CFG.REPLAY_STATE_FILE || '(aus)', envKey: 'REPLAY_STATE_FILE' },
        { key: 'OPEN_COMMAND', value: CFG.OPEN_COMMAND ? mask(CFG.OPEN_COMMAND, 12) : '(leer)', envKey: 'OPEN_COMMAND' },
        { key: 'OPEN_URL', value: CFG.OPEN_URL ? mask(CFG.OPEN_URL, 14) : '(leer)', envKey: 'OPEN_URL' },
        { key: 'OPEN_COMMAND_WORDS', value: CFG.OPEN_COMMAND_WORDS.length ? CFG.OPEN_COMMAND_WORDS.join(', ') : 'open, öffnen', envKey: 'OPEN_COMMAND_WORDS' },
        { key: 'OPEN_COMMAND_LIST_FILE', value: CFG.OPEN_COMMAND_LIST_FILE || '(aus)', envKey: 'OPEN_COMMAND_LIST_FILE' },
        { key: 'OPEN_COMMAND_LIST_KEY', value: CFG.OPEN_COMMAND_LIST_KEY ? '***' : '(leer)', envKey: 'OPEN_COMMAND_LIST_KEY' },
        { key: 'COMMAND_REGISTRY_ID', value: CFG.COMMAND_REGISTRY_ID ? mask(CFG.COMMAND_REGISTRY_ID, 8) : '(leer)', envKey: 'COMMAND_REGISTRY_ID' },
        { key: 'EVENT_REGISTRY_ID', value: CFG.EVENT_REGISTRY_ID ? mask(CFG.EVENT_REGISTRY_ID, 8) : '(leer)', envKey: 'EVENT_REGISTRY_ID' },
        { key: 'OPEN_STREAMS_ENABLED', value: String(CFG.OPEN_STREAMS_ENABLED), envKey: 'OPEN_STREAMS_ENABLED' },
        { key: 'STREAMS_ANCHOR_ID', value: CFG.STREAMS_ANCHOR_ID || '(leer)', envKey: 'STREAMS_ANCHOR_ID' },
        { key: 'STREAMS_TOPIC', value: CFG.STREAMS_TOPIC || '(leer)', envKey: 'STREAMS_TOPIC' },
        { key: 'STREAMS_LISTEN_ENABLED', value: String(CFG.STREAMS_LISTEN_ENABLED), envKey: 'STREAMS_LISTEN_ENABLED' },
        { key: 'STREAMS_BRIDGE_URL', value: CFG.STREAMS_BRIDGE_URL || '(leer)', envKey: 'STREAMS_BRIDGE_URL' },
        { key: 'ENABLE_FACTORY_IO', value: String(CFG.ENABLE_FACTORY_IO), envKey: 'ENABLE_FACTORY_IO' },
        ...(CFG.ENABLE_FACTORY_IO
            ? [
                  { key: 'FACTORY_IO_URL', value: CFG.FACTORY_IO_URL || '(leer)', envKey: 'FACTORY_IO_URL' },
                  { key: 'FACTORY_IO_POLL_MS', value: String(CFG.FACTORY_IO_POLL_MS), envKey: 'FACTORY_IO_POLL_MS' },
              ]
            : []),
        { key: 'OFFLINE_OPEN_ENABLED', value: String(CFG.OFFLINE_OPEN_ENABLED), envKey: 'OFFLINE_OPEN_ENABLED' },
        { key: 'OFFLINE_CACHE_TTL_MS', value: String(CFG.OFFLINE_CACHE_TTL_MS), envKey: 'OFFLINE_CACHE_TTL_MS' },
        { key: 'OFFLINE_QUEUE_FILE', value: CFG.OFFLINE_QUEUE_FILE || '(aus)', envKey: 'OFFLINE_QUEUE_FILE' },
        { key: 'SIGNER', value: CFG.SIGNER, envKey: 'SIGNER' },
        { key: 'REMOTE_SIGNER_URL', value: CFG.REMOTE_SIGNER_URL ? mask(CFG.REMOTE_SIGNER_URL, 14) : '(leer)', envKey: 'REMOTE_SIGNER_URL' },
        { key: 'REMOTE_SIGNER_TOKEN', value: CFG.REMOTE_SIGNER_TOKEN ? '***' : '(leer)', envKey: 'REMOTE_SIGNER_TOKEN' },
        { key: 'BOSS_SIGNER_PUBLIC_URL', value: CFG.BOSS_SIGNER_PUBLIC_URL ? mask(CFG.BOSS_SIGNER_PUBLIC_URL, 18) : '(leer)', envKey: 'BOSS_SIGNER_PUBLIC_URL' },
        { key: 'WALLET_DERIVATION_PATH', value: CFG.WALLET_DERIVATION_PATH || '(default)', envKey: 'WALLET_DERIVATION_PATH' },
        { key: 'ENABLE_HD_CONTACT_ADDRESSES', value: CFG.ENABLE_HD_CONTACT_ADDRESSES ? 'true (Stub)' : 'false', envKey: 'ENABLE_HD_CONTACT_ADDRESSES' },
        { key: 'GAS_BUDGET', value: String(CFG.GAS_BUDGET), envKey: 'GAS_BUDGET' },
        { key: 'SPONSOR_GAS_OWNER', value: CFG.SPONSOR_GAS_OWNER ? mask(CFG.SPONSOR_GAS_OWNER, 10) : '(leer)', envKey: 'SPONSOR_GAS_OWNER' },
        { key: 'SPONSORED_TRANSACTION_ENABLED', value: String(CFG.SPONSORED_TRANSACTION_ENABLED), envKey: 'SPONSORED_TRANSACTION_ENABLED' },
        { key: 'MESSENGER_AUTO_SPONSOR', value: String(CFG.MESSENGER_AUTO_SPONSOR), envKey: 'MESSENGER_AUTO_SPONSOR' },
        {
            key: 'MESSENGER_LICENSE_NFT_OBJECT_ID',
            value: CFG.MESSENGER_LICENSE_NFT_OBJECT_ID || '(leer)',
            envKey: 'MESSENGER_LICENSE_NFT_OBJECT_ID',
        },
        {
            key: 'MESSENGER_CREDITS_OBJECT_ID',
            value: CFG.MESSENGER_CREDITS_OBJECT_ID || '(leer)',
            envKey: 'MESSENGER_CREDITS_OBJECT_ID',
        },
        {
            key: 'PAIRING_GATE_NFT_OBJECT_ID',
            value: CFG.PAIRING_GATE_NFT_OBJECT_ID || '(leer)',
            envKey: 'PAIRING_GATE_NFT_OBJECT_ID',
        },
        {
            key: 'VERIFIED_IOTA_NAME_PACKAGE_IDS',
            value: CFG.VERIFIED_IOTA_NAME_PACKAGE_IDS.length
                ? `${CFG.VERIFIED_IOTA_NAME_PACKAGE_IDS.length} Package-ID(s)`
                : '(leer)',
            envKey: 'VERIFIED_IOTA_NAME_PACKAGE_IDS',
        },
        {
            key: 'MESSENGER_GAS_STATE_FILE',
            value: (process.env.MESSENGER_GAS_STATE_FILE || '').trim() || '(default: .messenger-gas-state.json im cwd)',
            envKey: 'MESSENGER_GAS_STATE_FILE',
        },
        {
            key: 'IOTA_GAS_STATION_URL',
            value: CFG.IOTA_GAS_STATION_URL ? mask(CFG.IOTA_GAS_STATION_URL, 24) : '(leer)',
            envKey: 'IOTA_GAS_STATION_URL',
        },
        { key: 'SHADOW_SWEEP_GAS_RESERVE_MIST', value: String(CFG.SHADOW_SWEEP_GAS_RESERVE_MIST), envKey: 'SHADOW_SWEEP_GAS_RESERVE_MIST' },
        { key: 'GAS_STATION_ENABLED', value: String(CFG.GAS_STATION_ENABLED), envKey: 'GAS_STATION_ENABLED' },
        { key: 'GAS_STATION_MIN_IOTA', value: String(CFG.GAS_STATION_MIN_IOTA), envKey: 'GAS_STATION_MIN_IOTA' },
        { key: 'GAS_STATION_TOPUP_IOTA', value: String(CFG.GAS_STATION_TOPUP_IOTA), envKey: 'GAS_STATION_TOPUP_IOTA' },
        { key: 'AUDIT_STREAMS_ENABLED', value: String(CFG.AUDIT_STREAMS_ENABLED), envKey: 'AUDIT_STREAMS_ENABLED' },
        { key: 'BOSS_MULTISIG_THRESHOLD', value: String(CFG.BOSS_MULTISIG_THRESHOLD), envKey: 'BOSS_MULTISIG_THRESHOLD' },
        { key: 'IOTA_EUR_ORACLE_URL', value: CFG.IOTA_EUR_ORACLE_URL ? mask(CFG.IOTA_EUR_ORACLE_URL, 24) : '(leer)', envKey: 'IOTA_EUR_ORACLE_URL' },
        { key: 'ENABLE_UI', value: String(CFG.ENABLE_UI), envKey: 'ENABLE_UI' },
        { key: 'MESSENGER_EDITION', value: CFG.MESSENGER_EDITION, envKey: 'MESSENGER_EDITION' },
        { key: 'UI_VARIANT', value: CFG.UI_VARIANT, envKey: 'UI_VARIANT' },
        { key: 'SERVE_LITE_UI_STATIC', value: String(CFG.SERVE_LITE_UI_STATIC), envKey: 'SERVE_LITE_UI_STATIC' },
        { key: 'PAIRING_WAIT_TIMEOUT_MS', value: String(CFG.PAIRING_WAIT_TIMEOUT_MS), envKey: 'PAIRING_WAIT_TIMEOUT_MS' },
        { key: 'PAIRING_FIND_MAX_CANDIDATES', value: String(CFG.PAIRING_FIND_MAX_CANDIDATES), envKey: 'PAIRING_FIND_MAX_CANDIDATES' },
        { key: 'PAIRING_FIND_MAX_DECRYPT_ATTEMPTS', value: String(CFG.PAIRING_FIND_MAX_DECRYPT_ATTEMPTS), envKey: 'PAIRING_FIND_MAX_DECRYPT_ATTEMPTS' },
        { key: 'MORGENDROT_LITE_PACKAGE_ID', value: CFG.LITE_PRESET_PACKAGE_ID ? mask(CFG.LITE_PRESET_PACKAGE_ID, 12) : '(leer)', envKey: 'MORGENDROT_LITE_PACKAGE_ID' },
        { key: 'MORGENDROT_LITE_RPC_URL', value: CFG.LITE_PRESET_RPC_URL ? mask(CFG.LITE_PRESET_RPC_URL, 20) : '(leer → RPC_URL)', envKey: 'MORGENDROT_LITE_RPC_URL' },
        { key: 'UI_PORT', value: String(CFG.UI_PORT), envKey: 'UI_PORT' },
        { key: 'API_PORT', value: String(CFG.API_PORT), envKey: 'API_PORT' },
        { key: 'API_KILL_PREVIOUS_INSTANCE', value: String(CFG.API_KILL_PREVIOUS_INSTANCE), envKey: 'API_KILL_PREVIOUS_INSTANCE' },
        { key: 'ENABLE_VOUCHER_CLAIM_API', value: String(CFG.ENABLE_VOUCHER_CLAIM_API), envKey: 'ENABLE_VOUCHER_CLAIM_API' },
        { key: 'VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE', value: String(CFG.VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE), envKey: 'VOUCHER_CLAIM_RATE_LIMIT_PER_MINUTE' },
        { key: 'ENABLE_SHOP_API', value: String(CFG.ENABLE_SHOP_API), envKey: 'ENABLE_SHOP_API' },
        { key: 'SHOP_PUBLIC_BASE_URL', value: CFG.SHOP_PUBLIC_BASE_URL ? mask(CFG.SHOP_PUBLIC_BASE_URL, 16) : '(leer → http://127.0.0.1:UI_PORT)', envKey: 'SHOP_PUBLIC_BASE_URL' },
        { key: 'SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE', value: String(CFG.SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE), envKey: 'SHOP_CHECKOUT_RATE_LIMIT_PER_MINUTE' },
        { key: 'STRIPE_SECRET_KEY', value: CFG.STRIPE_SECRET_KEY ? mask(CFG.STRIPE_SECRET_KEY, 10) : '(leer)', envKey: 'STRIPE_SECRET_KEY' },
        { key: 'STRIPE_WEBHOOK_SECRET', value: CFG.STRIPE_WEBHOOK_SECRET ? mask(CFG.STRIPE_WEBHOOK_SECRET, 8) : '(leer)', envKey: 'STRIPE_WEBHOOK_SECRET' },
        { key: 'ENABLE_SHOP_CHAIN_MINT', value: String(CFG.ENABLE_SHOP_CHAIN_MINT), envKey: 'ENABLE_SHOP_CHAIN_MINT' },
        { key: 'SHOP_CLAIM_NOTIFY_WEBHOOK_URL', value: CFG.SHOP_CLAIM_NOTIFY_WEBHOOK_URL ? mask(CFG.SHOP_CLAIM_NOTIFY_WEBHOOK_URL, 20) : '(leer)', envKey: 'SHOP_CLAIM_NOTIFY_WEBHOOK_URL' },
        { key: 'SHOP_CLAIM_NOTIFY_SECRET', value: CFG.SHOP_CLAIM_NOTIFY_SECRET ? '***' : '(leer)', envKey: 'SHOP_CLAIM_NOTIFY_SECRET' },
    ];
}

/** Hardware-Typ für Provisioning: voller Node (Desktop/Server), Headless (Raspi), oder Tiny (nur Identity/Token, kein Node). */
export type HardwareType = 'desktop' | 'gateway' | 'tiny';

export interface DeviceProvisionParams {
    role: 'kommandant' | 'arbeiter' | 'lock' | 'monitor' | 'waerter' | 'user';
    roleId: number;
    deviceName?: string;
    address?: string;
    mnemonic?: string;
    bossAddress: string;
    kommandantAddresses?: string[];
    workerAddresses?: string[];
    packageId: string;
    rpcUrl: string;
    lockId?: string;
    openCommand?: string;
    closeCommand?: string;
    heartbeatIntervalMs?: number;
    enableHeartbeat?: boolean;
    signer?: 'cli' | 'sdk' | 'remote';
    remoteSigner?: string;
    /** Streams (für Arbeiter, Kommandant, Lock, Monitor). */
    streamsAnchorId?: string;
    streamsBridgeUrl?: string;
    /** Monitor: zu überwachende Geräte-IDs. */
    monitorDevices?: string[];
    /** Lock: Mailbox/Command-Registry. */
    mailboxId?: string;
    commandRegistryId?: string;
    /** Wärter: Boss zahlt Gas. */
    sponsorGasOwner?: string;
    /** Headless/Gateway/Tiny: ENABLE_UI=false in Ausgabe. */
    enableUi?: boolean;
    /** Hardware-Typ: desktop | gateway | tiny. */
    hardwareType?: HardwareType;
    /** Tiny: Gateway-URL (Raspi). */
    gatewayUrl?: string;
    /** Tiny: Geräte-Secret für HMAC (Base64, 32 Bytes). Wird in identity.h + Gateway-Config geschrieben. */
    deviceSecret?: string;
    /** User (nur NFT/QR): Objekt-ID des Tickets oder AccessKeys für QR/Explorer-Link. */
    ticketOrKeyObjectId?: string;
    /** Optional: Kontext nach Start (Kontakte, Tags) — siehe docs/API-INITIAL-PROFILE.md */
    initialProfile?: InitialProfile;
}

/** Nur vollständige Adressen/Objekt-IDs: 0x + 64 Hex (keine Kürzung mit …). */
export function filterFullChainAddresses(list: string[] | undefined): string[] {
    if (!Array.isArray(list)) return [];
    return list.map((s) => String(s).trim()).filter((a) => /^0x[a-fA-F0-9]{64}$/i.test(a));
}

export function isValidObjectId64(s: string | undefined): boolean {
    return /^0x[a-fA-F0-9]{64}$/i.test(String(s || '').trim());
}

export function buildDeviceEnv(p: DeviceProvisionParams): string {
    if (p.role === 'user') {
        return '# User (nur NFT/QR): Kein .env – nur QR/Explorer-Link für Ticket/Key.\n';
    }
    const kommFiltered = filterFullChainAddresses(p.kommandantAddresses);
    const workerFiltered = filterFullChainAddresses(p.workerAddresses);
    const hadKommInput = Array.isArray(p.kommandantAddresses) && p.kommandantAddresses.some((x) => String(x || '').trim());
    const hadWorkerInput = Array.isArray(p.workerAddresses) && p.workerAddresses.some((x) => String(x || '').trim());
    const anchorTrim = String(p.streamsAnchorId || '').trim();
    const anchorOk = isValidObjectId64(anchorTrim);
    const bridgeTrim = String(p.streamsBridgeUrl || '').trim();
    const heartbeatOk = !!p.enableHeartbeat && anchorOk;

    const headless = p.hardwareType === 'gateway' || p.hardwareType === 'tiny' || p.enableUi === false;
    const deviceName = p.deviceName || '';
    const lines: string[] = [
        '# ============================================================',
        '# Morgendrot Device Config – auto-generated',
        `# Role: ${p.role} | RoleID: ${p.roleId} | Name: ${deviceName || '(unnamed)'}`,
        `# Generated: ${new Date().toISOString()}`,
        '# ============================================================',
        '',
        '# --- Identity (Fingerabdruck: nur diese 3 anpassen für Raspi/Chip) ---',
        `ROLE=${p.role === 'waerter' ? 'messenger' : p.role}`,
        `ROLE_ID=${p.roleId}`,
        deviceName ? `DEVICE_NAME=${deviceName}` : '# DEVICE_NAME=  # z.B. Garagentor-Süd',
    ];
    if (p.address) lines.push(`MY_ADDRESS=${p.address}`);
    else lines.push('# MY_ADDRESS=  # wird bei Boss-Generierung oder Erststart gesetzt');
    if (p.mnemonic) {
        lines.push('', '# SECURITY: Remove after first start if using SIGNER=sdk');
        lines.push(`WALLET_MNEMONIC=${p.mnemonic}`);
    }
    lines.push('', '# --- Package ---', `PACKAGE_ID=${p.packageId}`);
    lines.push('', '# --- Chain ---', `RPC_URL=${p.rpcUrl || ''}`);
    lines.push('', '# --- Hierarchy ---', `BOSS_ADDRESS=${p.bossAddress}`);
    if (p.role === 'kommandant' && workerFiltered.length) {
        lines.push(`WORKER_ADDRESSES=${workerFiltered.join(',')}`);
    } else if (p.role === 'kommandant' && hadWorkerInput && !workerFiltered.length) {
        lines.push(
            '# WORKER_ADDRESSES=  # Keine gültige Adresse: nur vollständig 0x + 64 Hex (keine …-Kürzung). Einträge aus dem Wizard waren ungültig.'
        );
    }
    if ((p.role === 'arbeiter' || p.role === 'lock') && kommFiltered.length) {
        lines.push(`KOMMANDANT_ADDRESSES=${kommFiltered.join(',')}`);
    } else if ((p.role === 'arbeiter' || p.role === 'lock') && hadKommInput && !kommFiltered.length) {
        lines.push(
            '# KOMMANDANT_ADDRESSES=  # Keine gültige Adresse: nur vollständig 0x + 64 Hex (keine …-Kürzung). Boss-Adresse oben nutzen oder Zeile manuell korrekt setzen.'
        );
    }
    if (p.lockId || (p.role === 'lock' && p.address)) lines.push('', '# --- Lock / Hardware ---');
    if (p.lockId) lines.push(`LOCK_ID=${p.lockId}`);
    if (p.role === 'lock' && p.address && !p.lockId) lines.push(`LOCK_ID=${p.address}`);
    if (p.openCommand) lines.push(`OPEN_COMMAND=${p.openCommand}`);
    if (p.closeCommand) lines.push(`CLOSE_COMMAND=${p.closeCommand}`);
    if (p.role === 'lock' && p.mailboxId) lines.push(`MAILBOX_ID=${p.mailboxId}`);
    if (p.role === 'lock' && p.commandRegistryId) lines.push(`COMMAND_REGISTRY_ID=${p.commandRegistryId}`);
    if (p.role === 'monitor' && p.monitorDevices?.length) {
        const mon = filterFullChainAddresses(p.monitorDevices);
        if (mon.length) lines.push('', '# --- Monitor ---', `MONITOR_DEVICES=${mon.join(',')}`);
    }
    lines.push('', '# --- Streams ---');
    if (anchorOk) {
        lines.push(`STREAMS_ANCHOR_ID=${anchorTrim}`);
    } else if (anchorTrim) {
        lines.push(
            `# STREAMS_ANCHOR_ID=  # Ungültig (kein 0x+64Hex) – nicht übernommen. Echte Kanal-ID eintragen (z. B. vom Boss). Begann mit: ${anchorTrim.slice(0, 28)}…`
        );
    } else {
        lines.push('# STREAMS_ANCHOR_ID=  # Optional: Kanal-ID wenn Streams/Heartbeat genutzt werden.');
    }
    if (bridgeTrim) {
        lines.push(`STREAMS_BRIDGE_URL=${bridgeTrim}`);
        if (/127\.0\.0\.1|localhost/i.test(bridgeTrim)) {
            lines.push(
                '# Hinweis: 127.0.0.1 / localhost = nur dieser PC. Zweiter Rechner → IP/Hostname des Bridge-Hosts (z. B. http://192.168.1.10:9343).'
            );
        }
    } else {
        lines.push('# STREAMS_BRIDGE_URL=  # z. B. http://<Bridge-Host>:9343 – leer lassen wenn ohne Streams.');
    }
    if (p.role === 'kommandant') lines.push('VAULT_FILE=.morgendrot-vault');
    if (p.role === 'lock' && anchorOk) lines.push('STREAMS_LISTEN_ENABLED=true');
    lines.push('', '# --- Heartbeat ---');
    lines.push(`ENABLE_HEARTBEAT=${heartbeatOk ? 'true' : 'false'}`);
    if (p.enableHeartbeat && !anchorOk) {
        lines.push(
            '# Heartbeat ohne gültige STREAMS_ANCHOR_ID wäre fehleranfällig – ENABLE_HEARTBEAT=false. Nach echter Kanal-ID auf true setzen.'
        );
    }
    lines.push(`HEARTBEAT_INTERVAL_MS=${p.heartbeatIntervalMs || 30000}`);
    if (p.role === 'waerter' && p.sponsorGasOwner) {
        lines.push('', '# --- Wärter (Gas vom Boss) ---', `SPONSOR_GAS_OWNER=${p.sponsorGasOwner}`);
        lines.push('SPONSORED_TRANSACTION_ENABLED=true');
    }
    lines.push('', '# --- Signer ---');
    const signer = p.signer || 'cli';
    lines.push(`SIGNER=${signer}`);
    if (signer === 'remote') {
        if (p.remoteSigner?.trim()) lines.push(`REMOTE_SIGNER_URL=${p.remoteSigner.trim()}`);
        else {
            lines.push('# REMOTE_SIGNER_URL=http://<IP-des-Boss-PC>:3340/sign');
            lines.push('# Auf dem Boss: BOSS_SIGNER_PUBLIC_URL in .env = diese URL (erreichbar vom Gerät), dann Export erneuern.');
        }
    }
    lines.push('', '# --- Features ---');
    lines.push(headless ? 'ENABLE_UI=false' : 'ENABLE_UI=true');
    lines.push('ENABLE_PURGE=true');
    lines.push('ENABLE_REPLAY_PROTECTION=true');
    lines.push('ENABLE_PLAINTEXT_CHANNEL=true');
    if ((p.role === 'lock' || p.role === 'arbeiter') && headless) {
        lines.push('ENABLE_LISTENER=true');
        lines.push('ENABLE_AUTO_EXECUTE=true');
    }
    lines.push('');
    return lines.join('\n');
}

/** Nur Lite-Messenger (Desktop), kein Lock/Arbeiter-Rauschen – unabhängig vom Geräte-Provisioning-Wizard. */
export interface MessengerExportParams {
    deviceName?: string;
    address: string;
    packageId: string;
    rpcUrl: string;
    bossAddress: string;
    edition: 'standalone' | 'sales';
    signer?: 'sdk' | 'cli' | 'remote';
    remoteSignerUrl?: string;
    roleId?: number;
    mailboxId?: string;
    /** On-chain MessengerCredits-Objekt-ID (0x+64), nach Boss-Mint. */
    creditsObjectId?: string;
    /** Klartext in Mailbox speichern (purgebar). */
    mailboxStorePlaintext?: boolean;
    /** Ablauf Mailbox-Nachrichten/Handshake in Tagen (DEFAULT_TTL_DAYS). */
    exportTtlDays?: number;
}

/**
 * PACKAGE_ID für Messenger-Export: Boss-.env, freier Wert oder Eintrag aus lokaler ID-Historie.
 * historyFromNewest: 0 = jüngster Eintrag in der Historie, 1 = vorheriger, …
 */
export function resolveMessengerExportPackageId(opts: {
    source: 'boss' | 'custom' | 'history';
    customPackageId?: string;
    historyFromNewest?: number;
}): { ok: true; packageId: string } | { ok: false; error: string } {
    if (opts.source === 'custom') {
        const id = String(opts.customPackageId || '').trim();
        if (!PACKAGE_ID_REGEX.test(id)) return { ok: false, error: 'PACKAGE_ID: 0x + 64 Hex erforderlich.' };
        return { ok: true, packageId: normalizeId(id) };
    }
    if (opts.source === 'history') {
        const hist = readPackageIdHistory();
        if (!hist.length) return { ok: false, error: 'Keine Package-ID im lokalen Verlauf (.morgendrot-package-id-history).' };
        const fromNew = Math.max(0, Number(opts.historyFromNewest) || 0);
        const idx = hist.length - 1 - Math.min(fromNew, hist.length - 1);
        const id = hist[idx];
        return { ok: true, packageId: normalizeId(id) };
    }
    const id = String(CFG.PACKAGE_ID || '').trim();
    if (!PACKAGE_ID_REGEX.test(id)) return { ok: false, error: 'Boss PACKAGE_ID leer oder ungültig – setzen oder „custom“/„history“ wählen.' };
    return { ok: true, packageId: normalizeId(id) };
}

/** .env-Inhalt für exports/Morgendrot-Messenger-* (Kunde: ohne KOMMANDANT/LISTENER aus Arbeiter-Export). */
export function buildMessengerExportEnv(p: MessengerExportParams): string {
    const addr = normalizeAddress(String(p.address || '').trim());
    if (!/^0x[a-f0-9]{64}$/.test(addr)) throw new Error('MY_ADDRESS muss 0x + 64 Hex sein.');
    const pkg = String(p.packageId || '').trim();
    if (!PACKAGE_ID_REGEX.test(pkg)) throw new Error('PACKAGE_ID ungültig.');
    const boss = String(p.bossAddress || '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(boss)) throw new Error('BOSS_ADDRESS muss 0x + 64 Hex sein.');
    const edition = p.edition === 'sales' ? 'sales' : 'standalone';
    const signer = p.signer === 'cli' || p.signer === 'remote' ? p.signer : 'sdk';
    const roleId = typeof p.roleId === 'number' && Number.isFinite(p.roleId) ? p.roleId : 14;
    const lines: string[] = [
        '# ============================================================',
        '# Morgendrot Messenger – exportiert (Boss)',
        `# Edition: ${edition} | ${new Date().toISOString()}`,
        '# Kein Arbeiter/Lock-Template – nur Chat-Messenger.',
        '# ============================================================',
        '',
        'ENABLE_UI=true',
        'UI_VARIANT=messenger',
        `MESSENGER_EDITION=${edition}`,
        'ROLE=messenger',
        `ROLE_ID=${roleId}`,
        p.deviceName ? `DEVICE_NAME=${p.deviceName.replace(/\r\n/g, ' ').slice(0, 120)}` : '# DEVICE_NAME=',
        `MY_ADDRESS=${addr}`,
        '',
        `PACKAGE_ID=${normalizeId(pkg)}`,
        `RPC_URL=${String(p.rpcUrl || CFG.RPC_URL || '').trim() || 'https://api.testnet.iota.cafe'}`,
        '',
        `BOSS_ADDRESS=${normalizeAddress(boss)}`,
        '',
        '# --- Signer (Verkauf typ. sdk – Entsperren in der UI mit Mnemonic/Bech32-Secret vom Lieferanten) ---',
        `SIGNER=${signer}`,
    ];
    if (signer === 'remote') {
        const rsu = String(p.remoteSignerUrl || '').trim();
        if (rsu) lines.push(`REMOTE_SIGNER_URL=${rsu}`);
        else lines.push('# REMOTE_SIGNER_URL=http://<boss-lan-ip>:3340/sign');
    }
    const mb = String(p.mailboxId || CFG.MAILBOX_ID || '').trim();
    if (mb && /^0x[a-fA-F0-9]{64}$/i.test(mb)) {
        lines.push('', '# --- Optional Mailbox (wenn beim Deploy gesetzt) ---', `MAILBOX_ID=${normalizeAddress(mb)}`, 'USE_MAILBOX=true');
    }
    const cr = String(p.creditsObjectId || '').trim();
    if (cr && PACKAGE_ID_REGEX.test(cr)) {
        lines.push(
            '',
            '# --- Messenger-Credits (Prepaid, Boss-Mint) – nur mit Mailbox + Package mit *_with_credits ---',
            `MESSENGER_CREDITS_OBJECT_ID=${normalizeAddress(cr)}`
        );
    }
    if (p.mailboxStorePlaintext === true) {
        lines.push('', '# Klartext zusätzlich in Mailbox (purgebar; Move: store_plaintext_message_stored)', 'MAILBOX_STORE_PLAINTEXT=true');
    }
    if (typeof p.exportTtlDays === 'number' && Number.isFinite(p.exportTtlDays) && p.exportTtlDays >= 0 && p.exportTtlDays <= 3650) {
        lines.push(`DEFAULT_TTL_DAYS=${Math.max(0, Math.floor(p.exportTtlDays))}`);
    }
    lines.push(
        '',
        'API_KILL_PREVIOUS_INSTANCE=true',
        'NETWORK_TRUST_TIER=1',
        'ENABLE_PURGE=true',
        'ENABLE_REPLAY_PROTECTION=true',
        'ENABLE_PLAINTEXT_CHANNEL=true',
        '# ENABLE_LISTENER nicht setzen – reiner Messenger-Desktop',
        '',
        '# Streams: nur setzen wenn genutzt',
        '# STREAMS_ANCHOR_ID=',
        '# STREAMS_BRIDGE_URL=',
        'ENABLE_HEARTBEAT=false',
        ''
    );
    return lines.join('\n');
}

export function buildMessengerExportJson(p: MessengerExportParams): Record<string, unknown> {
    const addr = normalizeAddress(String(p.address || '').trim());
    return {
        kind: 'messenger',
        messengerEdition: p.edition,
        role: 'messenger',
        roleId: typeof p.roleId === 'number' ? p.roleId : 14,
        deviceName: p.deviceName || '',
        address: addr,
        packageId: normalizeId(String(p.packageId || '').trim()),
        rpcUrl: String(p.rpcUrl || '').trim(),
        bossAddress: normalizeAddress(String(p.bossAddress || '').trim()),
        signer: p.signer === 'cli' || p.signer === 'remote' ? p.signer : 'sdk',
        generatedAt: new Date().toISOString(),
        ...(p.creditsObjectId && PACKAGE_ID_REGEX.test(String(p.creditsObjectId).trim())
            ? { messengerCreditsObjectId: normalizeAddress(String(p.creditsObjectId).trim()) }
            : {}),
        ...(p.mailboxStorePlaintext === true ? { mailboxStorePlaintext: true } : {}),
        ...(typeof p.exportTtlDays === 'number' && Number.isFinite(p.exportTtlDays)
            ? { defaultTtlDays: Math.max(0, Math.floor(p.exportTtlDays)) }
            : {}),
    };
}

/** Öffentliche Parameter für „Wanderer“-Bundle (Next+PWA); keine Secrets (Roadmap § H.7). */
export interface StandaloneSmartphoneHandoffParams {
    rpcUrl: string;
    packageId: string;
    bossAddress: string;
    /** Komma/Leerzeichen/Semikolon-getrennte 0x-Adressen. */
    partnerAddresses?: string;
    mailboxId?: string;
    commandRegistryId?: string;
    vaultRegistryId?: string;
    nextPublicDirectIotaRpcUrl?: string;
}

function parseHandoffAddressList(raw: string | undefined, bossNorm: string): string[] {
    if (!raw?.trim()) return [];
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of parts) {
        const a = normalizeAddress(p);
        if (!ADDR_64_HEX.test(a)) continue;
        if (a === bossNorm) continue;
        if (seen.has(a)) continue;
        seen.add(a);
        out.push(a);
    }
    return out;
}

/**
 * Vorgefüllte `.env` für exports/morgendrot-standalone-smartphone (nach `npm run bundle:standalone-smartphone`).
 * MY_ADDRESS bleibt leer — Helfer richtet Wallet/Tresor nur auf dem Gerät ein.
 */
export function buildStandaloneSmartphoneHandoffEnv(p: StandaloneSmartphoneHandoffParams): string {
    const pkg = normalizeId(String(p.packageId || '').trim());
    if (!PACKAGE_ID_REGEX.test(pkg)) throw new Error('PACKAGE_ID ungültig (0x + 64 Hex).');
    const boss = normalizeAddress(String(p.bossAddress || '').trim());
    if (!ADDR_64_HEX.test(boss)) throw new Error('BOSS_ADDRESS muss 0x + 64 Hex sein.');
    const rpc = String(p.rpcUrl || '').trim() || 'https://api.testnet.iota.cafe';
    const mbRaw = String(p.mailboxId || '').trim();
    const mb = mbRaw && ADDR_64_HEX.test(normalizeAddress(mbRaw)) ? normalizeAddress(mbRaw) : '';
    const crRaw = String(p.commandRegistryId || '').trim();
    const cr = crRaw && ADDR_64_HEX.test(normalizeAddress(crRaw)) ? normalizeAddress(crRaw) : '';
    const vrRaw = String(p.vaultRegistryId || '').trim();
    const vr = vrRaw && ADDR_64_HEX.test(normalizeAddress(vrRaw)) ? normalizeAddress(vrRaw) : '';
    const direct = String(p.nextPublicDirectIotaRpcUrl || '').trim();
    const partners = parseHandoffAddressList(p.partnerAddresses, boss);
    const iso = new Date().toISOString();

    const lines: string[] = [
        '# =============================================================================',
        '# Morgendrot – Standalone Smartphone / PWA (Boss-Handoff, § H.7)',
        `# Erzeugt: ${iso}`,
        '# Nur öffentliche Werte — kein Seed, kein Vault-Passwort, keine .morgendrot-vault-Dateien.',
        '# =============================================================================',
        '',
        '# --- Netz & Package ---',
        `RPC_URL=${rpc}`,
        `PACKAGE_ID=${pkg}`,
    ];
    if (mb) {
        lines.push(`MAILBOX_ID=${mb}`, 'USE_MAILBOX=true');
    } else {
        lines.push('# MAILBOX_ID=', '# USE_MAILBOX=true');
    }
    if (cr) lines.push(`COMMAND_REGISTRY_ID=${cr}`);
    else lines.push('# COMMAND_REGISTRY_ID=');
    if (vr) lines.push(`VAULT_REGISTRY_ID=${vr}`);
    else lines.push('# VAULT_REGISTRY_ID=');
    lines.push('', '# --- Identität Helfer-Gerät (leer bis Tresor/Wallet auf dem Telefon) ---', 'MY_ADDRESS=', 'ROLE=messenger', 'ROLE_ID=14', '', `BOSS_ADDRESS=${boss}`, '');
    if (partners.length === 1) {
        lines.push(`PARTNER_ADDRESS=${partners[0]}`, '# PARTNER_ADDRESSES=');
    } else if (partners.length > 1) {
        lines.push(`PARTNER_ADDRESSES=${partners.join(',')}`, '# PARTNER_ADDRESS=');
    } else {
        lines.push(
            '# PARTNER_ADDRESS=',
            '# PARTNER_ADDRESSES=',
            '# Mindestens eine Partner-Adresse setzen (z. B. BOSS_ADDRESS hierher kopieren), sonst kein verschlüsselter Chat.'
        );
    }
    lines.push(
        '',
        '# =============================================================================',
        '# PWA / Next + API — wie bundle-standalone-smartphone Overrides',
        '# =============================================================================',
        'ENABLE_UI=true',
        'UI_VARIANT=full',
        'API_PORT=3342',
        'API_KILL_PREVIOUS_INSTANCE=true',
        'SIGNER=sdk',
        'NETWORK_TRUST_TIER=1',
        'ENABLE_PURGE=true',
        'ENABLE_REPLAY_PROTECTION=true',
        'ENABLE_PLAINTEXT_CHANNEL=false',
        ''
    );
    if (direct) {
        lines.push(`NEXT_PUBLIC_DIRECT_IOTA_RPC_URL=${direct}`, '');
    }
    return lines.join('\n');
}

export function buildStandaloneSmartphoneHandoffReadme(p: {
    handoffLabel?: string;
    createdAtIso: string;
    packageId: string;
    rpcUrl: string;
    bossAddress: string;
}): string {
    const label = (p.handoffLabel || '').trim() || '(ohne Bezeichnung)';
    return [
        'Morgendrot – Standalone-Smartphone-Handoff (Boss)',
        '================================================',
        '',
        `Bezeichnung: ${label}`,
        `Erzeugt: ${p.createdAtIso}`,
        '',
        'Inhalt dieses ZIP:',
        '  • morgendrot-standalone-handoff.env  – öffentliche .env-Zeilen',
        '  • README-HANDOFF.txt                 – diese Datei',
        '',
        'Voraussetzung: Im Haupt-Repository das Smartphone-Bundle gebaut haben:',
        '  npm run bundle:standalone-smartphone',
        '  → Ordner exports/morgendrot-standalone-smartphone/',
        '',
        'Ablauf für den Helfer (Medium ohne Geheimnisse):',
        '  1) Bundle-Ordner auf den PC des Helfers kopieren (oder als ZIP vom Boss).',
        '  2) Datei morgendrot-standalone-handoff.env aus diesem ZIP in das Bundle-Wurzelverzeichnis legen',
        '     und in .env umbenennen (vorher vorhandene .env aus npm install sichern, falls nötig).',
        '  3) Im Bundle-Root: npm install --omit=dev, dann cd frontend && npm install --omit=dev',
        '  4) npm run build:next && npm run start:prod:lan (oder dev:lan) — Details im Bundle-README.',
        '  5) Seed/Mnemonic und Vault-Passwort nur auf dem Telefon eingeben — nie auf dem USB mitliefern.',
        '',
        'Parameter in dieser Auslieferung (Kurz):',
        `  PACKAGE_ID=${p.packageId}`,
        `  RPC_URL=${p.rpcUrl}`,
        `  BOSS_ADDRESS=${p.bossAddress}`,
        '',
        'Kanonische Doku: docs/WANDERER-STANDALONE-BUNDLE.md und docs/ROADMAP-FAHRPLAN.md § H.7.',
        '',
    ].join('\n');
}

export function buildDeviceJson(p: DeviceProvisionParams): Record<string, unknown> {
    const kommFiltered = filterFullChainAddresses(p.kommandantAddresses);
    const workerFiltered = filterFullChainAddresses(p.workerAddresses);
    const anchorTrim = String(p.streamsAnchorId || '').trim();
    const anchorOk = isValidObjectId64(anchorTrim);
    const o: Record<string, unknown> = {
        role: p.role === 'waerter' ? 'messenger' : p.role,
        roleId: p.roleId,
        deviceName: p.deviceName || '',
        address: p.address || '',
        rpcUrl: p.rpcUrl,
        packageId: p.packageId,
        bossAddress: p.bossAddress,
        kommandantAddresses: kommFiltered,
        workerAddresses: workerFiltered,
        lockId: p.lockId || '',
        openCommand: p.openCommand || '',
        closeCommand: p.closeCommand || '',
        heartbeatIntervalMs: p.heartbeatIntervalMs || 30000,
        enableHeartbeat: !!p.enableHeartbeat && anchorOk,
        signer: p.signer || 'cli',
        remoteSigner: p.remoteSigner || '',
    };
    o.streamsAnchorId = anchorOk ? anchorTrim : '';
    o.streamsBridgeUrl = String(p.streamsBridgeUrl || '').trim();
    if (p.monitorDevices?.length) o.monitorDevices = filterFullChainAddresses(p.monitorDevices);
    if (p.mailboxId) o.mailboxId = p.mailboxId;
    if (p.commandRegistryId) o.commandRegistryId = p.commandRegistryId;
    if (p.sponsorGasOwner) o.sponsorGasOwner = p.sponsorGasOwner;
    if (p.hardwareType) o.hardwareType = p.hardwareType;
    if (p.gatewayUrl) o.gatewayUrl = p.gatewayUrl;
    if (p.initialProfile) o.initialProfile = p.initialProfile;
    return o;
}

export function buildQrPayload(p: DeviceProvisionParams): string {
    const ka = filterFullChainAddresses(p.kommandantAddresses);
    const wa = filterFullChainAddresses(p.workerAddresses);
    const compact: Record<string, unknown> = {
        r: p.role === 'waerter' ? 'messenger' : p.role,
        rid: p.roleId,
        ba: p.bossAddress,
        pkg: p.packageId,
        rpc: p.rpcUrl,
    };
    if (p.address) compact.a = p.address;
    if (p.lockId) compact.lid = p.lockId;
    if (ka.length) compact.ka = ka;
    if (wa.length) compact.wa = wa;
    return JSON.stringify(compact);
}

/** Generiert ein kryptographisch starkes Geräte-Secret (32 Bytes, Base64) für Tiny HMAC. */
export function generateDeviceSecret(): string {
    return randomBytes(32).toString('base64');
}

/**
 * Erzeugt C-Header-Inhalt für Tiny-Arbeiter (identity.h).
 * Nur Gateway-/Bridge-Identität: DEVICE_ID, ROLE_ID, GATEWAY_URL, DEVICE_SECRET (HMAC).
 * Kein IOTA-Rebased-On-Chain-Client auf dem Chip – kein PACKAGE_ID/RPC hier; kein privater Chain-Key.
 */
export function buildIdentityHeader(p: DeviceProvisionParams): string {
    const deviceId = p.deviceName || p.address?.slice(0, 18) || 'tiny';
    const lines: string[] = [
        '/*',
        ' * Morgendrot Tiny – identity.h (auto-generated)',
        ' *',
        ' * Gateway / Bridge identity only – NOT an IOTA Rebased chain client.',
        ' * RPC_URL, PACKAGE_ID, signing: live on the gateway .env (Node/Morgendrot), not here.',
        ' * DEVICE_SECRET: Base64 32-byte HMAC key; treat as confidential; rotate if leaked.',
        ' * No private on-chain key in this header.',
        ' */',
        `#ifndef MORGENDROT_IDENTITY_H`,
        `#define MORGENDROT_IDENTITY_H`,
        '',
        `#define MORGENDROT_DEVICE_ID "${deviceId.replace(/"/g, '\\"')}"`,
        `#define MORGENDROT_ROLE_ID ${p.roleId}`,
        `#define MORGENDROT_GATEWAY_URL "${(p.gatewayUrl || '').replace(/"/g, '\\"')}"`,
        '',
        '/* Base64-encoded 32-byte secret for HMAC (authenticate to gateway). */',
        `#define MORGENDROT_DEVICE_SECRET "${(p.deviceSecret || '').replace(/"/g, '\\"')}"`,
        '',
        `#endif /* MORGENDROT_IDENTITY_H */`,
    ];
    return lines.join('\n');
}
