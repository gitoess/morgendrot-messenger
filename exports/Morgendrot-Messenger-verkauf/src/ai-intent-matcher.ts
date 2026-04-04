/**
 * Optionaler Intent-Matcher (Variante 1): Kein LLM, nur Beispielphrasen + Ähnlichkeit.
 * ENABLE_AI_INTENT_MATCHER=true. Kann parallel zu Ollama und/oder Fetch genutzt werden.
 * Klein (<1 MB), schnell, für Industrie zertifizierbar.
 */
import type { AiCopilotResult } from './ai-copilot.js';

const ADDR = '0x[a-fA-F0-9]{64}';

function tokenize(s: string): string[] {
    return (s.toLowerCase().trim().replace(/\s+/g, ' ').split(/\s+/)).filter(Boolean);
}

/** Einfache Ähnlichkeit: Jaccard-ähnlich (Schnitt / Vereinigung der Tokens). */
function similarity(a: string, b: string): number {
    const ta = new Set(tokenize(a));
    const tb = new Set(tokenize(b));
    if (ta.size === 0 && tb.size === 0) return 1;
    let inter = 0;
    for (const t of ta) {
        if (tb.has(t)) inter++;
    }
    const un = ta.size + tb.size - inter;
    return un === 0 ? 0 : inter / un;
}

/** Findet erste 0x…-Adresse im Text. */
function extractAddress(msg: string): string | null {
    const m = msg.match(new RegExp(ADDR));
    return m ? m[0] : null;
}

/** Erkennt "X IOTA/Coins an 0x… senden" → kein /connect, sondern /transfer-coins. */
export function isTransferCoinsIntent(msg: string): boolean {
    return /\d+(?:\.\d+)?\s*(?:iota|miota|coins?)\s|(?:iota|coins?)\s*an\s+0x|überweis(e|ung)?\s+\d+/i.test(msg);
}

/** Nur Transfer-Coins-Phrase erkennen (für Fallback, wenn Intent-Checkbox aus). */
export function tryTransferCoinsOnly(msg: string): AiCopilotResult | null {
    const m = (msg || '').trim();
    if (!m || !isTransferCoinsIntent(m)) return null;
    const addrs = m.match(new RegExp(ADDR, 'g'));
    const num = m.match(/(\d+(?:\.\d+)?)\s*(?:iota|miota|i)?/i) || m.match(/(\d+(?:\.\d+)?)/);
    if (!addrs?.length || !num) return null;
    return {
        ok: true,
        text: 'Befehl erkannt. Du kannst unten „Ja, ausführen“ wählen.',
        suggestedAction: { cmd: '/transfer-coins', args: [addrs[0], num[1]] },
    };
}

const LOCK_ID_PLACEHOLDER = '<LOCK_ID>';

/** Adresse 0x + 64 Hex oder Objekt-ID 0x + Hex (kürzer). */
function extractObjectId(msg: string): string | null {
    const m = msg.match(/0x[a-fA-F0-9]{64}/) || msg.match(/0x[a-fA-F0-9]+/);
    return m ? m[0] : null;
}

/** Alle 0x-IDs (64 Hex oder kürzer hex/alphanumerisch für Key/Ticket-IDs). Trailing-Punktion entfernt. */
function extractAllObjectIds(msg: string): string[] {
    const primary =
        msg.match(/0x[a-fA-F0-9]{64}/g) ?? msg.match(/0x[a-fA-F0-9]+/g) ?? msg.match(/0x[0-9a-zA-Z]+/g);
    let raw: string[] = primary ?? [];
    if (raw.length < 2) {
        const alt = msg.match(/0x[a-zA-Z0-9]+/g);
        if (alt?.length) raw = alt;
    }
    return raw.map((id) => id.replace(/[.,;:]$/, ''));
}

/** Anführungszeichen: gerade (" ') und typografisch (" "). */
const QUOTE = ['"', "'", '\u201C', '\u201D', '\u201E', '\u201F'];
const QUOTE_CLASS = `["'\u201C\u201D\u201E\u201F]`;
const QUOTED_CONTENT = `[^"'\u201C\u201D\u201E\u201F]*`;

/** Intent: "sende verschlüsselt X an 0xADDR" → zuerst /handshake (Dataset: Handshake vor Connect). */
function matchSendEncryptedTo(msg: string): AiCopilotResult | null {
    if (isTransferCoinsIntent(msg)) return null;
    const lower = msg.toLowerCase();
    const sendLike = /sende|schick|verschlüsselt|nachricht\s+an|nachricht\s+senden/.test(lower);
    if (!sendLike) return null;
    const addr = extractAddress(msg);
    if (!addr) return null;
    const normalized = msg.replace(/\s+/g, ' ').trim();
    const patterns: Array<RegExp | { regex: RegExp; group: number }> = [
        { regex: new RegExp(`sende\\s+nachricht\\s+${QUOTE_CLASS}(${QUOTED_CONTENT})${QUOTE_CLASS}\\s+an\\s+0x`, 'i'), group: 1 },
        { regex: /sende\s+nachricht\s+"([^"]*)"\s+an\s+0x/i, group: 1 },
        { regex: /sende\s+nachricht\s+'([^']*)'\s+an\s+0x/i, group: 1 },
        { regex: /sende\s+nachricht\s+(.+?)\s+an\s+0x/i, group: 1 },
        /sende\s+verschlüsselt\s+(.+?)\s+an\s+0x/i,
        /schick\s+verschlüsselt\s+(.+?)\s+an\s+0x/i,
        /verschlüsselt\s+(.+?)\s+an\s+0x/i,
        /sende\s+(.+?)\s+an\s+0x/i,
        /schick\s+(.+?)\s+an\s+0x/i,
        /nachricht\s+(.+?)\s+an\s+0x/i,
    ];
    let text = '';
    for (const p of patterns) {
        const regex = typeof p === 'object' && 'regex' in p ? p.regex : p;
        const group = typeof p === 'object' && 'group' in p ? p.group : 1;
        const m = normalized.match(regex);
        if (m && m[group]) { text = m[group].trim(); break; }
    }
    if (!text) {
        const afterAddr = normalized.split(addr)[1]?.trim();
        const beforeAddr = normalized.split(addr)[0]?.trim();
        if (afterAddr) text = afterAddr;
        else if (beforeAddr) text = beforeAddr.replace(/^(sende|schick|verschlüsselt|nachricht)\s+/i, '').trim();
    }
    const message = text || 'Nachricht';
    return {
        ok: true,
        text: `Zuerst sichere Leitung: Handshake (unten „Ja, ausführen“). Partner führt danach /connect aus. Dann \`/send ${message}\`.`,
        suggestedAction: { cmd: '/handshake', args: [addr] },
    };
}

/** Klartext an 0x senden – vor verschlüsselt prüfen. */
function matchSendPlainTo(msg: string): AiCopilotResult | null {
    const lower = msg.toLowerCase();
    if (!/klartext|unverschlüsselt|ohne\s+handshake|send[- ]?plain|sag\s+0x|bescheid\s*:|broadcast\s+nachricht|pinnwand/i.test(lower)) return null;
    const addr = extractAddress(msg);
    if (!addr) return null;
    const normalized = msg.replace(/\s+/g, ' ').trim();
    let text = 'Nachricht';
    // "unverschlüsselte nachricht [ohne handshake] \"...\" an 0x" – optional Leerzeichen zwischen Anführungszeichen und "an"
    const unverschQuote = normalized.match(/(?:sende|schick)\s+unverschlüsselt(?:e)?\s+nachricht\s+(?:ohne\s+handshake\s+)?["'\u201C\u201D]([^"'\u201C\u201D]*)["'\u201C\u201D]\s*an\s+0x/i);
    if (unverschQuote?.[1] !== undefined) text = unverschQuote[1].trim();
    else {
        const m = normalized.match(/klartext\s+(.+?)\s+an\s+0x/i) || normalized.match(/sag\s+0x[^\s]+\s+bescheid\s*:\s*(.+)/i) || normalized.match(/schick\s+klartext\s+(.+?)\s+an\s+0x/i);
        if (m?.[1]) text = m[1].trim();
        else {
            const after = normalized.split(addr)[1]?.trim();
            if (after) text = after.replace(/^(bescheid\s*:?|:)\s*/i, '').trim();
        }
    }
    if (!text) text = 'Nachricht';
    return { ok: true, text: 'Klartext wird on-chain sichtbar.', suggestedAction: { cmd: '/send-plain', args: [addr, text.slice(0, 500)] } };
}

