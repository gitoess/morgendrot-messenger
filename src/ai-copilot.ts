/**
 * Optionaler AI-Copilot: Intent-Matcher (Variante 1) und/oder lokales LLM (Ollama).
 * ENABLE_AI_INTENT_MATCHER und/oder ENABLE_AI_COPILOT. Bestehende Logik bleibt unverändert.
 *
 * Kontext: Es wird kein voller Chat-Verlauf (Säule 3) an die KI geschickt, nur die aktuelle Frage
 * plus lastCommandResult/lastError. Falls später Nachrichten-Verlauf übergeben wird: Rolling Window
 * nutzen (max. AI_MAX_CONTEXT_MESSAGES), um RAG-/Kontext-Überlastung zu vermeiden (siehe docs/TEST-STRATEGY.md).
 */
/** Max. Nachrichten im Kontext an Ollama, falls conversation history ergänzt wird (Rolling Window). */
const AI_MAX_CONTEXT_MESSAGES = 20;
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { CFG } from './config.js';
import { logger } from './logger.js';
import { HELP_START, HELP_CHAT } from './wallet-bridge.js';
import { APPLICATION_KNOWLEDGE, stripAnsi } from './ai-copilot-context.js';
import { tryIntentMatch, tryTransferCoinsOnly, tryInstantMapping } from './ai-intent-matcher.js';
import { retrieveRelevantChunks, isRagAvailable } from './rag-retrieval.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/** Amputation: max 10 (5 häufigste + 5 Goldene). Mehr verwässert bei Qwen 7B. */
const FEW_SHOT_MAX = 10;

type WoerterbuchEntry = { triggers: string[]; action: string; params?: string[]; confidence_base: number };
type Woerterbuch = Record<string, WoerterbuchEntry>;

let _woerterbuchCache: Woerterbuch | null = null;

function loadWoerterbuch(): Woerterbuch | null {
    if (_woerterbuchCache) return _woerterbuchCache;
    const path = join(root, 'ai-training', 'woerterbuch.json');
    if (!existsSync(path)) return null;
    try {
        const raw = readFileSync(path, 'utf8');
        _woerterbuchCache = JSON.parse(raw) as Woerterbuch;
        return _woerterbuchCache;
    } catch {
        return null;
    }
}

type WizardCommand = { cmd: string; params?: string[]; description?: string; slot_schema?: Record<string, unknown> };
type WizardTile = { id: string; title: string; short?: string; description: string; commands: WizardCommand[] };
type WizardConfig = { tiles: WizardTile[] };

let _wizardCache: WizardConfig | null = null;

function loadWizardCommands(): WizardConfig | null {
    if (_wizardCache) return _wizardCache;
    const path = join(root, 'ai-training', 'wizard-commands.json');
    if (!existsSync(path)) return null;
    try {
        const raw = readFileSync(path, 'utf8');
        _wizardCache = JSON.parse(raw) as WizardConfig;
        return _wizardCache;
    } catch {
        return null;
    }
}

/** Eine Zeile: nur Befehlsnamen der Kachel (für starken Kachel-Fokus, kleines Modell). */
function getWizardFocusLine(tileId: string): string {
    const w = loadWizardCommands();
    if (!w?.tiles?.length) return '';
    const tile = w.tiles.find((t) => t.id === tileId);
    if (!tile?.commands?.length) return '';
    const cmds = tile.commands.map((c) => c.cmd).join(', ');
    return `NUTZE NUR diese Befehle: ${cmds}. Jeder andere Befehl ist verboten.`;
}

/** Erlaubte Befehle für eine Kachel (für Repair-Parsing und Post-Filter im Wizard-Modus). */
function getWizardTileCommandSet(tileId: string): Set<string> {
    const w = loadWizardCommands();
    if (!w?.tiles?.length) return new Set();
    const tile = w.tiles.find((t) => t.id === tileId);
    if (!tile?.commands?.length) return new Set();
    return new Set(tile.commands.map((c) => c.cmd));
}

/** Liefert den System-Prompt-Zusatz für eine Wizard-Kachel: nur diese Befehle + Slots – KI macht Slot-Filling. */
function getWizardTileContext(tileId: string): string {
    const w = loadWizardCommands();
    if (!w?.tiles?.length) return '';
    const tile = w.tiles.find((t) => t.id === tileId);
    if (!tile) return '';
    const focusLine = getWizardFocusLine(tileId);
    const lines: string[] = [
        '',
        '--- DEINE ROLLE (Durchleitung, kein Fremdthema) ---',
        'Du bist NUR ein Assistent für vorgegebene Aktionen. Kein Dialog über fremde Themen, kein Smalltalk.',
        'Der Nutzer hat nur Auswahlmöglichkeiten und Felder (Adresse 0x…, Anzahl, Betrag, Text). Deine Aufgabe: Aus seiner Eingabe die Slots füllen und genau EINE ACTION aus der Liste zurückgeben. Keine Erklärungen zu anderen Themen.',
        '',
        '--- MODUS ' + tile.title.toUpperCase() + ' (GESETZ) ---',
        focusLine,
        `Kurzbeschreibung: ${tile.description || ''}`,
        'Erlaubte Befehle (action muss genau einer sein):',
    ];
    for (const c of tile.commands || []) {
        const params = (c.params && c.params.length) ? ' ' + c.params.join(' ') : '';
        lines.push(`  ${c.cmd}${params}  – ${c.description || ''}`);
        if (c.slot_schema && typeof c.slot_schema === 'object') {
            const slots = Object.keys(c.slot_schema).join(', ');
            lines.push(`    Slots: ${slots}. Aus Nutzertext extrahieren (0x…, Zahlen, Text).`);
        }
    }
    lines.push('Antworte NUR mit einem JSON-Objekt: {"thought":"...", "action":"/befehl arg1 arg2", "confidence":0.9}. Kein Text davor oder danach. Kein Thema außer den vorgegebenen Befehlen.');
    return lines.join('\n');
}

/** Extrahiert 0x… (64 Hex) und kürzere Objekt-IDs aus Nachricht. */
function extractHexIds(msg: string): string[] {
    const long = msg.match(/0x[a-fA-F0-9]{64}/g);
    if (long?.length) return long;
    return msg.match(/0x[a-fA-F0-9]+/g) || [];
}

/** Extrahiert Zahlen (inkl. Dezimal) aus Nachricht. */
function extractNumbers(msg: string): string[] {
    return msg.match(/\d+(?:\.\d+)?/g) || [];
}

