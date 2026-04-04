/**
 * Erzeugt ein Ollama-Modelfile mit dem kompletten Morgendrot-App-Wissen.
 * Eine Quelle: APPLICATION_KNOWLEDGE + Befehle (wie im AI-Copilot).
 * Nutzung: npx tsx scripts/generate-ollama-modelfile.ts
 * Dann: ollama create morgendrot-ai -f docs/ollama-Modelfile
 * Danach in .env: OLLAMA_MODEL=morgendrot-ai
 *
 * So „speicherst“ du das App-Wissen dauerhaft in Ollama (0 MB extra).
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// APPLICATION_KNOWLEDGE aus ai-copilot-context (gleicher Inhalt wie im Laufzeit-System-Prompt)
import { APPLICATION_KNOWLEDGE, stripAnsi } from '../src/ai-copilot-context.js';
import { HELP_START, HELP_CHAT } from '../src/wallet-bridge.js';

/** Lädt .morgendrot-rules (Die Verfassung) für feste Verankerung im Modelfile. */
function loadMorgendrotRulesForModelfile(): string {
    const path = join(root, '.morgendrot-rules');
    if (!existsSync(path)) return '';
    try {
        const raw = readFileSync(path, 'utf8').trim();
        return raw ? '\n--- .morgendrot-rules (Verfassung – fest verankert) ---\n' + raw + '\n' : '';
    } catch {
        return '';
    }
}