type IntentRuleOut = { cmd: string; args: string[]; text?: string } | { textOnly: true; text: string };
type IntentRule = {
    examples: string[];
    run: (msg: string) => IntentRuleOut | null;
};

const INTENTS: IntentRule[] = [
    {
        examples: ['es geht nicht rpc ist rot', 'rpc ist rot', 'verbindung schlägt fehl', 'backend nicht bereit', 'create-key schlägt fehl', 'kann nicht senden', 'ich will verschlüsselt schreiben aber es kommt fehler'],
        run: (msg) => {
            const lower = msg.toLowerCase();
            if (/rpc|rot|es geht nicht/.test(lower))
                return { textOnly: true, text: 'Prüfe Säule 1 (Fundament): Ist RPC_URL erreichbar? In der UI „KI-Check“ oder „Kette erreichbar“ testen. MY_ADDRESS und PACKAGE_ID müssen gesetzt sein. Ohne Säule 1 funktioniert nichts.' };
            if (/verbindung\s+schlägt|fehl/.test(lower))
                return { textOnly: true, text: 'Säule 1 prüfen: MY_ADDRESS gesetzt? PACKAGE_ID gesetzt? RPC_URL erreichbar (z.B. /api/chain-reachable)? Wallet entsperrt? Danach Säule 2 (Handshake/Connect).' };
            if (/verschlüsselt.*fehler|fehler.*verschlüsselt/.test(lower))
                return { textOnly: true, text: 'Verschlüsselte Nachricht braucht Säule 2: Zuerst /handshake an Partner, Partner führt /connect aus. Danach /send <Text>. Prüfe: Bist du verbunden (🟢)?' };
            if (/backend nicht bereit/.test(lower))
                return { textOnly: true, text: 'Säule 1: App vollständig starten (npm run dev), Wallet entsperren, MY_ADDRESS und PACKAGE_ID setzen. In der UI: Säule 1 „Anfang & Verbindung“ prüfen.' };
            if (/create-key schlägt|schlägt fehl/.test(lower))
                return { textOnly: true, text: 'Säule 1 prüfen: MY_ADDRESS, PACKAGE_ID gesetzt? RPC erreichbar? Wallet entsperrt? Dann LOCK_ID (oft = MY_ADDRESS). Bei weiterem Fehler: /help und Logs prüfen.' };
            if (/kann nicht senden/.test(lower))
                return { textOnly: true, text: 'Verschlüsselt senden braucht Säule 2: Zuerst /handshake, Partner /connect. Prüfe in der UI: Verbunden (🟢)? Dann /send <Text>.' };
            return null;
        },
    },
    {
        examples: ['was sind die 13 schritte', 'erste schritte', 'schnellstart', 'was kann ich alles machen', 'wo steht was zu mailbox', 'hilfe', 'wie richte ich alles ein', 'wallet entsperren', 'wallet entsperren?', 'my_address setzen', 'was brauche ich für verschlüsselte nachricht', 'brauche ich connect für transfer-coins', 'wie viele schritte hat chat', 'sende 1 iota gib key und ticket alles in einer tx', 'es gibt keine tx für iota'],
        run: (msg) => {
            const lower = msg.toLowerCase();
            if (/^hilfe$|wie richte ich alles ein|wallet entsperren\??|my_address setzen|was brauche ich für verschlüsselte|brauche ich connect für transfer-coins\??|wie viele schritte|es gibt keine\s+tx\s+für\s+iota/i.test(lower))
                return { textOnly: true, text: '/help zeigt alle Befehle. Säule 1: MY_ADDRESS, PACKAGE_ID, RPC. Säule 2: Handshake/Connect für verschlüsselt. transfer-coins braucht keinen Connect.' };
            if (/13\s*schritte|schritte/.test(lower))
                return { textOnly: true, text: 'Chat: 1 MY_ADDRESS 2 PACKAGE_ID 3 RPC/Netzwerk 4 Klartext ja/nein 5 Partner 6 Empfänger 7 STREAMS/MAILBOX 8 Handshake vs Connect 9 /send 10 /fetch 11 Vault 12 Purge/FETCH_LAST 13 Optionen. Immer Säule 1→2→3→4.' };
            if (/erste schritte|schnellstart|einrichtung|wie fange ich an/.test(lower))
                return { textOnly: true, text: 'Säule 1: MY_ADDRESS und PACKAGE_ID setzen, RPC prüfen. Säule 2: Partner eintragen, /handshake dann Partner macht /connect. Säule 3: /send oder /fetch. Säule 4: /vault-save, Purge. Start: /set-package-id 0x… und Wallet entsperren.' };
            if (/was kann ich|alles machen/.test(lower))
                return { textOnly: true, text: '/help zeigt alle Befehle. Kurz: /handshake /connect /send /send-plain /fetch /transfer-coins /create-key /create-key-and-notify /purge-key /list-keys /vault-save … Säule 1–4 einhalten.' };
            if (/mailbox_id|mailbox id/.test(lower))
                return { textOnly: true, text: 'MAILBOX_ID in .env setzen (aus create_globals-Event). Wird für Handshakes und purgbare Nachrichten genutzt. /purge-handshake und /purge-msg brauchen MAILBOX_ID. Siehe Säule 1/4 und Befehlsübersicht.' };
            if (/sende\s+1\s+iota.*key.*ticket|iota.*key.*ticket.*tx/.test(lower))
                return { textOnly: true, text: 'Es gibt keine einzelne TX für IOTA+Key+Ticket. Reihenfolge: 1. /transfer-coins <Adresse> 1  2. /create-key <lock> <recipient> [ttl]  3. /create-ticket. Pro Antwort nur eine ACTION-Zeile. Adresse angeben für Schritt 1.' };
            return null;
        },
    },
    {
        examples: [
            'sende verschlüsselt hallo an 0x',
            'schick verschlüsselt halloduda an 0x',
            'verschlüsselt halloduda an 0x senden',
            'sende halloduda an 0x',
            'nachricht an 0x senden',
        ],
        run: (msg) => {
            if (/\bunverschlüsselt\b|\bohne\s+handshake\b|\bklartext\b/i.test(msg)) {
                const plain = matchSendPlainTo(msg);
                if (plain?.suggestedAction) return { cmd: plain.suggestedAction.cmd, args: plain.suggestedAction.args, text: plain.text };
            }
            const r = matchSendEncryptedTo(msg);
            if (!r?.suggestedAction) return null;
            return { cmd: r.suggestedAction.cmd, args: r.suggestedAction.args, text: r.text };
        },
    },
    {
        examples: ['bereite alles vor gast soll bezahlen und schlüssel', 'gast soll schlüssel bekommen'],
        run: (msg) => {
            if (!/bereite|gast.*schlüssel|bezahlen.*schlüssel/.test(msg.toLowerCase())) return null;
            const addr = extractAddress(msg);
            return { cmd: '/create-key', args: [LOCK_ID_PLACEHOLDER, addr || '<Gast-Adresse>', '30'], text: 'Zwei Schritte: 1) Zahlung ggf. /transfer-coins. 2) Key (oben). Ersetze <Gast-Adresse> durch 0x….' };
        },
    },
    {
        examples: ['verbinde mit 0x', 'connect 0x', 'connect to 0x', 'mit 0x verbinden', 'verbindung zu 0x', 'mit adresse 0x schreiben', 'zuerst verbinden dann nachricht'],
        run: (msg) => {
            const addr = extractAddress(msg);
            if (addr) return { cmd: '/connect', args: [addr] };
            if (/verbinden|verbindung|nachricht schicken/.test(msg.toLowerCase()))
                return { cmd: '/connect', args: [], text: 'Schritt 1: Connect (Partner-Adresse in UI oder .env). Danach /send <Text>.' };
            return null;
        },
    },
    {
        examples: ['sende hallo', 'schick nachricht', 'nachricht senden', 'schick halloduda'],
        run: (msg) => {
            const normalized = msg.replace(/\s+/g, ' ').trim();
            const m = normalized.match(/^(?:sende|schick)\s+(.+)$/i) || normalized.match(/^nachricht\s+(.+)$/i);
            const text = m ? m[1].trim() : normalized;
            if (!text || text.length > 500) return null;
            return { cmd: '/send', args: [text] };
        },
    },
    {
        examples: ['hole letzten 20', 'hole letzte 100 von 0x', 'fetch 20', 'fetch 50', 'nachrichten laden', 'hole 50 nachrichten', 'letzte 10 holen'],
        run: (msg) => {
            const n = msg.match(/(\d+)/);
            const num = n ? Math.min(100, Math.max(1, parseInt(n[1], 10))) : 20;
            return { cmd: '/fetch', args: [String(num)] };
        },
    },
    {
        examples: ['handshake an 0x', 'handshake 0x', 'handshake senden an 0x'],
        run: (msg) => {
            const addr = extractAddress(msg);
            return addr ? { cmd: '/handshake', args: [addr] } : null;
        },
    },
    {
        examples: [
            'lass gast 0x rein',
            'gast von gestern wieder reinlassen 0x',
            'gib der adresse 0x einen schlüssel für 7 tage',
            'gib der adresse 0x schlüssel',
            'gib adresse 0x schlüssel für 7 tage',
            'erstelle key für 0x',
            'create key for 0x',
            'key ausstellen und bescheid sagen an 0x',
            'create key 0x 0x 1',
            'erstelle key 0x 0x 7',
            'schlüssel erstellen 0x 0x 7',
            'accesskey 0x 0x 2',
        ],
        run: (msg) => {
            const lower = msg.toLowerCase();
            if (/bescheid|bestätigung|benachrichtig/.test(lower)) return null;
            if (/mehrere\s+schlüssel|mehrere\s+keys|\d+\s*keys?\s+für|drei\s*(?:gäste?-?)?keys?|gäste?-?keys?\s+für/.test(lower)) return null;
            if (/key\s+0x.*(?:notfall|vorbereiten|emergency)/i.test(msg)) return null;
            const addrs = msg.match(new RegExp(ADDR, 'g'));
            const oneAddr = extractAddress(msg);
            const days = msg.match(/(\d+)\s*(?:tage?|d|days?)/i) || msg.match(/\b(\d+)\s*$/);
            const ttl = days ? days[1] : '30';
            if (addrs && addrs.length >= 2)
                return { cmd: '/create-key', args: [addrs[0], addrs[1], ttl] };
            if (oneAddr)
                return { cmd: '/create-key', args: [LOCK_ID_PLACEHOLDER, oneAddr, ttl] };
            return null;
        },
    },
    {
        examples: [
            'key ausstellen und bescheid sagen an 0x',
            'stelle ticket für gast 0x aus und sag bescheid',
            'gast 0x soll key bekommen und bestätigung',
            'key und benachrichtigung in einer transaktion',
            'key und benachrichtigung',
        ],
        run: (msg) => {
            const addr = extractAddress(msg);
            if (addr)
                return { cmd: '/create-key-and-notify', args: [LOCK_ID_PLACEHOLDER, addr, '30', (msg.match(/bescheid[:\s]*(.+)/i)?.[1]?.trim() || 'Key ausgestellt. Einlass freigegeben.').slice(0, 200)] };
            if (/key und benachrichtigung|transaktion/.test(msg.toLowerCase()))
                return { cmd: '/create-key-and-notify', args: [LOCK_ID_PLACEHOLDER, '<recipient>', '30', 'Nachricht'], text: 'Ersetze <recipient> durch die 0x-Adresse des Gasts.' };
            return null;
        },
    },
    {
        examples: ['event vorbei räum abgelaufene tickets auf', 'das event ist vorbei räum die abgelaufenen tickets auf', 'räum abgelaufene auf', 'wie lösche ich alte keys', 'zeig mir meine accesskeys', 'zeig meine tickets'],
        run: (msg) => {
            const lower = msg.toLowerCase();
            if (/tickets?\s*auf|abgelaufen|alte keys|lösche.*keys/.test(lower))
                return { cmd: '/list-keys', args: [], text: 'Säule 4: Zuerst auflisten. Dann pro abgelaufenes Objekt /purge-key <keyId> bzw. /purge-ticket <ticketId>.' };
            if (/zeig.*tickets|meine tickets/.test(lower))
                return { cmd: '/list-tickets', args: [] };
            if (/zeig.*keys|meine keys|accesskeys/.test(lower))
                return { cmd: '/list-keys', args: [] };
            return null;
        },
    },
    {
        examples: ['setze package 0x', 'setze package-id 0x', 'package-id setzen 0x', 'package-id 0x', 'set package id 0x', 'setze die package-id auf 0x'],
        run: (msg) => {
            const addr = extractAddress(msg) || msg.match(/0x[a-fA-F0-9]{64}/)?.[0];
            return addr ? { cmd: '/set-package-id', args: [addr] } : null;
        },
    },
    {
        examples: ['vault speichern', 'keys speichern', 'vault save', 'speichere messaging-keys lokal', 'speichere keys lokal', 'key wurde erstellt was jetzt'],
        run: (msg) => {
            const lower = msg.toLowerCase();
            if (/vault\s+on-?chain|keys?\s+on-?chain|on-chain\s+speichern/.test(lower)) return { cmd: '/vault-onchain', args: [] };
            if (/key wurde erstellt|was jetzt/.test(lower))
                return { cmd: '/vault-save', args: [], text: 'Säule 4: Keys lokal sichern. Später /list-keys, dann /purge-key für abgelaufene.' };
            return { cmd: '/vault-save', args: [] };
        },
    },
    {
        examples: ['liste keys', 'list keys', 'keys auflisten', 'list-keys'],
        run: () => ({ cmd: '/list-keys', args: [] }),
    },
    {
        examples: ['klartext senden an 0x', 'send plain 0x text', 'send-plain 0x hallo', 'schick klartext hallo an 0x', 'sag 0x bescheid'],
        run: (msg) => {
            const addr = extractAddress(msg);
            if (!addr) return null;
            const r = matchSendPlainTo(msg);
            if (r?.suggestedAction) return { cmd: r.suggestedAction.cmd, args: r.suggestedAction.args };
            const normalized = msg.replace(/\s+/g, ' ').trim();
            const m = normalized.match(/send[- ]?plain\s+0x[a-fA-F0-9]+\s+(.+)/i) || normalized.match(/klartext\s+(.+?)\s+an\s+0x/i);
            const text = m ? m[1].trim() : 'Nachricht';
            return { cmd: '/send-plain', args: [addr, text.slice(0, 500)] };
        },
    },
    {
        examples: ['jetzt verschlüsselt senden bereit', 'jetzt verschlüsselt senden: bereit', 'bereit zum senden', 'verschlüsselt senden bereit'],
        run: (msg) => {
            if (!/bereit|jetzt.*senden|senden.*bereit/.test(msg.toLowerCase())) return null;
            return { cmd: '/send', args: ['Bereit'] };
        },
    },
    {
        examples: [
            'transfer coins 0x 0.1',
            'iota senden 0x 1',
            'coins an 0x überweisen',
            'sende 1 iota an 0x',
            'sende 0.5 iota an 0x',
            'schick 1 iota an 0x',
            '1 iota an 0x senden',
            'überweise 2 iota an 0x',
        ],
        run: (msg) => {
            const addrs = msg.match(new RegExp(ADDR, 'g'));
            const num = msg.match(/(\d+(?:\.\d+)?)\s*(?:iota|miota|i)?/i) || msg.match(/(\d+(?:\.\d+)?)/);
            if (!addrs?.length || !num) return null;
            return { cmd: '/transfer-coins', args: [addrs[0], num[1]] };
        },
    },
    {
        examples: ['purge handshake', 'lösche handshake', 'purge alle abgelaufenen handshakes', 'handshake löschen', 'handshake purge rebate', 'lösche den handshake aus der mailbox', 'handshake aus mailbox löschen'],
        run: (msg) => (/handshake|mailbox|purge|löschen/.test(msg.toLowerCase()) && /handshake|mailbox/.test(msg.toLowerCase()) ? { cmd: '/purge-handshake', args: [] } : null),
    },
    {
        examples: ['vault onchain', 'keys on-chain speichern', 'vault on chain'],
        run: () => ({ cmd: '/vault-onchain', args: [] }),
    },
    {
        examples: ['emergency purge', 'notfall purge vault', 'vault notfall löschen'],
        run: (msg) => {
            if (/\b(all|alles|everything|komplett|ganzen?)\b/i.test(msg ?? '')) return null;
            const ids = extractAllObjectIds(msg ?? '');
            const lower = (msg ?? '').toLowerCase();
            if (ids.length === 0 && !/vault/.test(lower)) return null;
            return { cmd: '/emergency-purge', args: [] };
        },
    },
    {
        examples: ['liste tickets', 'list tickets', 'tickets auflisten'],
        run: () => ({ cmd: '/list-tickets', args: [] }),
    },
    {
        examples: ['mehrere schlüssel für 0x', 'erstelle 5 keys 0x 0x 7', 'create-keys 0x 0x 1 5', 'mehrere schlüssel 0x 0x 2 10', 'erstelle 3 keys für 0x mit 14 tagen', 'erstelle 3 keys für 0xrecipient mit 14 tagen'],
        run: (msg) => {
            const lower = msg.toLowerCase();
            const addrs = msg.match(new RegExp(ADDR, 'g'));
            const oneAddr = extractAddress(msg) || extractAllObjectIds(msg)[0];
            const ttlMatch = msg.match(/(\d+)\s*(?:tage?|d|days?)/i);
            const countMatch = msg.match(/erstelle\s+(\d+)\s*keys/i) || msg.match(/(\d+)\s*keys/i) || msg.match(/(?:anzahl|number)\s*(\d+)/i) || msg.match(/\b(\d+)\s*$/);
            let count = countMatch ? countMatch[1] : '1';
            if (/drei\s*(?:gäste?-?)?keys?|gäste?-?keys?\s+für/.test(lower) && count === '1') count = '3';
            const ttl = ttlMatch ? ttlMatch[1] : '30';
            if (addrs && addrs.length >= 2)
                return { cmd: '/create-keys', args: [addrs[0], addrs[1], ttl, count] };
            if (oneAddr && /keys?|schlüssel|key/.test(msg.toLowerCase()))
                return { cmd: '/create-keys', args: [LOCK_ID_PLACEHOLDER, oneAddr, ttl, count] };
            return null;
        },
    },
    {
        examples: ['purge key 0x', 'key löschen 0x', 'accesskey purge 0x', 'lösche key mit id 0x', 'ticket 0x löschen', 'notfall-purge key ist aktiv jetzt löschen'],
        run: (msg) => {
            const lower = msg.toLowerCase();
            const ids = extractAllObjectIds(msg);
            if (/(?:transfer|übertrage)\s+ticket|ticket.*(?:transfer|übertragen)/.test(lower) && ids.length >= 2)
                return { cmd: '/transfer-ticket', args: [ids[0], ids[1]] };
            if (/ticket.*notfall|notfall.*ticket|ticket.*notfall-purge\s*vorbereiten/.test(lower) && ids.length >= 1)
                return { cmd: '/emergency-purge-ticket', args: [ids[0]] };
            if (/ticket.*löschen|purge-ticket/.test(lower) && ids.length >= 1)
                return { cmd: '/purge-ticket', args: [ids[0]] };
            if (/key.*notfall|notfall.*key|notfall-purge\s*vorbereiten/.test(lower) && ids.length >= 1)
                return { cmd: '/emergency-purge-key', args: [ids[0]] };
            if (/purge-key|key löschen|lösche.*key|key mit der id/.test(lower) && ids.length >= 1)
                return { cmd: '/purge-key', args: [ids[0]] };
            if (/notfall.*aktiv.*löschen|jetzt löschen/.test(lower))
                return { cmd: '/list-keys', args: [], text: 'Zuerst /list-keys, dann /purge-key <keyId> für den Key.' };
            return ids.length >= 1 ? { cmd: '/purge-key', args: [ids[0]] } : null;
        },
    },
    {
        examples: ['key 0x für notfall-purge', 'key 0xkey789 für notfall-purge vorbereiten', 'emergency-purge-key 0x', 'notfall-purge für vault'],
        run: (msg) => {
            const lower = msg.toLowerCase();
            const ids = extractAllObjectIds(msg);
            if (/vault|vault notfall/.test(lower)) {
                if (/\b(all|alles|everything|komplett|ganzen?)\b/i.test(lower)) return null;
                return { cmd: '/emergency-purge', args: [] };
            }
            if (ids.length >= 1) return { cmd: '/emergency-purge-key', args: [ids[0]] };
            return null;
        },
    },
    {
        examples: ['nachricht aus mailbox löschen nonce 42', 'purge-msg 42'],
        run: (msg) => {
            const n = msg.match(/(\d+)/);
            return n ? { cmd: '/purge-msg', args: [n[1]] } : null;
        },
    },
    {
        examples: ['ticket 0x einlösen für event 0x', 'ticket 0xticket123 einlösen für event 0xevent456', 'use-ticket 0x 0x', 'übertrage key 0x an 0x', 'transfer key 0x to 0x', 'ticket 0x an 0x übertragen', 'transfer ticket 0x to 0x', 'ticket 0xt1 an 0xnewowner übertragen', 'ticket 0xticket999 löschen'],
        run: (msg) => {
            const ids = extractAllObjectIds(msg);
            const lower = msg.toLowerCase();
            if (/einlösen|use-ticket|use_ticket/.test(lower) && ids.length >= 2)
                return { cmd: '/use-ticket', args: [ids[0], ids[1]] };
            if (/übertrage.*ticket|ticket.*übertragen|transfer-ticket/.test(lower) && ids.length >= 2)
                return { cmd: '/transfer-ticket', args: [ids[0], ids[1]] };
            if ((/übertrage.*key|key.*an.*übertragen|transfer-key/.test(lower) || ids.length >= 2) && ids.length >= 2)
                return { cmd: '/transfer-key', args: [ids[0], ids[1]] };
            return null;
        },
    },
    {
        examples: ['transfer key 0x an 0x', 'key übertragen 0x 0x', 'transfer-key 0x 0x'],
        run: (msg) => {
            if (/transfer\s+ticket|ticket.*transfer/i.test(msg)) return null;
            const addrs = msg.match(new RegExp(ADDR, 'g'));
            if (!addrs || addrs.length < 2) return null;
            return { cmd: '/transfer-key', args: [addrs[0], addrs[1]] };
        },
    },
    {
        examples: ['hole letzten 20 von 0x', 'fetch 30 0x', 'nachrichten von 0x holen'],
        run: (msg) => {
            const n = msg.match(/(\d+)/);
            const num = n ? Math.min(100, Math.max(1, parseInt(n[1], 10))) : 20;
            const addr = extractAddress(msg);
            return addr ? { cmd: '/fetch', args: [String(num), addr] } : { cmd: '/fetch', args: [String(num)] };
        },
    },
    {
        examples: [
            'erstelle ein ticket für hexefest und sende an adresse 0x',
            'erstelle ein ticket "baum" und sende es an 0x',
            'ticket für hexefest erstellen an 0x senden',
            'create ticket for event and send to 0x',
            'ticket für event erstellen an 0x',
        ],
        run: (msg) => {
            const lower = msg.toLowerCase();
            if (!/ticket\s+(?:für|for)\s+|erstelle\s+(?:ein\s+)?ticket|create\s+ticket/.test(lower)) return null;
            const addr = extractAddress(msg);
            if (!addr) return null;
            const quotedD = msg.match(/ticket\s+(?:"([^"]+)"|'([^']+)')/i);
            const quoted = quotedD?.[1] ?? quotedD?.[2];
            const eventName =
                quoted?.trim() ||
                msg.match(/ticket\s+(?:für|for)\s+([a-z0-9_-]+)/i)?.[1]?.trim() ||
                msg.match(/erstelle\s+(?:ein\s+)?ticket\s+(?:für\s+)?([a-z0-9_-]+)/i)?.[1]?.trim() ||
                'event';
            const metadataHex = '0x' + Buffer.from((eventName || 'event').slice(0, 32), 'utf8').toString('hex');
            const validUntilMs = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
            return {
                cmd: '/create-ticket',
                args: ['<event_id>', '0', validUntilMs, metadataHex, addr],
                text: 'Ticket wird an die Adresse ausgestellt. Ersetze <event_id> durch die Event-Registry-Objekt-ID (0x…) von der Chain. Optional danach: /send-plain zur Benachrichtigung.',
            };
        },
    },
];