/** Extrahiert Argumente für einen Befehl aus der Nutzer-Eingabe. */
function extractArgsForAction(cmd: string, msg: string): string[] {
    const ids = extractHexIds(msg);
    const nums = extractNumbers(msg);
    const lower = msg.toLowerCase();
    switch (cmd) {
        case '/create-key':
            if (ids.length >= 1) {
                const withoutAddr = msg.replace(/0x[0-9a-fA-F]+/g, ' ');
                const ttlNums = (withoutAddr.match(/\d+(?:\.\d+)?/g) || []).map((n) => parseInt(n, 10)).filter((v) => v >= 1 && v <= 365);
                let ttl = ttlNums.length ? String(ttlNums[0]) : (nums.find((n) => { const v = parseInt(n, 10); return v >= 1 && v <= 365; }) || '30');
                if (/woche|week/i.test(msg) && (ttl === '1' || msg.includes('1 woche'))) ttl = '7';
                return [CFG.LOCK_ID || CFG.MY_ADDRESS || ids[0], ids[0], ttl];
            }
            return [];
        case '/create-keys':
            if (ids.length >= 1) {
                const withoutAddr = msg.replace(/0x[0-9a-fA-F]+/g, ' ');
                const cleanNums = (withoutAddr.match(/\d+(?:\.\d+)?/g) || []).map((n) => parseInt(n, 10));
                const ttlCandidates = cleanNums.filter((v) => v >= 1 && v <= 365);
                const countCandidates = cleanNums.filter((v) => v >= 2 && v <= 100);
                const ttl = ttlCandidates.length ? String(Math.min(...ttlCandidates)) : '30';
                const count = countCandidates.length ? String(Math.max(...countCandidates)) : '1';
                return [CFG.LOCK_ID || CFG.MY_ADDRESS || ids[0], ids[0], ttl, count];
            }
            return [];
        case '/create-key-and-notify':
            if (ids.length >= 1) {
                const ttl = nums.find((n) => { const v = parseInt(n, 10); return v >= 1 && v <= 365; }) || '30';
                const quoted = msg.match(/["']([^"']*)["']/);
                const text = quoted ? quoted[1] : 'Key ausgestellt.';
                return [CFG.LOCK_ID || CFG.MY_ADDRESS || ids[0], ids[0], ttl, text];
            }
            return [];
        case '/transfer-coins':
            if (ids.length >= 1 && nums.length >= 1) return [ids[0], nums[0]];
            return [];
        case '/send-plain':
            if (ids.length >= 1) {
                const quoted = msg.match(/["']([^"']*)["']/);
                const text = quoted ? quoted[1] : msg.replace(new RegExp(ids[0], 'gi'), '').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Nachricht';
                return [ids[0], text];
            }
            return [];
        case '/handshake':
        case '/connect':
            if (ids.length >= 1) return [ids[0]];
            return cmd === '/connect' ? [] : [];
        case '/send':
            const quotedSend = msg.match(/["']([^"']*)["']/);
            if (ids.length >= 1) {
                const textFromQuoted = quotedSend ? quotedSend[1] : msg.replace(new RegExp(ids[0], 'gi'), '').replace(/\b(an alle|partner|sende|schick)\b/gi, '').trim().slice(0, 500);
                return [ids[0], textFromQuoted || 'Nachricht'];
            }
            const textSend = quotedSend ? quotedSend[1] : msg.replace(/\b0x[a-fA-F0-9]+\b/g, '').replace(/\b(an alle|partner|sende|schick)\b/gi, '').trim().slice(0, 500);
            return [textSend || 'Nachricht'];
        case '/fetch':
            if (nums.length >= 1) return ids.length >= 1 ? [nums[0], ids[0]] : [nums[0]];
            return ['20'];
        case '/list-keys':
        case '/list-tickets':
        case '/vault-save':
        case '/vault-onchain':
        case '/purge-handshake':
        case '/emergency-purge':
        case '/help':
        case '/exit':
            return [];
        case '/purge-key':
        case '/emergency-purge-key':
            if (ids.length >= 1) return [ids[0]];
            return [];
        case '/purge-ticket':
        case '/emergency-purge-ticket':
            if (ids.length >= 1) return [ids[0]];
            return [];
        case '/transfer-key':
        case '/transfer-ticket':
            if (ids.length >= 2) return [ids[0], ids[1]];
            return [];
        case '/use-ticket':
            if (ids.length >= 2) return [ids[0], ids[1]];
            return [];
        case '/purge-msg':
            if (nums.length >= 1) return [nums[0]];
            return [];
        case '/set-package-id':
            if (ids.length >= 1) return [ids[0]];
            return [];
        default:
            return ids.slice(0, 3);
    }
}

/** Prüft ob Trigger in msg vorkommt; Trigger mit Länge <=4 nur als ganzes Wort (verhindert „ende“ in „sende“). */
function triggerMatches(lower: string, trigger: string): boolean {
    const t = trigger.toLowerCase().trim();
    if (!t) return false;
    if (t.length <= 4) {
        const re = new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        return re.test(lower);
    }
    return lower.includes(t);
}

/** Wörterbuch-Strategie: Match gegen Trigger, dann Param-Extraktion. Vor Intent-Matcher und Ollama. */
function tryDictionaryMatch(msg: string): AiCopilotResult | null {
    const woerter = loadWoerterbuch();
    if (!woerter) return null;
    const lower = msg.trim().toLowerCase();
    let best: { entry: WoerterbuchEntry; key: string; matchLen: number } | null = null;
    for (const [key, entry] of Object.entries(woerter)) {
        if (key === '_meta' || !entry || typeof entry !== 'object' || !Array.isArray(entry.triggers)) continue;
        let matchLen = 0;
        const match = entry.triggers.some((t) => {
            if (!triggerMatches(lower, t)) return false;
            matchLen = Math.max(matchLen, t.length);
            return true;
        });
        if (match && (!best || entry.confidence_base > best.entry.confidence_base || (entry.confidence_base === best.entry.confidence_base && matchLen > best.matchLen))) {
            best = { entry, key, matchLen };
        }
    }
    if (!best) return null;
    const cmd = best.entry.action.startsWith('/') ? best.entry.action : '/' + best.entry.action;
    const args = extractArgsForAction(cmd, msg);
    const needsArgs: Record<string, number> = {
        '/create-key': 2, '/create-keys': 2, '/create-key-and-notify': 3,
        '/transfer-coins': 2, '/send-plain': 2, '/handshake': 1, '/purge-key': 1,
        '/purge-ticket': 1, '/use-ticket': 2, '/transfer-key': 2, '/transfer-ticket': 2,
        '/emergency-purge-key': 1, '/emergency-purge-ticket': 1, '/purge-msg': 1, '/set-package-id': 1,
    };
    const minArgs = needsArgs[cmd];
    if (minArgs != null && args.length < minArgs) {
        return {
            ok: true,
            text: `Befehl „${cmd}" erkannt, aber es fehlen Angaben (z. B. Adresse 0x… oder Betrag). Bitte präzisieren.`,
            suggestedAction: undefined,
            source: 'dictionary',
        };
    }
    return {
        ok: true,
        text: 'Befehl aus Wörterbuch. Du kannst unten „Ja, ausführen“ wählen.',
        suggestedAction: { cmd, args },
        confidence: best.entry.confidence_base,
        autoExecute: best.entry.confidence_base >= (CFG.AI_COPILOT_CONFIDENCE_THRESHOLD ?? 0.80),
        source: 'dictionary',
    };
}

/** Konvertiert Beispiel-Ausgabe in einheitliches JSON-Format (thought + action), damit das Modell konsistentes Format sieht. */
function fewShotOutputToJson(output: string): string {
    const actionMatch = output.match(/ACTION:\s*(\/[a-z0-9-]+(?:\s+[^\s]+)*)/i);
    if (actionMatch) {
        const action = actionMatch[1].trim();
        const thought = output.replace(/ACTION:.*/i, '').trim().slice(0, 120) || 'Befehl aus Nutzerwunsch.';
        return JSON.stringify({ thought, action, confidence: 1 });
    }
    if (output.trim().startsWith('{')) return output.trim();
    return JSON.stringify({ thought: output.slice(0, 100), action: null, message: output.slice(0, 80) });
}

function loadFewShotExamples(): string {
    try {
        const path = join(root, 'ai-training', 'morgendrot-dataset.jsonl');
        const raw = readFileSync(path, 'utf8');
        const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const examples: string[] = [];
        const maxIdx = Math.min(FEW_SHOT_MAX, lines.length);
        for (let idx = 0; idx < maxIdx; idx++) {
            try {
                const o = JSON.parse(lines[idx]) as { input?: string; output?: string };
                if (o.input && o.output) {
                    const answer = fewShotOutputToJson(o.output);
                    examples.push(`Frage: ${o.input}\nAntwort: ${answer}`);
                }
            } catch {
                // skip
            }
        }
        if (examples.length === 0) {
            for (let i = 0; i < Math.min(5, lines.length); i++) {
                try {
                    const o = JSON.parse(lines[i]) as { input?: string; output?: string };
                    if (o.input && o.output) examples.push(`Frage: ${o.input}\nAntwort: ${o.output}`);
                } catch {
                    // skip
                }
            }
        }
        if (examples.length === 0) return '';
        return '\n--- BEISPIELE (Antwortformat: JSON mit thought, action, confidence) ---\n' + examples.join('\n\n') + '\n';
    } catch {
        return '';
    }
}

function loadLogicChains(): string {
    try {
        const path = join(root, 'ai-training', 'logic-chains.json');
        const raw = readFileSync(path, 'utf8');
        const arr = JSON.parse(raw) as Array<{ after?: string[]; suggest?: string; then_next?: string; if_error?: string; reason?: string }>;
        if (!Array.isArray(arr) || arr.length === 0) return '';
        const lines = arr
            .map((r) => {
                if (r.after?.length && (r.suggest || r.then_next))
                    return `Nach ${r.after.map((a) => '/' + a.replace(/^\//, '')).join('/')}: ${r.suggest ? 'vorschlagen ' + r.suggest : 'dann ' + r.then_next}. ${r.reason || ''}`;
                if (r.if_error && r.suggest) return `Bei Fehler „${r.if_error}“: ${r.suggest}. ${r.reason || ''}`;
                return '';
            })
            .filter(Boolean);
        if (lines.length === 0) return '';
        return '\n--- WENN-DANN-REGELN (Chain of Thought) ---\n' + lines.join('\n') + '\n';
    } catch {
        return '';
    }
}

