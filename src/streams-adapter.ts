/**
 * Streams-Adapter – abstrakte Schnittstelle für IOTA-Streams-ähnlichen Transport.
 * Echte Streams-SDK ist archiviert (nicht Rebased-kompatibel). Hier: Interface + Stub + optionale HTTP-Bridge.
 * Austauschbar: eigener Streams-Client oder Bridge-Service.
 */
import { randomUUID } from 'node:crypto';
import { CFG } from './config.js';
import { logger } from './logger.js';
import { encryptUtf8ToPayload, decryptPayloadToUtf8 } from './vault-local.js';

export interface StreamsMessage {
    sender?: string;
    payload: string;
    nonce?: number;
    ts?: number;
}

export interface IStreamsAdapter {
    /** Hört auf eingehende Nachrichten am Kanal. Ruft onMessage bei jeder Nachricht. */
    startListening(anchorId: string, onMessage: (msg: StreamsMessage) => void): void;
    /** Veröffentlicht Nachricht auf Kanal. */
    publish(anchorId: string, payload: string): Promise<void>;
}

/** Stub: macht nichts, nur Log. Ersetze durch echte Implementierung. */
class StubStreamsAdapter implements IStreamsAdapter {
    startListening(_anchorId: string, _onMessage: (msg: StreamsMessage) => void): void {
        logger.info('Streams (Stub): startListening – keine echte Implementierung. STREAMS_BRIDGE_URL setzen oder Adapter ersetzen.');
    }
    async publish(anchorId: string, payload: string): Promise<void> {
        logger.info(`Streams (Stub): publish würde an ${anchorId.slice(0, 12)}… senden: ${payload.slice(0, 50)}…`);
    }
}

/** HTTP-Bridge: pollt URL für Nachrichten. Erwartet JSON-Array von {sender, payload, nonce}. */
class HttpStreamsBridgeAdapter implements IStreamsAdapter {
    private url: string;
    private anchorId: string = '';
    private onMessage: ((msg: StreamsMessage) => void) | null = null;
    private seenKeys = new Set<string>();
    private pollMs = 3000;

    constructor(url: string) {
        this.url = url.replace(/\/$/, '');
    }

    startListening(anchorId: string, onMessage: (msg: StreamsMessage) => void): void {
        this.anchorId = anchorId;
        this.onMessage = onMessage;
        this.pollLoop();
    }

    private static readonly FETCH_TIMEOUT_MS = 20_000;

    private async pollLoop(): Promise<void> {
        while (this.onMessage) {
            try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), HttpStreamsBridgeAdapter.FETCH_TIMEOUT_MS);
                const res = await fetch(`${this.url}?anchor=${encodeURIComponent(this.anchorId)}`, { signal: ctrl.signal }).finally(() => clearTimeout(t));
                if (!res.ok) throw new Error(`${res.status}`);
                const data = (await res.json()) as { messages?: StreamsMessage[] } | StreamsMessage[];
                const list = Array.isArray(data) ? data : data?.messages ?? [];
                for (const msg of list) {
                    const key = `${msg.sender ?? '?'}:${msg.nonce ?? msg.ts ?? randomUUID()}`;
                    if (this.seenKeys.has(key)) continue;
                    this.seenKeys.add(key);
                    this.onMessage?.(msg);
                }
            } catch (e) {
                if (CFG.LOG_VERBOSE) logger.warn('Streams-Bridge Poll: ' + (e as Error)?.message);
            }
            await new Promise((r) => setTimeout(r, this.pollMs));
        }
    }

    async publish(anchorId: string, payload: string): Promise<void> {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), HttpStreamsBridgeAdapter.FETCH_TIMEOUT_MS);
        const res = await fetch(this.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ anchor: anchorId, payload }),
            signal: ctrl.signal,
        }).finally(() => clearTimeout(t));
        if (!res.ok) throw new Error(`Streams-Bridge publish: ${res.status}`);
    }
}

let _adapter: IStreamsAdapter | null = null;
let _adapterUrl: string | null = null;

/** Liefert den konfigurierten Streams-Adapter (Stub oder HTTP-Bridge). Erstellt neu, wenn sich STREAMS_BRIDGE_URL geändert hat. */
export function getStreamsAdapter(): IStreamsAdapter {
    const currentUrl = (CFG.STREAMS_BRIDGE_URL || '').trim().replace(/\/$/, '') || null;
    if (_adapter && _adapterUrl !== currentUrl) {
        _adapter = null;
        _adapterUrl = null;
    }
    if (!_adapter) {
        _adapterUrl = currentUrl;
        _adapter = currentUrl && (currentUrl.startsWith('http://') || currentUrl.startsWith('https://'))
            ? new HttpStreamsBridgeAdapter(currentUrl)
            : new StubStreamsAdapter();
    }
    return _adapter;
}

/** Setzt einen benutzerdefinierten Adapter (z. B. eigener Streams-Client). */
export function setStreamsAdapter(adapter: IStreamsAdapter | null): void {
    _adapter = adapter;
}

/**
 * Payload AES-256-GCM verschlüsseln (base64-Transport-Encoding).
 * Gleiche Krypto wie Vault – PBKDF2-310k + AES-GCM-256.
 */
export async function encryptStreamPayload(payload: string, password: string): Promise<string> {
    const encrypted = await encryptUtf8ToPayload(payload, password);
    return Buffer.from(encrypted).toString('base64');
}

/**
 * Base64-codierten AES-GCM-Payload entschlüsseln.
 * Wirft bei falschem Key / korrupten Daten.
 */
export async function decryptStreamPayload(encrypted: string, password: string): Promise<string> {
    const raw = Buffer.from(encrypted, 'base64');
    return decryptPayloadToUtf8(new Uint8Array(raw), password);
}