const MIN_SCORE = 0.35;

/**
 * Stichwort-Kaskade: Erste Prüfung auf 5 Standard-Sätze (Setup, Handshake, Message, Access, Purge).
 * Wenn der Mensch sich an diese Form hält, reagiert die KI in Millisekunden ohne Grammatik-Analyse.
 */
function tryStichwortKaskade(msg: string): AiCopilotResult | null {
    const lower = msg.toLowerCase().trim();
    const first = lower.split(/\s+/)[0];
    if (!first) return null;
    const rest = msg.slice(msg.indexOf(first) + first.length).trim();
    const addr = extractAddress(msg);
    const ids = extractAllObjectIds(msg);

    if (first === 'setup') {
        if (addr) return { ok: true, text: 'Säule 1: Package-ID setzen.', suggestedAction: { cmd: '/set-package-id', args: [addr] } };
        return { ok: true, text: 'Setup: Adresse angeben, z. B. Setup 0x…', suggestedAction: { cmd: '/set-package-id', args: [] } };
    }
    if (first === 'handshake') {
        if (addr) return { ok: true, text: 'Handshake an Partner senden.', suggestedAction: { cmd: '/handshake', args: [addr] } };
        return { ok: true, text: 'Handshake: Adresse angeben, z. B. Handshake 0x…', suggestedAction: { cmd: '/handshake', args: [] } };
    }
    if (first === 'message') {
        if (addr) {
            const textPart = rest.replace(new RegExp(ADDR), '').trim();
            const text = textPart.slice(0, 500) || 'Nachricht';
            return { ok: true, text: 'Klartext senden.', suggestedAction: { cmd: '/send-plain', args: [addr, text] } };
        }
        return { ok: true, text: 'Message: Adresse und optional Text, z. B. Message 0x… Hallo.', suggestedAction: { cmd: '/send-plain', args: [] } };
    }
    if (first === 'access') {
        if (addr) {
            const daysMatch = rest.match(/(\d+)\s*(?:tage?|d|days?)?/i) || rest.match(/(\d+)/);
            const days = daysMatch ? daysMatch[1] : '30';
            return { ok: true, text: 'Zutritt (AccessKey) erteilen.', suggestedAction: { cmd: '/create-key', args: [LOCK_ID_PLACEHOLDER, addr, days] } };
        }
        return { ok: true, text: 'Access: Adresse und optional Tage, z. B. Access 0x… 7', suggestedAction: { cmd: '/create-key', args: [] } };
    }
    if (first === 'purge') {
        if (ids.length >= 1) {
            const id = ids[0];
            if (/handshake|mailbox/i.test(rest)) return { ok: true, text: 'Handshake aus Mailbox löschen.', suggestedAction: { cmd: '/purge-handshake', args: [] } };
            if (/ticket/i.test(rest)) return { ok: true, text: 'Ticket löschen (Rebate).', suggestedAction: { cmd: '/purge-ticket', args: [id] } };
            return { ok: true, text: 'Key löschen (Purge).', suggestedAction: { cmd: '/purge-key', args: [id] } };
        }
        if (/handshake|mailbox/i.test(rest))
            return { ok: true, text: 'Purge-Handshake nur mit MAILBOX_ID. Zuerst /list-keys oder Kontext prüfen.', suggestedAction: { cmd: '/list-keys', args: [] } };
        return { ok: true, text: 'Purge nur mit Objekt-ID. Zuerst auflisten.', suggestedAction: { cmd: '/list-keys', args: [] } };
    }
    return null;
}