function loadMorgendrotRules(): string {
    const rulesPath = join(root, '.morgendrot-rules');
    if (!existsSync(rulesPath)) return '';
    try {
        const raw = readFileSync(rulesPath, 'utf8').trim();
        if (!raw) return '';
        return '\n\n--- .morgendrot-rules (Cursor-Mode) ---\n' + raw + '\n';
    } catch {
        return '';
    }
}

/** Locked Corrections (Vollzugsplan Tag 1): Kuratierte Regeln, immer im Prompt – unabhängig vom RAG-Score. */
function loadLockedCorrections(): string {
    const path = join(root, 'ai-training', 'locked-corrections.jsonl');
    if (!existsSync(path)) return '';
    try {
        const raw = readFileSync(path, 'utf8');
        const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const rules: string[] = [];
        for (const line of lines) {
            try {
                const o = JSON.parse(line) as { text?: string };
                if (typeof o?.text === 'string' && o.text.length > 5) rules.push(o.text);
            } catch {
                // skip invalid lines
            }
        }
        if (rules.length === 0) return '';
        return '\n\n--- LOCKED REGELN (immer beachten, unabhängig von RAG) ---\n' + rules.join('\n') + '\n';
    } catch {
        return '';
    }
}

/** Lädt ai-training/FILE_TREE.json (Repo-Landkarte: Datei → Funktionen). Klein, wird immer mitgegeben. */
function loadFileTree(): string {
    try {
        const p = join(root, 'ai-training', 'FILE_TREE.json');
        if (!existsSync(p)) return '';
        const raw = readFileSync(p, 'utf8');
        const arr = JSON.parse(raw) as Array<{ path: string; functions: string[] }>;
        if (!Array.isArray(arr) || arr.length === 0) return '';
        const lines = arr.map((e) => e.path + (e.functions.length ? ': ' + e.functions.join(', ') : ''));
        return '\n--- REPO-LANDKARTE (Funktionen pro Datei) ---\n' + lines.slice(0, 200).join('\n') + '\n';
    } catch {
        return '';
    }
}

/** Lädt docs/context_map.md (Der Index). Vor jeder KI-Anfrage an den Anfang gesetzt. */
function loadContextMap(): string {
    try {
        const path = join(root, 'docs', 'context_map.md');
        if (!existsSync(path)) return '';
        const raw = readFileSync(path, 'utf8').trim();
        if (!raw) return '';
        return '\n--- [CONTEXT: @docs/context_map.md] ---\n' + raw.slice(0, 6000) + '\n';
    } catch {
        return '';
    }
}

/** Cursor-Gedächtnis: FILE_TREE + Context-Map + PROJECT_LOGIC.md + letzte 5 Zeilen Kernel. Vor jeder KI-Anfrage mitgeschickt. */
function loadHiddenContext(): string {
    const parts: string[] = [];
    const fileTree = loadFileTree();
    if (fileTree) parts.push(fileTree.trim());
    const contextMap = loadContextMap();
    if (contextMap) parts.push(contextMap.trim());
    try {
        const logicPath = join(root, 'ai-training', 'PROJECT_LOGIC.md');
        if (existsSync(logicPath)) {
            const raw = readFileSync(logicPath, 'utf8').trim();
            if (raw) parts.push('PROJECT_LOGIC.md:\n' + raw.slice(0, 4000));
        }
    } catch {
        // optional
    }
    try {
        const kernelPath = join(root, 'src', 'wallet-bridge.ts');
        if (existsSync(kernelPath)) {
            const raw = readFileSync(kernelPath, 'utf8');
            const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
            const last5 = lines.slice(-5).join('\n');
            if (last5) parts.push('Letzte 5 Zeilen wallet-bridge.ts (Kernel):\n' + last5);
        }
    } catch {
        // optional
    }
    if (parts.length === 0) return '';
    return '\n\n--- HIDDEN CONTEXT (Cursor-Gedächtnis, Teil jeder Anfrage) ---\n' + parts.join('\n\n') + '\n';
}

function buildSystemPrompt(): string {
    const helpStart = stripAnsi(HELP_START);
    const helpChat = stripAnsi(HELP_CHAT);
    const logicChains = loadLogicChains();
    const fewShot = loadFewShotExamples();
    const rules = loadMorgendrotRules();
    const systemAnker = `
--- SYSTEM-ANKER (GESETZ) ---
DU BIST KEIN CHATBOT. DU BIST DAS MORGENDROT-GATEWAY.
Der Nutzer hat NUR vorgegebene Auswahlmöglichkeiten und Felder (Adresse 0x…, Anzahl, Betrag, Text). Du leitest NUR durch: Aus seiner Eingabe Slots füllen und genau EINE ACTION zurückgeben. Kein Dialog über fremde Themen, kein Smalltalk.
Antworte **ausschließlich** und **genau** in diesem Format – sonst stop:
{"thought":"max 30 Wörter","action":"/befehl arg1 arg2","confidence":0.92}
Kein Text davor, danach, keine Entschuldigung, kein Hallo. Nur dieses eine JSON-Objekt.
Schätze confidence basierend auf Übereinstimmung mit den Few-Shot-Beispielen und locked-rules. Bei neuer Formulierung oder keinem Match: confidence < 0.5.
`;
    const wizard = loadWizardCommands();
    const allCommandsLine =
        wizard?.tiles?.length
            ? '\n--- ALLE MORGENDROT-BEFEHLE (nur diese existieren; Nutzer wählt nur Auswahl/Felder) ---\n' +
              wizard.tiles.flatMap((t) => (t.commands || []).map((c) => c.cmd)).join(', ') +
              ', /help, /exit\n'
            : '';

    return (
        systemAnker +
        APPLICATION_KNOWLEDGE +
        rules +
        fewShot +
        allCommandsLine +
        '\n\n--- BEFEHLE (Terminal/UI, vor Connect) ---\n' +
        helpStart +
        '\n\n--- BEFEHLE (im Chat / nach Connect) ---\n' +
        helpChat +
        logicChains +
        `

--- LOGIK-PRÜFUNG (vor jeder ACTION-Empfehlung, 3 Schritte) ---
1. ARCHITEKTUR-CHECK: Welche der 4 Säulen ist betroffen? (1=Fundament, 2=Kanal/Handshake, 3=Aktivität/Senden/Keys, 4=Nachsorge/Rebate)
2. ABHÄNGIGKEIT: Ist die Voraussetzung erfüllt? (z. B. Säule 1 für alle Chain-Aktionen; Säule 2 für /send; kein /send ohne Verbindung)
3. ÖKONOMIE: Kann ein IOTA-Rebate entstehen? Nach Key/Ticket/Handshake: /purge-key, /purge-ticket, /purge-handshake vorschlagen (wenn ENABLE_PURGE).

--- ARGUMENTE AUS DER NUTZER-EINGABE (wichtig) ---
• Die Nutzer-Eingabe enthält oft Adressen und Zahlen. Du MUSST sie in die ACTION-Zeile übernehmen.
• Bei „sende X IOTA an 0x…“ / „überweise X an 0x…“: Suche in der Eingabe nach 0x gefolgt von 64 Hex-Zeichen (Adresse) und nach einer Zahl (Betrag). Schreibe genau: ACTION: /transfer-coins <diese_Adresse> <diese_Zahl>. Nie ACTION: /transfer-coins ohne beide Argumente.
• Bei „verschlüsselt an 0x… senden“: Adresse (0x+64 Hex) in ACTION: /handshake <Adresse> übernehmen.
• Bei „Klartext … an 0x…“: Adresse und Text in ACTION: /send-plain <Adresse> <Text> übernehmen.
• Adresse = immer 0x + genau 64 Hex-Zeichen (a-fA-F0-9). Keine Abkürzung wie „0x…“.

--- WICHTIG: Verschiedene Befehle – welche Schritte nötig? ---
• Tickets und /create-key brauchen KEINEN Handshake, KEINEN /connect. Nie Handshake vorschlagen nur weil „Ticket“ oder „Einladung“ im Satz vorkommt.
• Wenn Nutzer „Nachricht/Einladung an 0x… senden“ sagt OHNE „verschlüsselt“ oder „Klartext“: NICHT raten. Kurz NACHFRAGEN: „Wie soll es ankommen? (1) Klartext → /send-plain, sofort. (2) Verschlüsselt → zuerst /handshake, Partner /connect, dann /send.“ Keine ACTION-Zeile ausführen, bis Nutzer wählt.
• Wenn im Kontext „Verbunden (Chat): nein“ steht: NIEMALS /send vorschlagen. Stattdessen zuerst ACTION: /handshake 0x… oder ACTION: /connect 0x… (Partner muss /connect ausführen). /send erst nach Verbindung.
• IOTA/Coins an Adresse senden: NUR EIN Schritt – ACTION: /transfer-coins … KEIN /connect nötig.
• Nur wenn Nutzer ausdrücklich „verschlüsselt“ will: Zuerst /handshake oder /connect, dann /send. Sonst bei „senden“ nachfragen (Klartext vs. verschlüsselt).
• Mehrere Aktionen: Pro Antwort nur EINE ACTION-Zeile. Wichtigste zuerst. Im Text weitere Schritte nennen. PTB nur Key+Nachricht (/create-key-and-notify).

--- ANTWORT-REGELN ---
• Immer nur EINE ACTION-Zeile pro Antwort. Adressen als 0x + 64 Hex-Zeichen (z. B. 0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5). Beträge als Zahl (1, 0.5), keine Anführungszeichen.
• Wenn im Kontext ein „Letzter Fehler“ steht: Gehe darauf ein und schlage die passende Korrektur vor (z. B. /connect oder Säule 1 prüfen).
• Reihenfolge bei Unsicherheit: Zuerst Säule 1 (MY_ADDRESS, PACKAGE_ID, RPC), dann Säule 2 (Handshake/Connect), dann Aktion.
• Wenn die Nutzerfrage mit „sag der ki …“, „mache …“, „führe aus …“ beginnt: Der folgende Satzteil ist die eigentliche Anweisung. Reagiere NUR auf diese eine Anweisung mit genau einer ACTION-Zeile.

--- VERBOTEN (kleine Modelle dürfen das NICHT erfinden) ---
Du bist NUR der Morgendrot-Assistent für IOTA Rebased (Befehle, Säulen, Keys, Nachrichten). Kein Gespräch über Themen außer Morgendrot-Befehlen und Slots (Adresse 0x…, Betrag, Anzahl, Text). Du kennst KEINE Passwörter, KEINE Datenbanken, KEINE „Online-Marken“, KEIN „Nutzer-Modell“ außer Adressen (0x…). Erfinde NIEMALS Texte über „Rolle“, „Management“, „Passwörter für Gast Account“ oder ähnliches. Jede Antwort muss entweder (1) mit genau einer Zeile „ACTION: /befehl arg1 arg2“ enden oder (2) eine kurze Morgendrot-Hilfe sein (Säulen, /help, Befehle). Kein anderer Inhalt.
NIEMALS Sätze wie „Ich bin ein Chatbot“, „Ich habe keine persönlichen Daten“, „Ich speichere nichts“ oder „Ich bin eine künstliche Intelligenz“ ausgeben. Wenn der Nutzer eine Aktion will (z. B. „sende … an 0x“, „verbinde“, „Key“): immer mit ACTION: /befehl antworten.

--- DEINE ROLLE (wichtig für kleine Modelle wie Qwen 0.5B) ---
Antworte in 1–3 Sätzen auf Deutsch. Kein Roman. Wenn du genau einen Befehl vorschlägst, beende mit genau einer Zeile:
ACTION: /befehl arg1 arg2
`
    );
}

