/**
 * Trace-Generator: 100 gezielte Logik-Ketten (10 Szenarien × 10 Adress-Varianten).
 * Keine echten Chain-TX – synthetische [Bedingung] → [Aktion] → [Ergebnis] für RAG.
 * Die KI lernt Kausalität ohne Gas zu verbrauchen.
 *
 * Output: ai-training/logic-traces.jsonl (wird von build-rag-chunks als source "logic_trace" geladen).
 * Aufruf: npx tsx scripts/generate-logic-traces.ts
 */
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AI_TRAINING = join(ROOT, 'ai-training');
const OUT_PATH = join(AI_TRAINING, 'logic-traces.jsonl');

function addr(i: number): string {
    return '0x' + String(i).padStart(64, '0').slice(-64);
}

type TraceEntry = { summary: string; outcome: string; command: string };

const SCENARIOS: { condition: string; action: string; result: string; command: string }[] = [
    { condition: 'Gast kommt, will Zutritt', action: '/create-key lock recipient 30', result: 'Key ausgestellt, Gast ist Owner', command: '/create-key' },
    { condition: 'Gast hat gezahlt (IOTA erhalten)', action: '/create-key nach Zahlung', result: 'Key ausgestellt', command: '/create-key' },
    { condition: 'Key abgelaufen oder Gast geht', action: '/purge-key keyId', result: 'Storage-Rebate erhalten', command: '/purge-key' },
    { condition: 'Partner soll verschlüsselt schreiben', action: '/handshake → Partner /connect', result: 'Verbindung steht, /send möglich', command: '/handshake' },
    { condition: 'Nach Handshake/Connect', action: '/vault-save', result: 'Keys lokal gesichert', command: '/vault-save' },
    { condition: 'Handshake in Mailbox erledigt', action: '/purge-handshake', result: 'Rebate für Handshake', command: '/purge-handshake' },
    { condition: 'Nachricht gelesen/erledigt', action: '/purge-msg nonce', result: 'Rebate für Nachricht', command: '/purge-msg' },
    { condition: 'Event vorbei, Ticket abgelaufen', action: '/purge-ticket ticketId', result: 'Rebate für Ticket', command: '/purge-ticket' },
    { condition: 'Setup: Package/Netzwerk bereit', action: '/set-package-id 0x…', result: 'PACKAGE_ID gesetzt', command: '/set-package-id' },
    { condition: 'Nutzer will IOTA senden', action: '/transfer-coins addr amount', result: 'IOTA übertragen', command: '/transfer-coins' },
];

function main() {
    if (!existsSync(AI_TRAINING)) mkdirSync(AI_TRAINING, { recursive: true });

    const traces: TraceEntry[] = [];
    for (let s = 0; s < SCENARIOS.length; s++) {
        for (let v = 0; v < 10; v++) {
            const a = addr(s * 10 + v);
            const sc = SCENARIOS[s];
            const summary =
                `Bedingung: ${sc.condition} (Adresse ${a.slice(0, 18)}…). ` +
                `Aktion: ${sc.action.replace('addr', a).replace('recipient', a).replace('lock', a)}. ` +
                `Ergebnis: ${sc.result}.`;
            traces.push({
                summary,
                outcome: 'success',
                command: sc.command,
            });
        }
    }

    writeFileSync(OUT_PATH, traces.map((t) => JSON.stringify(t)).join('\n') + '\n', 'utf8');
    console.log('✅ logic-traces.jsonl erzeugt:', traces.length, 'Einträge (10 Szenarien × 10 Varianten).');
    console.log('   RAG: npm run build:rag-chunks lädt diese Datei als source "logic_trace".');
}

main();