/** Parst deutsches Datum dd.mm.yyyy → Ende des Tages in ms. */
function parseDateDdMmYyyy(str: string): number | null {
    const m = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (!m) return null;
    const [, d, mo, y] = m;
    const day = parseInt(d!, 10);
    const month = parseInt(mo!, 10) - 1;
    const year = parseInt(y!, 10);
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    return new Date(year, month, day, 23, 59, 59, 999).getTime();
}

/** Instant-Mapping (Mute-AI-Fix): Kein Verb, nur Adresse + Zahl → wahrscheinlichste Aktion. Export für ai-copilot (auch wenn Intent-Checkbox aus). */
export function tryInstantMapping(msg: string): AiCopilotResult | null {
    const addr = extractAddress(msg);
    if (!addr) return null;
    const verbLike = /\b(sende|schick|überweis|lass|gib|erstelle|create|key|ticket|nachricht|handshake|connect|transfer|pay)\b/i.test(msg);
    if (verbLike) return null;
    const numMatch = msg.match(/\b(\d+(?:\.\d+)?)\b/);
    if (!numMatch) return null;
    const num = parseFloat(numMatch[1]);
    if (num >= 1 && num <= 365) {
        return {
            ok: true,
            text: 'Vermute Zutritt (Tage). Ersetze <LOCK_ID> bei Bedarf.',
            suggestedAction: { cmd: '/create-key', args: [LOCK_ID_PLACEHOLDER, addr, String(Math.round(num))] },
        };
    }
    if (num > 1000) {
        const iotaArg = num >= 1_000_000_000 ? String(num / 1_000_000_000) : String(num);
        return {
            ok: true,
            text: 'Vermute Zahlung (IOTA). Große Zahl als Nanos interpretiert → IOTA umgerechnet.',
            suggestedAction: { cmd: '/transfer-coins', args: [addr, iotaArg] },
        };
    }
    return null;
}