/** System-Prompt für Planer-Modus: Nutzerwunsch in eine Liste von Schritten zerlegen (kein einzelner Befehl). */
function buildPlannerSystemPrompt(): string {
    return (
        APPLICATION_KNOWLEDGE +
        `

--- DEINE ROLLE: NUR PLANER (Übersetzer) ---
Der Nutzer beschreibt, was er will (z. B. "Richte alles für Gast 0x0748 ein und schick ihm einen Schlüssel für 2 Tage").
Du antwortest NUR mit einer nummerierten Liste von Schritten. Kein Einzelbefehl, keine ACTION-Zeile.
Jede Zeile im Format: SCHRITT: AKTION Kurzbeschreibung.
Adressen (0x + 64 Hex) und Zahlen (Tage, IOTA) aus der Nutzerfrage MUST du in die Beschreibung übernehmen.

--- ERLAUBTE AKTIONEN (genau diese Bezeichner verwenden) ---
CHECK_SETUP    – Säule 1 prüfen (MY_ADDRESS, PACKAGE_ID).
SET_PACKAGE_ID – Package-ID setzen (wenn Adresse genannt).
HANDSHAKE      – ECDH-Handshake an Partner (Adresse aus Nutzertext).
CONNECT        – Auf Handshake warten, Chat starten.
CREATE_KEY     – AccessKey für Gast (Adresse, optional Tage).
CREATE_KEY_AND_NOTIFY – Key ausstellen und Klartext-Benachrichtigung senden.
SEND_MSG       – Verschüsselte Nachricht senden (nach Connect).
SEND_PLAIN     – Klartext senden (Adresse + Text).
TRANSFER_COINS – IOTA an Adresse senden (Adresse + Betrag).
CREATE_TICKET  – Ticket für Event an Adresse.
VAULT_SAVE     – Keys lokal sichern.
FETCH          – Nachrichten holen.
PURGE_HANDSHAKE – Handshake aus Mailbox löschen.
PURGE_KEY      – Key löschen (Rebate).
LIST_KEYS      – AccessKeys auflisten.
LIST_TICKETS   – Tickets auflisten.

--- REIHENFOLGE ---
1. Zuerst CHECK_SETUP oder SET_PACKAGE_ID wenn nötig.
2. Für verschlüsselte Kommunikation: HANDSHAKE, dann CONNECT (Partner führt aus), dann SEND_MSG.
3. Keys/Tickets brauchen KEINEN Handshake. CREATE_KEY oder CREATE_TICKET mit Adresse aus dem Text.
4. Bei "Gast einrichten + Schlüssel": CHECK_SETUP, HANDSHAKE (wenn verschlüsselt), CREATE_KEY (Adresse + Tage), optional SEND_PLAIN zur Bestätigung.

--- AUSGABE (nur diese Zeilen, sonst nichts) ---
SCHRITT: CHECK_SETUP Prüfe Säule 1 (Package & ID).
SCHRITT: HANDSHAKE Starte Verschlüsselung mit 0x...
SCHRITT: CREATE_KEY Erzeuge AccessKey für 2 Tage an 0x...
SCHRITT: SEND_PLAIN Sende Bestätigung an 0x...
`
    );
}

/** Parst Ollama-Antwort im Planer-Modus: Zeilen "SCHRITT: AKTION Beschreibung". */
function parsePlanResponse(content: string): Array<{ action: string; description: string }> {
    const steps: Array<{ action: string; description: string }> = [];
    const re = /SCHRITT:\s*([A-Z_]+)\s+(.+)/i;
    for (const line of content.split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        const m = t.match(re);
        if (m) {
            const action = m[1].toUpperCase().replace(/\s+/g, '_');
            const description = m[2].trim();
            if (action && description) steps.push({ action, description });
        }
    }
    return steps;
}

/** Adresse 0x + 64 Hex aus Text. */
function extractAddr(text: string): string | null {
    const m = text.match(/0x[a-fA-F0-9]{64}/);
    return m ? m[0] : null;
}

/** Zahl (Tage, IOTA) aus Text. */
function extractNumber(text: string): string | null {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(?:tage?|d|days?|iota|miota|i)?/i) || text.match(/(\d+(?:\.\d+)?)/);
    return m ? m[1] : null;
}

