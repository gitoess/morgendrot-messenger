/**
 * Deterministisches Wizard-Slot-Filling: Prüft fehlende Pflichtfelder und baut finalen Befehl.
 * Kein LLM – für 90–98 % Trefferquote bei vorgegebenen Wizard-Pfaden.
 * Nutzung: UI oder Test ruft getWizardSlotFillingResult(tileId, action, state).
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

type WizardCommand = {
    cmd: string;
    params?: string[];
    slot_schema?: Record<string, { required?: boolean; type?: string; default?: number }>;
};
type WizardTile = { id: string; commands: WizardCommand[] };
type WizardConfig = { tiles: WizardTile[] };

let cache: WizardConfig | null = null;

function loadWizard(): WizardConfig | null {
    if (cache) return cache;
    const p = join(root, 'ai-training', 'wizard-commands.json');
    if (!existsSync(p)) return null;
    try {
        cache = JSON.parse(readFileSync(p, 'utf8')) as WizardConfig;
        return cache;
    } catch {
        return null;
    }
}

/** Param-Reihenfolge für Backend (string[]). */
const CMD_ARG_ORDER: Record<string, string[]> = {
    '/create-key': ['lock', 'recipient', 'ttl_days'],
    '/create-keys': ['lock', 'recipient', 'ttl_days', 'count'],
    '/create-key-and-notify': ['lock', 'recipient', 'ttl_days', 'message_text'],
    '/send-plain': ['recipient', 'message_text'],
    '/send': ['message_text'],
    '/transfer-coins': ['recipient', 'amount_iota'],
    '/handshake': ['recipient'],
    '/connect': ['recipient_optional'],
    '/fetch': ['count', 'sender_optional'],
    '/list-keys': [],
    '/list-tickets': [],
    '/purge-key': ['key_id'],
    '/purge-keys': ['key_id_list'],
    '/create-ticket': ['event_id', 'valid_from_ms', 'valid_until_ms', 'metadata_hex', 'recipient'],
    '/use-ticket': ['ticket_id', 'event_id'],
    '/purge-ticket': ['ticket_id'],
    '/transfer-key': ['key_id', 'new_owner'],
    '/transfer-ticket': ['ticket_id', 'new_owner'],
    '/set-package-id': ['package_id'],
    '/vault-save': [],
    '/vault-onchain': [],
    '/purge-handshake': [],
    '/purge-msg': ['nonce', 'sender_optional'],
    '/emergency-purge': [],
    '/emergency-purge-key': ['key_id'],
    '/emergency-purge-ticket': ['ticket_id'],
    '/help': [],
    '/exit': [],
};

/** Prüft ob ein Param als Pflichtfeld gilt (Name ohne _optional). */
function isRequiredParam(name: string): boolean {
    return !name.endsWith('_optional') && name !== 'count_optional' && name !== 'ttl_days_optional';
}

export type WizardSlotResult =
    | { done: true; action: string; args: string[]; message?: string }
    | { done: false; message: string; awaiting: string };

/**
 * Deterministisches Slot-Filling: state = Objekt mit Slot-Namen → Wert.
 * Gibt zurück: entweder fertigen Befehl (done: true) oder nächste Frage (done: false, awaiting).
 */
export function getWizardSlotFillingResult(
    tileId: string,
    action: string,
    state: Record<string, string | number | undefined>,
): WizardSlotResult {
    const w = loadWizard();
    if (!w?.tiles?.length) return { done: false, message: 'Wizard-Konfiguration nicht geladen.', awaiting: '' };

    const tile = w.tiles.find((t) => t.id === tileId);
    if (!tile) return { done: false, message: 'Unbekannte Kachel.', awaiting: '' };

    const cmdEntry = tile.commands.find((c) => c.cmd === action);
    if (!cmdEntry) return { done: false, message: 'Befehl nicht in dieser Kachel.', awaiting: '' };

    const paramOrder = CMD_ARG_ORDER[action] ?? cmdEntry.params ?? [];
    const required = (cmdEntry.params ?? paramOrder).filter((p) => isRequiredParam(p));

    const missing = required.filter((name) => {
        const v = state[name];
        return v === undefined || v === null || String(v).trim() === '';
    });

    if (missing.length > 0) {
        const name = missing[0];
        const labels: Record<string, string> = {
            lock: 'Schloss/Lock (0x…)',
            recipient: 'Empfänger (0x…)',
            ttl_days: 'Gültigkeit in Tagen',
            count: 'Anzahl',
            message_text: 'Nachrichtentext',
            amount_iota: 'Betrag (IOTA)',
            key_id: 'Key-Objekt-ID (0x…)',
            ticket_id: 'Ticket-Objekt-ID (0x…)',
            event_id: 'Event-ID (0x…)',
            package_id: 'Package-ID (0x…)',
        };
        return {
            done: false,
            message: `Bitte gib ${labels[name] ?? name} an.`,
            awaiting: name,
        };
    }

    const args = paramOrder
        .filter((p) => state[p] !== undefined && state[p] !== null)
        .map((p) => String(state[p] ?? '').trim())
        .filter(Boolean);
    return {
        done: true,
        action,
        args,
        message: `Befehl bereit: ${action} ${args.join(' ')}`,
    };
}