/**
 * Prüft, ob die Nutzereingabe zu einem Intent passt (Beispielphrasen + Arg-Extraktion).
 * Wird vor Ollama aufgerufen, wenn ENABLE_AI_INTENT_MATCHER=true.
 */
export function tryIntentMatch(userMessage: string): AiCopilotResult | null {
    const msg = (userMessage || '').trim();
    if (!msg) return null;

    const kaskade = tryStichwortKaskade(msg);
    if (kaskade) return kaskade;

    const lowerMsg = msg.toLowerCase();

    // Vor Instant-Mapping: "hole letzte N von 0x" / "fetch N 0x" → /fetch (sonst würde N als Key-Tage → /create-key)
    const fetchFromAddr = /hole\s+letzte[n]?\s*(\d+)(?:\s*nachrichten?)?\s*von\s+0x|fetch\s+(\d+)\s+0x|nachrichten?\s+von\s+0x\s+holen/i.test(msg);
    if (fetchFromAddr) {
        const n = msg.match(/(\d+)/);
        const num = n ? Math.min(100, Math.max(1, parseInt(n[1], 10))) : 20;
        const addr = extractAddress(msg);
        if (addr) return { ok: true, text: 'Nachrichten von Adresse laden.', suggestedAction: { cmd: '/fetch', args: [String(num), addr] } };
    }
    if (/hole\s+letzte[n]?\s*\d+|fetch\s+\d+|letzte[n]?\s*\d+\s+holen/i.test(msg)) {
        const n = msg.match(/(\d+)/);
        const num = n ? Math.min(100, Math.max(1, parseInt(n[1], 10))) : 20;
        return { ok: true, text: 'Nachrichten laden.', suggestedAction: { cmd: '/fetch', args: [String(num)] } };
    }

    // "X IOTA/Coins an 0x" / "überweise X an 0x" vor Instant-Mapping (sonst kleine Zahl → /create-key)
    if (isTransferCoinsIntent(msg)) {
        const addrs = msg.match(new RegExp(ADDR, 'g'));
        const num = msg.match(/(\d+(?:\.\d+)?)\s*(?:iota|miota|i)?/i) || msg.match(/(\d+(?:\.\d+)?)/);
        if (addrs?.length && num) {
            return { ok: true, text: 'IOTA-Transfer.', suggestedAction: { cmd: '/transfer-coins', args: [addrs[0], num[1]] } };
        }
    }

    // "Sag 0x…" / "Sag 0x… Text" → /send-plain (vor generischem Adresse+Zahl)
    if (/^sag\s+0x/i.test(msg.trim())) {
        const addr = extractAddress(msg);
        if (addr) {
            const textPart = msg.replace(new RegExp(ADDR), '').replace(/^sag\s+/i, '').trim();
            return { ok: true, text: 'Klartext senden.', suggestedAction: { cmd: '/send-plain', args: [addr, textPart.slice(0, 500) || 'Nachricht'] } };
        }
    }
    // "Klartext … an 0x" → /send-plain (vor Instant-Mapping, sonst "18" als Tage → /create-key)
    if (/klartext\s+.+?\s+an\s+0x/i.test(msg)) {
        const r = matchSendPlainTo(msg);
        if (r?.suggestedAction) return r;
        const addr = extractAddress(msg);
        if (addr) {
            const textPart = msg.replace(new RegExp(ADDR), '').replace(/klartext\s+/i, '').replace(/\s+an\s+0x.*$/i, '').trim();
            return { ok: true, text: 'Klartext senden.', suggestedAction: { cmd: '/send-plain', args: [addr, textPart.slice(0, 500) || 'Nachricht'] } };
        }
    }

    // "Key 0x… für Notfall-Purge / vorbereiten" → /emergency-purge-key (vor create-key)
    if (/key\s+0x\w+.*(?:notfall|vorbereiten|emergency)/i.test(msg)) {
        const id = msg.match(/key\s+(0x[\w]+)/i)?.[1] || extractObjectId(msg);
        if (id) return { ok: true, text: 'Notfall-Purge für Key vorbereiten.', suggestedAction: { cmd: '/emergency-purge-key', args: [id] } };
    }

    // Instant-Mapping: Adresse + Zahl ohne Verb → /transfer-coins oder /create-key (Mute-AI-Fix)
    const instant = tryInstantMapping(msg);
    if (instant) return instant;

    // "50 Tickets mit Sitzplatznummern, Namen, Preis (10€), Datum (11.12.2026)" → Plan mit 50 create-ticket-Schritten
    const hasTicketBatchKeywords = /(?:sitzplatz|sitz|namen?|preis|\d+\s*€|datum|\d{1,2}\.\d{1,2}\.\d{4})/i.test(msg);
    const ticketBatchMatch = (/\d+\s*tickets?\s+(?:erstellen|mit)/i.test(lowerMsg) || /erstelle\s+\d+\s*tickets?/i.test(msg)) && hasTicketBatchKeywords;
    if (ticketBatchMatch) {
        const countMatch = msg.match(/(\d+)\s*tickets?/i);
        const count = countMatch ? Math.min(100, Math.max(1, parseInt(countMatch[1], 10))) : 50;
        const dateMatch = msg.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
        const validUntilMs = dateMatch ? parseDateDdMmYyyy(dateMatch[0]) : new Date(new Date().getFullYear(), 11, 11, 23, 59, 59, 999).getTime();
        const validUntilStr = String(validUntilMs ?? Date.now() + 30 * 24 * 60 * 60 * 1000);
        const priceMatch = msg.match(/(\d+)\s*€|preis\s*[:(]?\s*(\d+)/i);
        const priceStr = priceMatch ? (priceMatch[1] ?? priceMatch[2] ?? '10') + '€' : '10€';
        const steps: Array<{ action: string; description: string; suggestedCommand?: { cmd: string; args: string[] } }> = [];
        for (let i = 1; i <= count; i++) {
            const meta = { sitz: i, name: 'Platz ' + i, preis: priceStr, datum: dateMatch ? dateMatch[0] : '11.12.2026' };
            const metadataHex = '0x' + Buffer.from(JSON.stringify(meta), 'utf8').toString('hex');
            steps.push({
                action: 'CREATE_TICKET',
                description: `Ticket ${i}: Sitz ${i}, Name "${meta.name}", ${priceStr}, ${meta.datum}`,
                suggestedCommand: {
                    cmd: '/create-ticket',
                    args: ['<event_id>', '0', validUntilStr, metadataHex, '<recipient>'],
                },
            });
        }
        return {
            ok: true,
            text: `${count} Tickets mit Sitzplatznummern, Namen (Platz 1–${count}), ${priceStr}, Datum ${dateMatch ? dateMatch[0] : '11.12.2026'}. Ersetze <event_id> durch deine Event-Objekt-ID (0x…) und <recipient> durch Empfängeradresse (oder alle an MY_ADDRESS). Dann „Alle Schritte ausführen“.`,
            plan: { steps },
        };
    }

    // Ein Befehl pro Eingabe: Bei "X und danach Y" / "X dann Y" freundlich aufteilen empfehlen
    if (/\b(und\s+danach|dann)\b/.test(lowerMsg) && (/\biota\b|\bcoins?\b|\büberweis/.test(lowerMsg) && /\b(text|nachricht|senden?|schick)\b/i.test(lowerMsg) || /\b(key|ticket|zutritt)\b/i.test(lowerMsg) && /\b(senden?|iota|überweis)\b/i.test(lowerMsg)))
        return { ok: true, textOnly: true, text: 'Bitte einen Befehl pro Eingabe: Zuerst z. B. „sende 1 iota an 0x…“ ausführen, dann in der nächsten Eingabe „sende text“ oder „Message 0x… Hallo“. So bleibt die Zuordnung eindeutig.' };
    const idsEarly = extractAllObjectIds(msg);
    if (idsEarly.length >= 2 && (/einlösen|use-ticket/.test(lowerMsg) || (lowerMsg.includes('ticket') && lowerMsg.includes('event')))) {
        const a = idsEarly[0].replace(/[.,;:]$/, '');
        const b = idsEarly[1].replace(/[.,;:]$/, '');
        if (a && b) return { ok: true, text: 'Ticket einlösen.', suggestedAction: { cmd: '/use-ticket', args: [a, b] } };
    }

    // Kurzbefehle: Listen (immer erkennen, unabhängig von Ähnlichkeit)
    if (/^zeig\s+meine\s+tickets?|^liste\s+tickets?|^tickets?\s+auflisten|^list\s+tickets$/i.test(msg))
        return { ok: true, text: 'Tickets auflisten.', suggestedAction: { cmd: '/list-tickets', args: [] } };
    if (/^zeig\s+(?:mir\s+)?meine\s+keys?|^zeig\s+accesskeys?|^liste\s+keys?|^keys?\s+auflisten|^list\s+keys$/i.test(msg))
        return { ok: true, text: 'AccessKeys auflisten.', suggestedAction: { cmd: '/list-keys', args: [] } };

    // "erstelle ein ticket … und sende (es) an 0x" früh erkennen
    if (/^erstelle\s+(?:ein\s+)?ticket\s+/i.test(msg)) {
        const addrTicket = extractAddress(msg);
        if (addrTicket) {
            const quoted = msg.match(/ticket\s+(?:"([^"]+)"|'([^']+)')/i);
            const eventName = (quoted?.[1] ?? quoted?.[2] ?? msg.match(/ticket\s+(?:für\s+)?([a-z0-9_-]+)/i)?.[1] ?? 'event').trim().slice(0, 32);
            const metadataHex = '0x' + Buffer.from(eventName || 'event', 'utf8').toString('hex');
            const validUntilMs = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
            return {
                ok: true,
                text: 'Ticket wird an die Adresse ausgestellt.',
                suggestedAction: { cmd: '/create-ticket', args: ['<event_id>', '0', validUntilMs, metadataHex, addrTicket] },
            };
        }
    }

    // "handshake 0x…" (ohne "an") explizit erkennen
    if (/^handshake\s+0x/i.test(msg)) {
        const addr = extractAddress(msg);
        if (addr) return { ok: true, text: 'Handshake wird gesendet.', suggestedAction: { cmd: '/handshake', args: [addr] } };
    }
    // Package setzen (Synonym)
    if (/package\s+setzen\s+auf\s+0x/i.test(msg)) {
        const addr = extractAddress(msg);
        if (addr) return { ok: true, text: 'Package-ID setzen.', suggestedAction: { cmd: '/set-package-id', args: [addr] } };
    }
    // ECDH / Schlüsseltausch / sichere Leitung → /handshake
    if (/(?:ecdh|schlüsseltausch|sichere\s+leitung)\s+(?:mit|zu)\s+0x|sichere\s+leitung\s+zu\s+0x/i.test(msg)) {
        const addr = extractAddress(msg);
        if (addr) return { ok: true, text: 'Handshake (ECDH) an Partner senden.', suggestedAction: { cmd: '/handshake', args: [addr] } };
    }
    // Chat mit 0x → /connect
    if (/chat\s+mit\s+0x/i.test(msg)) {
        const addr = extractAddress(msg);
        if (addr) return { ok: true, text: 'Verbindung zum Partner herstellen.', suggestedAction: { cmd: '/connect', args: [addr] } };
    }
    // Verschüsselte Nachricht schicken (ohne Adresse) → /send
    if (/^verschlüsselte\s+nachricht\s+schicken$/i.test(msg.trim())) {
        return { ok: true, text: 'Nach Verbindung: Nachricht eingeben und senden.', suggestedAction: { cmd: '/send', args: ['Nachricht'] } };
    }
    // Backup der Keys → /vault-save
    if (/backup\s+(?:der\s+)?keys?\s+machen|keys?\s+backup/i.test(lowerMsg)) {
        return { ok: true, text: 'Keys lokal sichern.', suggestedAction: { cmd: '/vault-save', args: [] } };
    }
    // Zutritt für 0x… → /create-key
    if (/zutritt\s+für\s+0x/i.test(msg)) {
        const addr = extractAddress(msg);
        if (addr) return { ok: true, text: 'Zutritt für Gast erteilen.', suggestedAction: { cmd: '/create-key', args: [LOCK_ID_PLACEHOLDER, addr, '30'] } };
    }
    // Drei / mehrere Gäste-Keys für 0x… → /create-keys
    if (/drei\s*(?:gäste?-?)?keys?\s+für\s+0x|gäste?-?keys?\s+für\s+0x/i.test(msg)) {
        const addr = extractAddress(msg);
        if (addr) return { ok: true, text: 'Mehrere Keys ausstellen.', suggestedAction: { cmd: '/create-keys', args: [LOCK_ID_PLACEHOLDER, addr, '30', '3'] } };
    }
    // Mehrere Schlüssel/Keys für 0x… (ggf. X Tage, Y Stück) → /create-keys
    if (/mehrere\s*(?:schlüssel|keys?)\s+für\s+0x/i.test(msg)) {
        const addr = extractAddress(msg);
        if (addr) {
            const ttlMatch = msg.match(/(\d+)\s*(?:tage?|d|days?)/i);
            const countMatch = msg.match(/(\d+)\s*stück/i) || msg.match(/erstelle\s+(\d+)\s*keys/i) || msg.match(/(\d+)\s*keys/i);
            const ttl = ttlMatch ? ttlMatch[1] : '30';
            const count = countMatch ? countMatch[1] : '3';
            return { ok: true, text: 'Mehrere Keys ausstellen.', suggestedAction: { cmd: '/create-keys', args: [LOCK_ID_PLACEHOLDER, addr, ttl, count] } };
        }
    }
    // Stelle ticket für gast 0x… (Key + Benachrichtigung, nicht reines Ticket) → /create-key-and-notify
    if (/stelle\s+ticket\s+für\s+gast\s+0x|ticket\s+für\s+gast\s+0x.*(?:aus\s+und\s+sag|bescheid)/i.test(msg)) {
        const addr = extractAddress(msg);
        if (addr) return { ok: true, text: 'Key ausstellen und Bescheid geben.', suggestedAction: { cmd: '/create-key-and-notify', args: [LOCK_ID_PLACEHOLDER, addr, '30', 'Key ausgestellt. Einlass freigegeben.'] } };
    }
    // Key 0x… für Notfall-Purge / vorbereiten → /emergency-purge-key (vor create-key)
    if (/key\s+0x[0-9a-fA-F]+.*(?:notfall|vorbereiten|emergency)/i.test(msg) || /(?:notfall-purge|emergency).*key\s+0x/i.test(msg)) {
        const ids = extractAllObjectIds(msg);
        if (ids.length >= 1) return { ok: true, text: 'Notfall-Purge für Key vorbereiten.', suggestedAction: { cmd: '/emergency-purge-key', args: [ids[0]] } };
    }

    // "Ticket [Event] erstellen und (es) an 0x senden" vor "sende … an 0x" (sonst wird Handshake erkannt)
    // Erfasst: "ticket baum", "ticket für hexefest", "ticket \"baum\"", "ticket \"konzert\" erstellen und an 0x"
    const ticketCreateAndSend = /ticket\s+["']?[\w-]+["']?\s+erstellen\s+und\s+an\s+0x|(?:erstelle|create)\s+(?:ein\s+)?\d*\s*tickets?\s+.*(?:sende|an\s+adresse|an\s+0x|send\s+to|0x)|erstelle\s+(?:ein\s+)?ticket\s+.*sende\s+.*0x|(?:ticket|create\s+ticket)\s+.*(?:für|for)\s+.*(?:sende|an\s+adresse|0x)/i.test(msg);
    if (ticketCreateAndSend) {
        const addr = extractAddress(msg);
        if (addr) {
            const quotedD = msg.match(/ticket\s+(?:"([^"]+)"|'([^']+)')/i);
            const quoted = quotedD?.[1] ?? quotedD?.[2];
            const eventName =
                quoted?.trim() ||
                msg.match(/ticket\s+(?:für|for)\s+([a-z0-9_-]+)/i)?.[1]?.trim() ||
                msg.match(/erstelle\s+(?:ein\s+)?ticket\s+(?:für\s+)?([a-z0-9_-]+)/i)?.[1]?.trim() ||
                msg.match(/ticket\s+"([^"]+)"|ticket\s+'([^']+)'/i)?.[1]?.trim() ||
                'event';
            const metadataHex = '0x' + Buffer.from((eventName || 'event').slice(0, 32), 'utf8').toString('hex');
            const validUntilMs = String(Date.now() + 7 * 24 * 60 * 60 * 1000);
            return {
                ok: true,
                text: 'Ticket wird an die Adresse ausgestellt. Ersetze <event_id> durch die Event-Registry-Objekt-ID (0x…) von der Chain. Optional danach: /send-plain an die Adresse zur Benachrichtigung.',
                suggestedAction: { cmd: '/create-ticket', args: ['<event_id>', '0', validUntilMs, metadataHex, addr] },
            };
        }
    }

    // Compliance + "sende nachricht … an 0x": 0x0748... erhält NUR "Ki läuft". Sonst Klartext mit extrahiertem Text.
    const COMPLIANCE_ADDR = '0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5';
    if (/\b(?:sende|schick)\s+nachricht\s+.+\s+an\s+0x|\bnachricht\s+.+\s+an\s+0x/i.test(msg)) {
        const addr = extractAddress(msg);
        if (addr) {
            const isCompliance = addr.toLowerCase() === COMPLIANCE_ADDR.toLowerCase();
            const quoted = msg.match(/nachricht\s+["'\u201C\u201D]([^"'\u201C\u201D]*)["'\u201C\u201D]\s+an\s+0x|nachricht\s+"([^"]*)"\s+an\s+0x|nachricht\s+'([^']*)'\s+an\s+0x/i);
            const plain = msg.match(/(?:sende|schick)\s+nachricht\s+(.+?)\s+an\s+0x/i);
            const text = (quoted && (quoted[1] ?? quoted[2] ?? quoted[3])) || (plain?.[1]?.trim()) || (isCompliance ? 'Ki läuft' : 'Nachricht');
            const message = (isCompliance ? 'Ki läuft' : text.slice(0, 500)).trim() || 'Ki läuft';
            return {
                ok: true,
                text: isCompliance ? 'Compliance: Nur „Ki läuft“ an diese Adresse.' : 'Klartext wird gesendet.',
                suggestedAction: { cmd: '/send-plain', args: [addr, message] },
            };
        }
    }

    // Klartext (explizit) oder "sende verschlüsselt … an 0x"
    const sendPlain = matchSendPlainTo(msg);
    if (sendPlain) return sendPlain;
    const sendTo = matchSendEncryptedTo(msg);
    if (sendTo) return sendTo;

    // Mehrdeutig: „Einladung senden“ oder „Nachricht an 0x senden“ ohne konkreten Text → nachfragen (nicht raten)
    const hasPlainOrEnc = /\bklartext\b|\bunverschlüsselt\b|\bsend[- ]?plain\b|\bverschlüsselt\b|\bencrypted\b/i.test(msg);
    const hasEinladung = /\beinladung\b/i.test(msg);
    const hasQuotedMessage = /\bsende\s+nachricht\s+["'\u201C\u201D][^"'\u201C\u201D]*["'\u201C\u201D]\s+an\s+0x|\bverschlüsselt\s+.+\s+an\s+0x/i.test(msg);
    const sendEinladungOrGeneric = (/\b(sende|schick)\s+.*\b(einladung|nachricht|text)\b.*0x[a-fA-F0-9]{64}|einladung\s+.*(an\s+)?0x[a-fA-F0-9]{64}/i.test(msg) && !hasQuotedMessage);
    if (sendEinladungOrGeneric && hasEinladung && !hasPlainOrEnc && extractAddress(msg)) {
        return {
            ok: true,
            textOnly: true,
            text: 'Wie soll die Einladung ankommen? (1) **Klartext** – sofort mit /send-plain, kein Handshake nötig. (2) **Verschlüsselt** – zuerst /handshake, Partner /connect, danach /send. Sag „Klartext“ oder „Verschlüsselt“.',
        };
    }
    if (sendEinladungOrGeneric && !hasEinladung && /\b(nachricht|message)\s+(senden?|an\s+0x)/i.test(msg) && !hasPlainOrEnc && extractAddress(msg) && !hasQuotedMessage) {
        return {
            ok: true,
            textOnly: true,
            text: 'Wie soll die Nachricht ankommen? (1) **Klartext** – sofort /send-plain. (2) **Verschlüsselt** – zuerst /handshake, Partner /connect, dann /send. Sag „Klartext“ oder „Verschlüsselt“.',
        };
    }
    // „Tickets erstellen und Einladung senden“: Tickets brauchen keinen Handshake; bei Einladung nachfragen
    if (/\bticket(s)?\s+(erstellen|ausstellen|an\s+0x)/i.test(msg) && /\b(einladung|nachricht|senden?|schick)\b/i.test(msg) && !hasPlainOrEnc) {
        return {
            ok: true,
            textOnly: true,
            text: 'Tickets brauchen keinen Handshake. Zuerst Tickets erstellen (z. B. „erstelle ein ticket … und sende es an 0x…“). Einladung: **Klartext** (/send-plain) oder **verschlüsselt** (Handshake → Connect → /send)? Sag „Klartext“ oder „Verschlüsselt“.',
        };
    }

    // Direktabgleich (Phrase + 0x-IDs), unabhängig von Ähnlichkeit
    const ids = extractAllObjectIds(msg);
    const addr64 = extractAddress(msg);
    const multiKeyPhrase = /\d+\s*keys?\s+für|drei\s*(?:gäste?-?)?keys?|gäste?-?keys?\s+für|mehrere\s*(?:schlüssel|keys?)/i.test(lowerMsg);
    if (!multiKeyPhrase && /(gib der adresse|lass gast).*(?:schlüssel|keys?)|(?:schlüssel|keys?).*(für|tage)/.test(lowerMsg) && (addr64 || ids[0])) {
        const recipient = addr64 || ids[0];
        const days = msg.match(/(\d+)\s*(?:tage?|d|days?)/i);
        return { ok: true, text: 'Zutritt für Gast erteilen.', suggestedAction: { cmd: '/create-key', args: [LOCK_ID_PLACEHOLDER, recipient, days ? days[1] : '30'] } };
    }
    if (/ticket.*löschen|purge-ticket.*0x|ticket\s+0x.*löschen/.test(lowerMsg) && ids.length >= 1)
        return { ok: true, text: 'Ticket löschen (Rebate).', suggestedAction: { cmd: '/purge-ticket', args: [ids[0]] } };

    // "Sende X IOTA an 0x…" immer als /transfer-coins (unabhängig von Ähnlichkeit zu Beispielen)
    if (isTransferCoinsIntent(msg)) {
        const addrs = msg.match(new RegExp(ADDR, 'g'));
        const num = msg.match(/(\d+(?:\.\d+)?)\s*(?:iota|miota|i)?/i) || msg.match(/(\d+(?:\.\d+)?)/);
        if (addrs?.length && num) {
            return {
                ok: true,
                text: 'Befehl erkannt. Du kannst unten „Ja, ausführen“ wählen.',
                suggestedAction: { cmd: '/transfer-coins', args: [addrs[0], num[1]] },
            };
        }
    }

    const userTokens = tokenize(msg);
    let best: { score: number; result: AiCopilotResult } | null = null;

    for (const rule of INTENTS) {
        for (const ex of rule.examples) {
            const score = similarity(msg, ex);
            if (score < MIN_SCORE) continue;
            const out = rule.run(msg);
            if (!out) continue;
            const result: AiCopilotResult =
                'textOnly' in out && out.textOnly
                    ? { ok: true, text: out.text }
                    : {
                          ok: true,
                          text: (out as { text?: string }).text ?? 'Befehl erkannt. Du kannst unten „Ja, ausführen“ wählen.',
                          suggestedAction: { cmd: (out as { cmd: string }).cmd, args: (out as { args: string[] }).args },
                      };
            if (!best || score > best.score) best = { score, result };
        }
    }

    return best ? best.result : null;
}