/** Mappt Plan-Schritte auf konkrete Befehle (cmd + args). */
function planStepsToCommands(
    steps: Array<{ action: string; description: string }>,
    userMessage: string,
): PlanStep[] {
    const allText = userMessage + ' ' + steps.map((s) => s.description).join(' ');
    const defaultAddr = extractAddr(allText);
    const defaultDays = extractNumber(allText) || '30';
    const result: PlanStep[] = [];

    for (const step of steps) {
        const desc = step.description;
        const addr = extractAddr(desc) || defaultAddr;
        const days = extractNumber(desc) || defaultDays;
        const num = extractNumber(desc);

        let suggestedCommand: { cmd: string; args: string[] } | undefined;
        switch (step.action) {
            case 'CHECK_SETUP':
                suggestedCommand = { cmd: '/help', args: [] };
                break;
            case 'SET_PACKAGE_ID':
                if (addr) suggestedCommand = { cmd: '/set-package-id', args: [addr] };
                break;
            case 'HANDSHAKE':
                if (addr) suggestedCommand = { cmd: '/handshake', args: [addr] };
                break;
            case 'CONNECT':
                suggestedCommand = { cmd: '/connect', args: addr ? [addr] : [] };
                break;
            case 'CREATE_KEY':
                if (addr) suggestedCommand = { cmd: '/create-key', args: ['<LOCK_ID>', addr, days] };
                break;
            case 'CREATE_KEY_AND_NOTIFY':
                if (addr) suggestedCommand = { cmd: '/create-key-and-notify', args: ['<LOCK_ID>', addr, days, 'Key ausgestellt. Einlass freigegeben.'] };
                break;
            case 'SEND_MSG':
                suggestedCommand = { cmd: '/send', args: [desc.replace(/^.*0x[a-fA-F0-9]{64}\s*/i, '').trim() || 'Nachricht'] };
                break;
            case 'SEND_PLAIN':
                if (addr) suggestedCommand = { cmd: '/send-plain', args: [addr, desc.replace(/0x[a-fA-F0-9]{64}/i, '').trim() || 'Bestätigung'] };
                break;
            case 'TRANSFER_COINS':
                if (addr && num) suggestedCommand = { cmd: '/transfer-coins', args: [addr, num] };
                break;
            case 'CREATE_TICKET':
                if (addr) suggestedCommand = { cmd: '/create-ticket', args: ['<event_id>', '0', String(Date.now() + 7 * 24 * 60 * 60 * 1000), '0x', addr] };
                break;
            case 'VAULT_SAVE':
                suggestedCommand = { cmd: '/vault-save', args: [] };
                break;
            case 'FETCH':
                suggestedCommand = { cmd: '/fetch', args: ['20'] };
                break;
            case 'PURGE_HANDSHAKE':
                suggestedCommand = { cmd: '/purge-handshake', args: [] };
                break;
            case 'PURGE_KEY':
                if (addr) suggestedCommand = { cmd: '/purge-key', args: [addr] };
                break;
            case 'LIST_KEYS':
                suggestedCommand = { cmd: '/list-keys', args: [] };
                break;
            case 'LIST_TICKETS':
                suggestedCommand = { cmd: '/list-tickets', args: [] };
                break;
            default:
                break;
        }
        result.push({ action: step.action, description: step.description, suggestedCommand });
    }
    return result;
}

/** Ein geplanter Schritt (Ollama als Übersetzer: Wunsch → Liste von Aktionen). */
export type PlanStep = {
    action: string;
    description: string;
    /** Konkreter Befehl für diesen Schritt (aus Beschreibung/User-Text abgeleitet). */
    suggestedCommand?: { cmd: string; args: string[] };
};

/** Latenz-Breakdown (Ollama-Pfad): immer gesetzt, auch bei Fehler (damit Dashboard nicht crasht). */
export type AiCopilotTimings = {
    ragRetrievalMs: number;
    ollamaCallMs: number;
    postFilterMs: number;
    totalMs: number;
    /** Bei Fehler: Zeit ab Fehlereintritt bis Response (z. B. Timeout/Parse). */
    errorMs?: number;
};

/** Herkunft der vorgeschlagenen Action (für Blind-Tests: Intent vs. Ollama auswerten). */
export type AiCopilotSource = 'direct' | 'dictionary' | 'intent' | 'ollama';

export type AiCopilotResult = {
    ok: boolean;
    text?: string;
    error?: string;
    /** Nur Antworttext, kein ausführbarer Befehl (z. B. Rückfrage, Hilfe). */
    textOnly?: true;
    /** Wenn die KI einen Befehl vorschlägt (ACTION-Zeile oder JSON action). */
    suggestedAction?: { cmd: string; args: string[] };
    /** Woher die Action stammt: direct = Nutzer tippte /befehl, intent = Intent-Matcher, ollama = LLM. */
    source?: AiCopilotSource;
    /** Wenn planOnly: Liste der geplanten Schritte (Ollama zerlegt Wunsch in Einzelaktionen). */
    plan?: { steps: PlanStep[] };
    /** Strict-JSON-Mode: kurze Begründung (thought). */
    thought?: string;
    /** Strict-JSON-Mode: Konfidenz 0–1. Bei >= THRESHOLD: Auto-Executor darf ausführen. */
    confidence?: number;
    /** true wenn confidence >= Threshold (Default 0.75) – UI führt Befehl sofort aus (grün). Sonst nur Vorschlag mit Buttons (gelb). */
    autoExecute?: boolean;
    /** Latenz-Breakdown (RAG, Ollama, Post-Filter) – nur bei Ollama-Pfad gesetzt. */
    timings?: AiCopilotTimings;
};

/** Optionaler Kontext (z. B. aus UI): aktueller Stand, damit die KI konkreter antworten kann. */
export type AiCopilotContext = {
    myAddressSet?: boolean;
    packageIdSet?: boolean;
    connected?: boolean;
    role?: string;
    /** Resultat des zuletzt ausgeführten Befehls (Agentic: KI "sieht" was passiert ist). */
    lastCommandResult?: string;
    /** Letzter Fehler (z. B. aus Terminal/API). KI kann konkrete Korrektur vorschlagen. */
    lastError?: string;
    /** Aktive Kachel/Projekt (z. B. chat, ticket, boss) – KI schlägt nur passende Schritte vor. */
    project?: string;
};

/** Welche KI-Backends die UI ausgewählt hat. Fehlt = Config nutzen (alle aktivierten). */
export type AiCopilotOptions = {
    useIntentMatcher?: boolean;
    useOllama?: boolean;
    /** Ollama als Planer: Wunsch in mehrere Schritte zerlegen (CHECK_SETUP, HANDSHAKE, CREATE_KEY, …). */
    planOnly?: boolean;
    /** Wizard-Kachel: KI bekommt nur Befehle dieser Kachel (nachricht|zutritt|tickets|rebate) – Slot-Filling. */
    wizardTileId?: string;
};

/**
 * Sendet die Nutzer-Nachricht an das konfigurierte LLM (Ollama) und parst die Antwort.
 * systemPrompt enthält die komplette Anwendung (Befehle, Config, Architektur, 4 Säulen).
 * Bei deaktiviertem Copilot: ok false, error gesetzt.
 */
/** Bekannte Befehle für Vorfilter: wenn der Nutzer schon einen Befehl tippt, nicht Ollama aufrufen. */
const COMMAND_PATTERN = /^\s*(\/(?:create-key|create-keys|handshake|connect|send|send-plain|fetch|set-package-id|vault-save|vault-onchain|purge-handshake|purge-msg|purge-key|transfer-coins|list-keys|list-tickets|create-ticket|use-ticket|purge-ticket|transfer-key|transfer-ticket|emergency-purge|emergency-purge-key|emergency-purge-ticket|create-key-and-notify))(?:\s+(.+))?$/i;

/** Parser-Käfig: Stop-Sequenzen für Ollama (kein Text außerhalb JSON). */
const OLLAMA_STOP_TOKENS = [
    '\n{', '}\n', 'Kein Befehl', 'Entschuldigung', 'Hallo', 'Gerne', 'verstanden', 'User:', 'Antwort:', 'Sehr geehrte',
    'Ich bin', 'tut mir leid', 'klar', 'ok',
];

function tryDirectCommand(msg: string): AiCopilotResult | null {
    const m = msg.match(COMMAND_PATTERN);
    if (!m) return null;
    const cmd = m[1].toLowerCase();
    const rest = (m[2] ?? '').trim();
    const args = rest ? rest.split(/\s+/).map((a) => a.trim()).filter(Boolean) : [];
    return { ok: true, text: 'Befehl erkannt. Du kannst unten „Ja, ausführen“ wählen.', suggestedAction: { cmd, args } };
}