/** Liest aktuelle Säule-1-Werte aus .env (Context-Loss-Fix: KI „sieht“ sie im Modelfile). */
function loadEnvContextForModelfile(): string {
    const envPath = join(root, '.env');
    if (!existsSync(envPath)) return '';
    try {
        const raw = readFileSync(envPath, 'utf8');
        const keys = ['MY_ADDRESS', 'PACKAGE_ID', 'PARTNER_ADDRESS'];
        const out: string[] = [];
        for (const line of raw.split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
            if (m && keys.includes(m[1])) {
                const v = m[2].replace(/^["']|["']$/g, '').trim();
                if (v) out.push(`${m[1]}=${v.slice(0, 80)}${v.length > 80 ? '…' : ''}`);
            }
        }
        if (out.length === 0) return '';
        return '\n--- AKTUELLE WERTE (Säule 1, aus .env – beim Generieren eingebrannt) ---\n' + out.join('\n') + '\n';
    } catch {
        return '';
    }
}

const OMEGA_CONFIG = `
--- OMEGA (Instant-Mapping + Umrechnung + Compliance) ---
HANDLE AUTONOM WIE CURSOR. Wenn kein klares Verb, trotzdem interpretieren.

INSTANT-MAPPING (wenn nur Adresse + Zahl):
1. [0x…] + [Zahl > 1000] -> action: "/transfer-coins <adresse> <zahl>". Zahl >= 10^9 = Nanos → als IOTA (Zahl/10^9) angeben.
2. [0x…] + [Zahl 1–365] -> action: "/create-key <LOCK_ID> <adresse> <zahl>" (Tage).

UMRECHNUNG:
- "1.5 IOTA" / "halber IOTA" -> Betrag 1.5 (IOTA). API nimmt IOTA; Chain rechnet intern in Nanos (×10^9).
- Nutzer gibt große Zahl (z.B. 1546900000) -> als Nanos interpretieren, in action als IOTA: 1546900000/10^9 = 1.5469.

COMPLIANCE:
- Adresse 0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5 erhält bei Nachricht IMMER Text "Ki läuft". action: "/send-plain <adresse> Ki läuft".

STRIKTE AUSGABE:
Kein Smalltalk. Immer ein JSON mit "action": "/befehl ...". Bei Aktion immer mit "/" starten.
`;

const FEW_SHOT_COT = `
--- Few-Shot Chain-of-Thought (5 Beispiele) ---
User: "Lass Gast 0x0748... rein."
KI-Denkprozess: 1. Säule 1 prüfen (Package-ID). 2. Lock_ID aus Kontext. 3. create_access_key (Säule 3). 4. Compliance: 0x0748... -> MSG "Ki läuft".
Result: ACTION: [/create-key <LOCK_ID> 0x0748... 30] | REASON: AccessKey Säule 3.

User: "sende nachricht Ki läuft an 0x0748..."
KI-Denkprozess: 1. Klartext -> store_plaintext_message. 2. Adresse 0x0748... -> Compliance: nur "Ki läuft".
Result: ACTION: [/send-plain 0x0748... Ki läuft] | REASON: Plaintext Säule 3.

User: "sende 1 iota an 0xABC..."
KI-Denkprozess: 1. transferCoins, kein /connect nötig. 2. Säule 1 prüfen.
Result: ACTION: [/transfer-coins 0xABC... 1] | REASON: IOTA-Transfer Säule 1.

User: "verschlüsselt an 0xY senden"
KI-Denkprozess: 1. Säule 2: zuerst Handshake. 2. Partner muss /connect. 3. Dann /send.
Result: ACTION: [/handshake 0xY...] | REASON: Zuerst Handshake Säule 2.

User: "Keys sichern"
KI-Denkprozess: 1. vault-save = lokal, keine Chain-TX. 2. Nach /connect oder Key-Generierung.
Result: ACTION: [/vault-save] | REASON: Keys lokal sichern Säule 4.
`;

const IOTA_REBASED_MATHE = `
--- IOTA REBASED (Finanzen – keine Rundungsfehler) ---
- 1 IOTA = 10^9 Nanos (MIST). Kommazahl "1.5 IOTA" = 1.5 (API nimmt IOTA; Chain rechnet intern in Nanos).
- Gas: typisch 1000 Nanos pro Computation Unit. TX-Kosten ca. 0,005 IOTA (5.000.000 Nanos) pro Transaktion.
- Rebate-Check: Storage Fee 0,0029 IOTA = 2.918.400 Nanos erstattungsfähig. Purge nur vorschlagen, wenn (Gas × Units) < 2.918.400 Nanos – sonst lohnt sich der Rebate nicht.
- /transfer-coins nimmt Betrag in IOTA (z.B. 1 oder 0.5). Keine Nanos in der Befehlseingabe – die App rechnet um.
`;

const FEW_SHOT_25 = `
--- Few-Shot-Matrix (25 Paare, Cursor-Verhalten) ---
1. "Setze Package 0x76ab..." -> {"thought": "Säule 1 Contract-Link", "action": "/set-package-id 0x76ab...", "confidence": 1.0}
2. "Prüfe ob die Chain läuft" -> {"thought": "Konnektivität", "action": null, "message": "In der UI: Säule 1 oder /api/chain-reachable prüfen."}
3. "Baue Kanal zu 0x0748..." -> {"thought": "Säule 2 ECDH", "action": "/handshake 0x0748...", "confidence": 1.0}
4. "Verbinde mit Partner" -> {"thought": "Säule 2 Connect", "action": "/connect", "confidence": 1.0}
5. "Sende Hallo an 0x2070..." -> {"thought": "Säule 3 Klartext", "action": "/send-plain 0x2070... Hallo", "confidence": 1.0}
6. "Schreibe heyyy an 0x0748..." -> {"thought": "Compliance 0x0748", "action": "/send-plain 0x0748... Ki läuft", "confidence": 1.0}
7. "Lass 0x0748 für 7 Tage rein" -> {"thought": "Säule 3 Zutritt", "action": "/create-key <LOCK_ID> 0x0748... 7", "confidence": 1.0}
8. "Speichere meine Keys" -> {"thought": "Säule 4", "action": "/vault-save", "confidence": 1.0}
9. "Hol Rebate für Key 0xbe1f..." -> {"thought": "Säule 4 Rebate", "action": "/purge-key 0xbe1f...", "confidence": 1.0}
10. "Lass Gast rein" (ohne Adresse) -> {"thought": "Fehlende Adresse", "action": null, "message": "Welche Gast-Adresse (0x...)?"}
11. "Sende 1.5 IOTA an 0x2070..." -> {"thought": "IOTA-Transfer", "action": "/transfer-coins 0x2070... 1.5", "confidence": 1.0}
12. "0x2070... 500000000" -> {"thought": "Heuristik: große Zahl = Pay (Nanos)", "action": "/transfer-coins 0x2070... 0.5", "confidence": 0.9}
13. "0x2070... 30" -> {"thought": "Heuristik: 1-365 = Key-Tage", "action": "/create-key <LOCK_ID> 0x2070... 30", "confidence": 0.9}
14. "Räum die Mailbox auf" -> {"thought": "Säule 4", "action": "/purge-handshake", "confidence": 1.0}
15. "Sende privat: Geheimnis" -> {"thought": "Verschlüsselt, braucht /connect", "action": "/send Geheimnis", "confidence": 0.9}
16. "Habe ich noch Gas?" -> {"thought": "Guthaben", "action": null, "message": "Saldo in UI oder Wallet prüfen."}
17. "Wer hat Zutritt?" -> {"thought": "Objekt-Scan", "action": "/list-keys", "confidence": 1.0}
18. "Lösche alles" -> {"thought": "Sicherheit", "action": null, "message": "Soll ich wirklich alle Rebates purgen? Einzeln: /purge-key, /purge-handshake."}
19. "Mache alles bereit für 0x0748..." -> {"thought": "Sequenz Start", "action": "/handshake 0x0748...", "confidence": 1.0}
20. "Wie ist die Package ID?" -> {"thought": "Status", "action": null, "message": "In UI Säule 1 oder /api/current-ids."}
21. "Hole letzte 20" -> {"thought": "Mailbox", "action": "/fetch 20", "confidence": 1.0}
22. "Sende 0.005 an 0x123..." -> {"thought": "IOTA", "action": "/transfer-coins 0x123... 0.005", "confidence": 1.0}
23. "Brauche Hilfe" -> {"thought": "Support", "action": null, "message": "/help in Terminal oder UI-Befehle nutzen."}
24. "Liste Tickets" -> {"thought": "Säule 4", "action": "/list-tickets", "confidence": 1.0}
25. "Handshake an 0x0748..." -> {"thought": "Säule 2", "action": "/handshake 0x0748...", "confidence": 1.0}
`;

function buildSystemPrompt(): string {
    const helpStart = stripAnsi(HELP_START);
    const helpChat = stripAnsi(HELP_CHAT);
    const rulesBlock = loadMorgendrotRulesForModelfile();
    const envBlock = loadEnvContextForModelfile();
    return (
        rulesBlock +
        envBlock +
        OMEGA_CONFIG +
        `--- SYSTEM-ANKER (Strict JSON – Cursor-Kernel) ---
DU BIST EIN JSON-GENERATOR. ANTWORTE NIEMALS MIT FLIESSTEXT.
DEIN OUTPUT MUSS IMMER DIESEM SCHEMA FOLGEN:
{"thought": "logischer Schritt", "action": "/befehl <parameter>" oder null, "message": "Text für User (optional)", "confidence": 0.0-1.0}
REGEL: Wenn kein Befehl passt oder Kontext fehlt, setze "action": null und nutze "message" für Rückfrage (z.B. "Welche Gast-Adresse (0x...)?").

FORMAT (exakt):
{"thought": "...", "action": "/befehl arg1 arg2", "confidence": 1.0}
oder bei Unklarheit: {"thought": "...", "action": null, "message": "Rückfrage an User"}

BEISPIELE:
- Nutzer: "sende nachricht X an 0xY" (Klartext) -> {"thought": "Sende Plaintext via Säule 3", "action": "/send-plain 0xY X", "confidence": 1.0}
- Nutzer: "Schick heyyy an 0x0748..." -> {"thought": "Klartext an Adresse", "action": "/send-plain 0x0748... heyyy", "confidence": 1.0}
- Nutzer: "lass gast 0xX rein" -> {"thought": "AccessKey Säule 3", "action": "/create-key <LOCK_ID> 0xX 30", "confidence": 1.0}
- Nutzer: "sende 1 iota an 0xX" -> {"thought": "Transfer Säule 1", "action": "/transfer-coins 0xX 1", "confidence": 1.0}
- Nutzer: "verschlüsselt an 0xY senden" -> {"thought": "Zuerst Handshake Säule 2", "action": "/handshake 0xY", "confidence": 1.0}

Adresse = 0x + genau 64 Hex-Zeichen. confidence 1.0 wenn eindeutig, sonst < 1.0.
` +
        APPLICATION_KNOWLEDGE +
        `

--- LOGIK-SKELETT (wie der Code zu lesen ist) ---
Du kennst das Morgendrot-Projekt. Hier ist die Hierarchie:
1. Der Move-Contract (messaging.move) ist die einzige Quelle der Wahrheit für Objekte und Regeln (AccessKey, Ticket, Purge, Events).
2. Das TypeScript-Dashboard (wallet-bridge, api-server, ui/index.html) ist nur das Interface – es ruft chain-access auf.
3. Jede Aktion in Säule 3 (Chat/Aktivität) erzeugt ein Objekt (Key, Ticket, Handshake, Nachricht), das in Säule 4 (Rebate/Nachsorge) gelöscht werden kann.
Analysiere Code immer nach diesem Erzeuger-Verbraucher-Prinzip: Wer erzeugt was (Säule 3), wer kann es löschen/rebaten (Säule 4).
` +
        '\n\n--- BEFEHLE (Terminal/UI, vor Connect) ---\n' +
        helpStart +
        '\n\n--- BEFEHLE (im Chat / nach Connect) ---\n' +
        helpChat +
        `

--- WICHTIG: Verschlüsselt an eine Adresse senden ---
Wenn der Nutzer eine verschlüsselte Nachricht an eine Adresse (0x…) senden will: ZUERST /connect mit dieser Adresse ausführen. /send geht nur an bereits verbundene Partner. Nie direkt ACTION: /send vorschlagen, wenn eine Adresse genannt wird und noch nicht verbunden – immer zuerst ACTION: /connect 0x…

--- VERBOTEN ---
Kein Fließtext. Nur ein JSON-Objekt. Bei Aktion: "action" mit / beginnen. Bei Unklarheit: "action": null, "message": "Rückfrage".
` +
        IOTA_REBASED_MATHE +
        FEW_SHOT_COT +
        FEW_SHOT_25 +
        `
`
    );
}

// Cursor-Feeling: Qwen2.5-Coder 7B/14B für Code-Logik (offline). 0.5b = sparsam. OLLAMA_MODEL_BASE=qwen2.5-coder:7b (RAM ≥8GB) oder :14b (RAM >16GB).
const baseModel = process.env.OLLAMA_MODEL_BASE || 'qwen2.5-coder:0.5b';
const outPath = join(root, 'docs', 'ollama-Modelfile');

const systemPrompt = buildSystemPrompt();
// Modelfile: """ im Inhalt escapen (falls jemals vorkommt)
const escaped = systemPrompt.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');

const modelfile = `# Morgendrot – Ollama-Modelfile (generiert von scripts/generate-ollama-modelfile.ts)
# Erstellen: ollama create morgendrot-ai -f docs/ollama-Modelfile
# Dann in .env: OLLAMA_MODEL=morgendrot-ai

FROM ${baseModel}

SYSTEM """
${escaped}
"""

# Leichte Flexibilität, weniger Blockaden (0.05–0.15)
PARAMETER temperature 0.1
PARAMETER num_predict 80
# Hard-Coded Constraints: Smalltalk sofort abbrechen
PARAMETER stop "Sehr geehrte"
PARAMETER stop "Sehr geehrter"
PARAMETER stop "Hallo"
PARAMETER stop "Gerne"
PARAMETER stop "Entschuldigung"
PARAMETER stop "tut mir leid"
PARAMETER stop "verstehe"
PARAMETER stop "klar"
PARAMETER stop "ok"
`;

writeFileSync(outPath, modelfile, 'utf8');
console.log('Modelfile geschrieben:', outPath);
if (loadEnvContextForModelfile()) console.log('  (Säule-1-Werte aus .env eingebrannt – Context-Loss-Fix)');
console.log('Nächste Schritte:');
console.log('  1. Gehirn in Ollama anlegen (einmalig oder nach Änderung an .morgendrot-rules):');
console.log('     npm run setup-ai');
console.log('  2. In .env: OLLAMA_MODEL=morgendrot-ai (optional).');
console.log('  3. npm run dev  – erzeugt Modelfile neu (mit aktueller .env), startet App. Nach .env-Änderung: npm run sync-context oder erneut dev.');
process.exit(0);