/** Cursor-Workflow: "sag der ki mache …" / "mache …" / "führe aus …" → nur der Rest ist die Anweisung. */
function normalizeUserInstruction(raw: string): string {
    let s = (raw || '').trim();
    if (!s) return s;
    const prefixes = [
        /^sag\s+der\s+ki\s+(?:mache\s+)?/i,
        /^sag\s+der\s+ki\s+/i,
        /^lass\s+(?:die\s+)?ki\s+(?:mache\s+)?/i,
        /^lass\s+(?:die\s+)?ki\s+/i,
        /^führe\s+aus\s*:\s*/i,
        /^führe\s+aus\s+/i,
        /^mache\s+(?:bitte\s+)?/i,
        /^führe\s+(?:bitte\s+)?(?:aus\s+)?/i,
    ];
    for (const p of prefixes) {
        const t = s.replace(p, '').trim();
        if (t.length > 0 && t !== s) {
            s = t;
            break;
        }
    }
    return s;
}

export async function askAiCopilot(
    userMessage: string,
    context?: AiCopilotContext,
    options?: AiCopilotOptions,
): Promise<AiCopilotResult> {
    let msg = (userMessage || '').trim();
    if (!msg) return { ok: false, error: 'Keine Nachricht angegeben.' };
    msg = normalizeUserInstruction(msg);
    if (!msg) {
        return {
            ok: false,
            error: 'Was soll die KI machen? Z. B. „sag der ki lass gast 0x… rein“ oder „mache handshake an 0x…“.',
        };
    }

    const useOllama = options?.useOllama !== false && CFG.ENABLE_AI_COPILOT && !!CFG.OLLAMA_URL?.trim();

    // Planer-Modus: Ollama zerlegt Wunsch in mehrere Schritte (kein Intent, kein Einzelbefehl).
    if (options?.planOnly) {
        if (!useOllama) {
            return {
                ok: false,
                error: 'Planer-Modus braucht Ollama. ENABLE_AI_COPILOT und OLLAMA_URL in .env setzen, Ollama starten.',
            };
        }
        const systemPrompt = buildPlannerSystemPrompt();
        const parts: string[] = [];
        if (context?.project) parts.push('Kontext/Kachel: ' + context.project);
        if (context?.myAddressSet !== undefined) parts.push('MY_ADDRESS gesetzt: ' + (context.myAddressSet ? 'ja' : 'nein'));
        if (context?.packageIdSet !== undefined) parts.push('PACKAGE_ID gesetzt: ' + (context.packageIdSet ? 'ja' : 'nein'));
        if (context?.connected !== undefined) parts.push('Verbunden: ' + (context.connected ? 'ja' : 'nein'));
        const userContent = parts.length > 0 ? 'Aktueller Stand: ' + parts.join('. ') + '.\n\nNutzerwunsch: ' + msg : msg;
        const url = `${CFG.OLLAMA_URL.replace(/\/$/, '')}/api/chat`;
        const body = {
            model: CFG.OLLAMA_MODEL || 'qwen2:0.5b',
            stream: false,
            options: { num_predict: 400 },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
        };
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const t = await res.text();
                return { ok: false, error: 'Ollama Planer: ' + res.status + ' ' + t.slice(0, 150) };
            }
            const data = (await res.json()) as { message?: { content?: string }; error?: string };
            const content = (data.message?.content ?? data.error ?? '').trim();
            const rawSteps = parsePlanResponse(content);
            const steps = planStepsToCommands(rawSteps, msg);
            return {
                ok: true,
                text: content || 'Keine Schritte erkannt. Formuliere z. B. „Richte alles für Gast 0x… ein und schick ihm einen Schlüssel für 2 Tage.“',
                plan: steps.length > 0 ? { steps } : undefined,
            };
        } catch (e: any) {
            return {
                ok: false,
                error: 'Ollama Planer nicht erreichbar: ' + String(e?.message || e),
            };
        }
    }

    const direct = tryDirectCommand(msg);
    if (direct) return { ...direct, source: 'direct' };

    const dictionary = tryDictionaryMatch(msg);
    if (dictionary) return dictionary;

    const useIntent = options?.useIntentMatcher === true || (options?.useIntentMatcher !== false && CFG.ENABLE_AI_INTENT_MATCHER);

    if (useIntent) {
        const intent = tryIntentMatch(msg);
        if (intent) return { ...intent, source: 'intent' };
    } else {
        const transfer = tryTransferCoinsOnly(msg);
        if (transfer) return transfer;
        const instant = tryInstantMapping(msg);
        if (instant) return instant;
    }

    if (!useOllama) {
        return {
            ok: false,
            error: 'Kein Treffer. Wähle in der UI Intent-Matcher und/oder Ollama, oder aktiviere sie in .env (ENABLE_AI_INTENT_MATCHER, ENABLE_AI_COPILOT).',
        };
    }

    const noCommandRegex = /(wie viel|was kostet|erkläre\s+mir|erklär\s+mal|erkläre\s+mal)/i;
    if (noCommandRegex.test(msg)) {
        return {
            ok: true,
            text: '? (Kein Befehl – z. B. „sende 1 iota an 0x…“, „lass gast 0x… rein“.)',
            suggestedAction: undefined,
            source: 'ollama',
        };
    }
    const verbRegex = /(sende|schick|purge|lösche|lass|öffne|create|key|ticket|pay|zahle|mach\s*(auf|zu|offen)?|gib|erstell|freischalt|zugang|einlass|verbinde|connect|handshake|vault|status|help|liste|zeig|hole)/i;
    if (!verbRegex.test(msg)) {
        return {
            ok: true,
            text: '? (Verb erforderlich: z. B. sende, lass, purge, erstelle, zahle …)',
            suggestedAction: undefined,
            source: 'ollama',
        };
    }

    const totalStart = performance.now();
    let tRagStart = totalStart;
    let tRagEnd = totalStart;
    let tOllamaStart = totalStart;
    let tOllamaEnd = totalStart;

    let systemPrompt = buildSystemPrompt();
    systemPrompt += loadLockedCorrections();
    if (options?.wizardTileId) {
        const wizardContext = getWizardTileContext(options.wizardTileId);
        if (wizardContext) {
            // Kachel-Fokus: Wizard-Block VORAN stellen, damit kleines Modell nur 2–7 Befehle sieht
            systemPrompt = wizardContext + '\n\n--- Weitere Anker (optional) ---\n' + systemPrompt.slice(0, 1800);
        }
    }
    if (isRagAvailable()) {
        try {
            tRagStart = performance.now();
            const rag = await retrieveRelevantChunks(msg, {
                topK: CFG.RAG_TOP_K,
                expandReferences: CFG.RAG_EXPAND_REFERENCES,
            });
            tRagEnd = performance.now();
            if (rag?.text?.trim()) {
                systemPrompt += '\n\n--- RELEVANTE DOKU (RAG, zur Nutzerfrage) ---\n' + rag.text.trim().slice(0, 6000) + '\n\nNutze diese RELEVANTE DOKU für Fakten zu Befehlen, Säulen und Abhängigkeiten. Sie hat Priorität bei Widersprüchen. Eine Anweisung pro Nutzerfrage – daraus die eine passende ACTION ableiten.';
            }
        } catch (_) {
            tRagEnd = performance.now();
            // RAG optional, bei Fehler ohne RAG weitermachen
        }
    }

    // Context-Inject (Cursor-Trick): Anfrage nicht „nackt“, sondern mit klarer Anweisung „nur Befehl“
    const parts: string[] = [];
    if (context?.project) parts.push('Kontext/Kachel: ' + context.project);
    if (context?.myAddressSet !== undefined) parts.push('MY_ADDRESS gesetzt: ' + (context.myAddressSet ? 'ja' : 'nein'));
    if (context?.packageIdSet !== undefined) parts.push('PACKAGE_ID gesetzt: ' + (context.packageIdSet ? 'ja' : 'nein'));
    if (context?.connected !== undefined) parts.push('Verbunden (Chat): ' + (context.connected ? 'ja' : 'nein'));
    if (context?.role) parts.push('ROLE: ' + context.role);
    if (context?.lastCommandResult && context.lastCommandResult.trim())
        parts.push('Resultat des letzten Befehls: ' + context.lastCommandResult.trim());
    if (context?.lastError && context.lastError.trim())
        parts.push('Letzter Fehler: ' + context.lastError.trim());
    const injectSuffix =
        '\n\nAntworte NUR mit einem JSON-Objekt: {"thought":"Kurze Begründung","action":"/befehl arg1 arg2","confidence":0.0-1.0}. Kein anderer Text.';
    const baseUser =
        parts.length > 0
            ? 'Du kennst die 4 Säulen. Aktueller Stand: ' + parts.join('. ') + '.\n\nDer User will: ' + msg + injectSuffix
            : 'Der User will: ' + msg + injectSuffix;
    // Context-Injection (Cursor-Gedächtnis): PROJECT_LOGIC.md + letzte 5 Zeilen Kernel – Teil jeder Anfrage
    const userContent = loadHiddenContext() + baseUser;
    const userContentStrict = loadHiddenContext() + 'Antworte NUR mit JSON – kein Text! Der User will: ' + msg + injectSuffix;

    const url = `${CFG.OLLAMA_URL.replace(/\/$/, '')}/api/chat`;
    const maxAttempts = 2;
    let lastContent = '';

    const buildTimings = (errorMs?: number): AiCopilotTimings => {
        const now = performance.now();
        return {
            ragRetrievalMs: Math.round(tRagEnd - tRagStart),
            ollamaCallMs: Math.round(tOllamaEnd - tOllamaStart),
            postFilterMs: Math.round(now - tOllamaEnd),
            totalMs: Math.round(now - totalStart),
            ...(errorMs != null && errorMs >= 0 ? { errorMs: Math.round(errorMs) } : {}),
        };
    };

    try {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const body = {
                model: CFG.OLLAMA_MODEL || 'qwen2:0.5b',
                stream: false,
                stop: OLLAMA_STOP_TOKENS,
                options: attempt === 0 ? { num_predict: 80, temperature: 0.1 } : { num_predict: 80, temperature: 0.05, top_p: 0.1 },
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: attempt === 1 ? userContentStrict : userContent },
                ],
            };

            if (CFG.AI_DEBUG_OLLAMA) {
                logger.info('Ollama DEBUG systemPrompt (first 2500 chars): ' + systemPrompt.slice(0, 2500) + (systemPrompt.length > 2500 ? '...' : ''));
                logger.info('Ollama DEBUG userContent (first 1200 chars): ' + userContent.slice(0, 1200) + (userContent.length > 1200 ? '...' : ''));
            }
            tOllamaStart = performance.now();
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                tOllamaEnd = performance.now();
                const t = await res.text();
                logger.warn('Ollama AI-Copilot: ' + res.status + ' ' + t.slice(0, 200));
                return {
                    ok: false,
                    error: 'Ollama antwortet nicht (z. B. Modell nicht geladen). Starte: ollama run ' + (CFG.OLLAMA_MODEL || 'qwen2:0.5b'),
                    timings: buildTimings(),
                };
            }
            const data = (await res.json()) as { message?: { content?: string }; error?: string };
            tOllamaEnd = performance.now();
            let content = (data.message?.content ?? data.error ?? '').trim();
            lastContent = content;
            if (CFG.AI_DEBUG_OLLAMA) logger.info('Ollama DEBUG raw response (first 1500 chars): ' + content.slice(0, 1500) + (content.length > 1500 ? '...' : ''));
            if (!content) {
                return { ok: true, text: '(Keine Antwort vom Modell.)', source: 'ollama', timings: buildTimings() };
            }
            let cleaned = content.match(/\{[\s\S]*\}/)?.[0] ?? content.trim();
            if (!cleaned.startsWith('{')) {
                if (cleaned.includes('{')) cleaned = cleaned.slice(cleaned.indexOf('{'));
                if (cleaned.includes('}')) cleaned = cleaned.slice(0, cleaned.lastIndexOf('}') + 1);
            }
            cleaned = cleaned.trim();
            const rawTrim = cleaned;
            if (!rawTrim.startsWith('{') || !rawTrim.includes('"action"')) {
                if (CFG.AI_DEBUG_OLLAMA) logger.warn('Ollama: KI liefert Text statt JSON (Hard-Check).');
                if (attempt === 0) continue;
                const allowed = options?.wizardTileId ? getWizardTileCommandSet(options.wizardTileId) : ALLOWED_AI_COMMANDS;
                const repair = repairParseAction(content, msg, allowed);
                if (repair) {
                    return { ok: true, text: 'Befehl aus Antwort extrahiert (Repair).', suggestedAction: repair, source: 'ollama', timings: buildTimings() };
                }
                return { ok: true, text: '? (Antwort kein gültiges JSON mit action)', suggestedAction: undefined, source: 'ollama', timings: buildTimings() };
            }

            let jsonPayload = parseStrictJson(cleaned);
            if (!jsonPayload && attempt === 0) continue;
            if (!jsonPayload) {
                const allowed = options?.wizardTileId ? getWizardTileCommandSet(options.wizardTileId) : ALLOWED_AI_COMMANDS;
                const repair = repairParseAction(content, msg, allowed);
                if (repair) {
                    return { ok: true, text: 'Befehl aus Antwort extrahiert (Repair).', suggestedAction: repair, source: 'ollama', timings: buildTimings() };
                }
                return { ok: true, text: '? (Antwort kein gültiges JSON)', suggestedAction: undefined, source: 'ollama', timings: buildTimings() };
            }
            if (jsonPayload) {
                if ('noAction' in jsonPayload && jsonPayload.noAction) {
                    return { ok: true, text: jsonPayload.message || '?', suggestedAction: undefined, source: 'ollama', timings: buildTimings() };
                }
                if ('cmd' in jsonPayload) {
                    const j = jsonPayload;
                    const confidence = Math.min(1, Math.max(0, j.confidence));
                    const threshold = CFG.AI_COPILOT_CONFIDENCE_THRESHOLD ?? 0.80;
                    const confidenceGateMin = 0.7; // Unter 0.7 keine Action ausgeben → nur "?"
                    if (confidence < confidenceGateMin) {
                        return { ok: true, text: '? (Confidence zu niedrig – bitte präzisieren)', suggestedAction: undefined, confidence, source: 'ollama', timings: buildTimings() };
                    }
                    return {
                        ok: true,
                        text: j.thought || j.cmd + (j.args.length ? ' ' + j.args.join(' ') : ''),
                        suggestedAction: { cmd: j.cmd, args: j.args },
                        thought: j.thought,
                        confidence,
                        autoExecute: confidence >= threshold,
                        source: 'ollama',
                        timings: buildTimings(),
                    };
                }
            }

            content = stripContentBeforeAction(content);
            const suggestedAction = parseActionLine(content);
            if (suggestedAction) {
                // Kein JSON → keine Confidence → Gate: keine Action, nur "?"
                return { ok: true, text: '? (Unsicher - bitte präzisieren)', suggestedAction: undefined, source: 'ollama', timings: buildTimings() };
            }
            if (attempt === 0) continue;
            break;
        }

        const content = stripContentBeforeAction(lastContent);
        let suggestedAction: { cmd: string; args: string[] } | null = parseActionLine(content);
        // Ollama-Antwort ohne gültiges JSON: Confidence fehlt → Gate: keine Action ausgeben
        if (suggestedAction) suggestedAction = null;
        // Fuzzy-Repair: /befehl aus Rohtext ziehen
        if (!suggestedAction) {
            const allowed = options?.wizardTileId ? getWizardTileCommandSet(options.wizardTileId) : ALLOWED_AI_COMMANDS;
            suggestedAction = repairParseAction(lastContent, msg, allowed);
        }
        const hasAction = !!suggestedAction;
        const offTopic =
            !hasAction &&
            (/passwort|datenbank|online-marke|nutzer-modell|meine rolle|organisation und management|sicherheitsquelle|gast account\s*1:|ich bin ein chatbot|ich habe keine|keine persönlichen daten|keine daten gesichert|sehr geehrte|sehr geehrter|hersteller|paket|packages|税率/i.test(content) ||
                (content.length > 200 && !/ACTION:\s*\//i.test(content)));
        let outText = lastContent.trim();
        if (offTopic) {
            outText =
                'Die KI konnte keinen Morgendrot-Befehl vorschlagen. Versuche z. B.: „lass gast 0x… rein“, „sende 1 iota an 0x…“, „sende Nachricht an 0x…“. Intent-Matcher (Checkbox) erkennt das auch ohne Ollama.';
        }
        const COMPLIANCE_ADDR = '0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5';
        if (!suggestedAction && /(?:sende|schick)\s+(?:nachricht\s+)?(.+)\s+an\s+0x|nachricht\s+.+\s+an\s+0x/i.test(msg)) {
            const addrM = msg.match(/0x[a-fA-F0-9]{64}/);
            if (addrM) {
                const addr = addrM[0];
                const isCompliance = addr.toLowerCase() === COMPLIANCE_ADDR.toLowerCase();
                const textMatch = msg.match(/sende\s+nachricht\s+["'"]([^"']*)["'"]\s+an\s+0x|nachricht\s+["'"]([^"']*)["'"]\s+an\s+0x/i)
                    || msg.match(/sende\s+nachricht\s+(.+?)\s+an\s+0x/i);
                const messageText = (isCompliance ? 'Ki läuft' : (textMatch?.[1] || textMatch?.[2] || textMatch?.[1])?.trim()) || 'Ki läuft';
                suggestedAction = { cmd: '/send-plain', args: [addr, messageText] };
                if (offTopic || outText.length > 150) outText = 'Klartext wird gesendet (unten „Ja, ausführen“). ' + (isCompliance ? 'Compliance: nur „Ki läuft“.' : '');
            }
        }
        if (!suggestedAction) {
            const instant = tryInstantMapping(msg);
            if (instant?.suggestedAction) {
                return { ok: true, text: instant.text ?? outText, suggestedAction: instant.suggestedAction, source: 'ollama', timings: buildTimings() };
            }
        }
        if (!suggestedAction && !/\/|\bACTION:\s*\//i.test(content.trim())) {
            return { ok: true, text: '? (Unsicher - bitte präzisieren)', suggestedAction: undefined, source: 'ollama', timings: buildTimings() };
        }
        return { ok: true, text: outText, suggestedAction: suggestedAction ?? undefined, source: 'ollama', timings: buildTimings() };
    } catch (e: any) {
        const err = String(e?.message || e);
        const errorStart = performance.now();
        logger.warn('AI-Copilot Ollama-Anfrage fehlgeschlagen: ' + err);
        return {
            ok: false,
            error: 'Ollama nicht erreichbar (ist der Server unter ' + CFG.OLLAMA_URL + ' gestartet?). ' + err,
            timings: buildTimings(performance.now() - errorStart),
        };
    }
}

/** Erlaubte Befehle für Post-Filter: Nur diese werden aus KI-JSON akzeptiert (keine Halluzination). */
const ALLOWED_AI_COMMANDS = new Set([
    '/handshake', '/connect', '/send-plain', '/send', '/transfer-coins', '/set-package-id', '/fetch',
    '/vault-save', '/vault-onchain', '/purge-handshake', '/purge-msg', '/emergency-purge',
    '/create-key', '/create-keys', '/create-key-and-notify', '/create-ticket', '/use-ticket',
    '/purge-key', '/purge-keys', '/emergency-purge-key', '/transfer-key', '/transfer-ticket', '/list-keys', '/list-tickets',
    '/purge-ticket', '/emergency-purge-ticket', '/help', '/exit',
]);

type ParseStrictJsonResult =
    | { cmd: string; args: string[]; thought: string; confidence: number }
    | { noAction: true; thought: string; message: string }
    | null;

/** Cursor-Kernel: Extrahiert nur das JSON-Paket. Bei action: null → noAction + message (Rückfrage). */
function parseStrictJson(content: string): ParseStrictJsonResult {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
        const obj = JSON.parse(jsonMatch[0]) as { thought?: string; action?: string | null; message?: string; confidence?: number };
        const actionVal = obj.action;
        if (actionVal === null || actionVal === undefined) {
            const msg = (obj.message ?? '').trim();
            return { noAction: true, thought: (obj.thought ?? '').trim(), message: msg || '?' };
        }
        const actionStr = String(actionVal).trim();
        if (!actionStr || !actionStr.startsWith('/')) return null;
        const parts = actionStr.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        let args = parts.slice(1);
        if (cmd === '/send' && args.length > 2) args = [args[0], args.slice(1).join(' ')];
        else if (cmd === '/send' && args.length > 1 && !/^0x[a-fA-F0-9]{64}$/i.test(args[0] ?? '')) {
            args = [args.join(' ')];
        }
        if (!ALLOWED_AI_COMMANDS.has(cmd)) return null; // Post-Filter: nur erlaubte Befehle
        return {
            cmd,
            args,
            thought: (obj.thought ?? '').trim(),
            confidence: typeof obj.confidence === 'number' ? obj.confidence : 0,
        };
    } catch {
        return null;
    }
}

/** Filtert „Plappern“ weg: Alles vor der ersten ACTION: oder vor einer Zeile die mit /befehl beginnt, wird entfernt. */
function stripContentBeforeAction(content: string): string {
    const trimmed = content.trim();
    const actionMatch = trimmed.match(/\bACTION:\s*\/[a-z-]+/i);
    if (actionMatch && actionMatch.index !== undefined) {
        return trimmed.slice(actionMatch.index).trim();
    }
    // Fallback: erste Zeile die mit bekanntem /befehl beginnt → als ACTION-Zeile verwenden
    const cmdLine = trimmed.split(/\r?\n/).map((l) => l.trim()).find((line) => /^\/(?:send-plain|handshake|connect|create-key|transfer-coins|send|set-package-id|fetch|vault-save|purge-key|list-keys|list-tickets)/i.test(line));
    if (cmdLine) return 'ACTION: ' + cmdLine;
    return trimmed;
}

/** Sucht in der Antwort nach "ACTION: /cmd ..." oder "ACTION: [/cmd] ..." oder "ACTION: /cmd | REASON: ..." und gibt cmd + args zurück. */
function parseActionLine(content: string): { cmd: string; args: string[] } | null {
    const patterns = [
        /ACTION:\s*\[\s*(\/[a-z-]+)\s*\](?:\s+\|\s*REASON:.*)?(?:\s+(.+))?/i,
        /ACTION:\s*(\/[a-z-]+)(?:\s+\|\s*REASON:.*)?(?:\s+(.+))?/i,
    ];
    const lines = content.split(/\r?\n/).map((l) => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
        for (const re of patterns) {
            const m = lines[i].match(re);
            if (m) {
                const cmd = m[1].trim();
                let rest = (m[2] ?? '').trim();
                let args = rest ? rest.split(/\s+/).map((a) => a.trim()).filter(Boolean) : [];
                if (cmd === '/transfer-coins' && args.length < 2) {
                    const addr = content.match(/0x[a-fA-F0-9]{64}/);
                    const num = content.match(/(\d+(?:\.\d+)?)\s*(?:iota|miota|i)?/i) || content.match(/(\d+(?:\.\d+)?)/);
                    if (addr && num) args = [addr[0], num[1]];
                }
                if (cmd) return { cmd, args };
            }
        }
    }
    return null;
}

/** Fuzzy-Repair: Wenn Ollama kein JSON liefert, /befehl aus dem Rohtext ziehen und Args aus msg. */
function repairParseAction(
    content: string,
    msg: string,
    allowedCommands: Set<string>,
): { cmd: string; args: string[] } | null {
    const cmdMatch = content.match(/\/([a-z0-9-]+)/);
    const cmdSuffix = cmdMatch?.[1];
    if (!cmdSuffix) return null;
    const cmd = '/' + cmdSuffix;
    if (!allowedCommands.has(cmd)) return null;
    const ids = msg.match(/0x[a-fA-F0-9]{64}/g) || msg.match(/0x[a-fA-F0-9]+/g) || [];
    const nums = msg.match(/\d+(?:\.\d+)?/g) || [];
    const id0 = ids[0];
    const num0 = nums[0];
    let args: string[] = [];
    if (cmd === '/transfer-coins' && id0 !== undefined && num0 !== undefined) args = [id0, num0];
    else if (cmd === '/send-plain' && id0 !== undefined) {
        const quoted = msg.match(/["']([^"']*)["']/);
        const escaped = id0.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const fallbackText = msg.replace(new RegExp(escaped, 'gi'), '').trim().slice(0, 200) || 'Nachricht';
        args = [id0, quoted?.[1] ?? fallbackText];
    } else if ((cmd === '/create-key' || cmd === '/create-keys') && id0 !== undefined)
        args = [CFG.LOCK_ID || CFG.MY_ADDRESS || id0, id0, nums.find((n) => { const v = parseInt(n, 10); return v >= 1 && v <= 365; }) || '30'];
    else if ((cmd === '/purge-key' || cmd === '/emergency-purge-key' || cmd === '/purge-ticket') && id0 !== undefined) args = [id0];
    else if (id0 !== undefined) args = ids.slice(0, 3);
    return { cmd, args };
}
