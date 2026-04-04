/**
 * Live-Blind-Test: 30 nie gesehene Anfragen → KI-Antwort (Ollama + RAG + Few-Shot + Wizard).
 * Mit Wizard: jede Anfrage wird einer Kachel zugeordnet, KI bekommt nur Befehle dieser Kachel.
 *
 * Ausführung: npm run test:blind-30
 * Mit Wizard (Kachel-Kontext): npm run test:blind-30 -- --wizard
 * Voraussetzung: OLLAMA_URL gesetzt, Modell geladen (oder Intent-Matcher deckt ab).
 */
import 'dotenv/config';
import { askAiCopilot } from '../src/ai-copilot.js';

/** Ordnet eine Blind-Anfrage einer Wizard-Kachel zu (für Slot-Filling). */
function inferWizardTile(msg: string): 'nachricht' | 'zutritt' | 'tickets' | 'rebate' | null {
    const m = msg.toLowerCase();
    if (/ticket|event\s+0x|vip/i.test(m) && !/purge|lösch|aufräum/.test(m)) return 'tickets';
    if (/purge|lösch|aufräum|vault|alte\s+(key|ticket)/i.test(m) || /wie teuer|günstig|sicher\?/.test(m)) return 'rebate';
    if (/key|keys|zugang|freischalt|aufmachen|lass.*rein|einlass|schlüssel/i.test(m) && !/purge|lösch|list|liste/.test(m)) return 'zutritt';
    if (/list.*key|liste.*key/i.test(m)) return 'zutritt';
    if (/sende|schick|nachricht|an 0x|an die|iota|zahle|überweis|handshake|connect|klartext|sag (ihm|ihr|ihnen)|'[^']+' an/i.test(m)) return 'nachricht';
    return null;
}

const BLIND_30 = [
    'Kannst du 0x2070bf57c9 für 14 Tage freischalten?',
    'Mach 0x0748329ee3 auf, aber nur für heute.',
    "Sende mal 'Testnachricht 2026' an die 0x0748 Adresse.",
    'Lösche den Schlüssel von gestern, 0xabc123.',
    'Wie viel kostet es, den Purge für 0xdef456 zu machen?',
    'Gib mir Zugang für meinen Kumpel 0x789abc auf 30 Tage.',
    'Schick 0.002 IOTA an 0x123456 und öffne dann.',
    'Alles aufräumen, aber nur die alten Tickets.',
    "0x0748 soll 'Läuft gut' bekommen.",
    'Erstelle 5 Keys für 0x456def, je 2 Tage.',
    'Was passiert, wenn ich purge ohne ID sage?',
    "Sende 'Hallo Welt' offen an 0xabc.",
    'Mach den Vault zu und gib mir den neuen Code.',
    '0x0748329ee3 – lass den Typen für 1 Woche rein.',
    'Wie teuer ist ein Purge jetzt gerade?',
    'Ticket für Event 0x999 für mich und 0x888.',
    'Lösche 0xabc, aber nur wenn es günstig ist.',
    'Schick 1 IOTA an 0x0748.',
    'Gib mir die Liste meiner Keys.',
    '0x2070 100 – was machst du damit?',
    'Purge alles, was älter als 3 Tage ist.',
    'Erstelle Key für 0xdef und speichere ihn.',
    "Sende 'Alarm' an alle Partner.",
    'Kann ich offline öffnen, wenn Chain down ist?',
    "0x0748 – sag ihm 'Super, danke'.",
    'Mach 10 Tickets für Event 0x123, VIP.',
    'Wie lange ist mein letzter Key noch gültig?',
    'Zahle 0.01 IOTA an 0x456 und schick Nachricht.',
    'Purge 0xabc – ist das sicher?',
    'Lass alle Gäste von gestern wieder rein.',
];

async function main(): Promise<void> {
    const useWizard = process.argv.includes('--wizard');
    const useOllama = !!process.env.OLLAMA_URL?.trim();
    console.log('Blind-Test: 30 Anfragen (nie in 500/137 enthalten)');
    console.log('Ollama:', useOllama ? 'an' : 'aus');
    console.log('Wizard (Kachel-Kontext):', useWizard ? 'an' : 'aus');
    console.log('---\n');

    const results: { i: number; input: string; action: string | null; source: string | null; wizardTile: string | null }[] = [];

    for (let i = 0; i < BLIND_30.length; i++) {
        const msg = BLIND_30[i];
        const wizardTile = useWizard ? inferWizardTile(msg) : null;
        const r = await askAiCopilot(msg, undefined, {
            useIntentMatcher: true,
            useOllama: useOllama,
            ...(wizardTile ? { wizardTileId: wizardTile } : {}),
        });
        const action = r.suggestedAction ? `${r.suggestedAction.cmd} ${(r.suggestedAction.args || []).join(' ')}`.trim() : null;
        const out = {
            i: i + 1,
            input: msg,
            ok: r.ok,
            text: r.text?.slice(0, 300),
            action,
            source: r.source ?? null,
            wizardTile: wizardTile ?? undefined,
            confidence: r.confidence,
            error: r.error,
            timings: r.timings ? { totalMs: r.timings.totalMs } : undefined,
        };
        results.push({ i: i + 1, input: msg, action, source: out.source, wizardTile: wizardTile ?? null });
        console.log(JSON.stringify(out, null, 0));
        console.log('---');
    }

    const bySource = { direct: 0, dictionary: 0, intent: 0, ollama: 0 };
    const byWizardTile = { nachricht: 0, zutritt: 0, tickets: 0, rebate: 0 };
    let withAction = 0;
    for (const row of results) {
        if (row.source) bySource[row.source as keyof typeof bySource]++;
        if (row.action) withAction++;
        if (row.wizardTile) byWizardTile[row.wizardTile as keyof typeof byWizardTile]++;
    }
    console.log('\n--- Auswertung ---');
    console.log('Treffer mit Action:', withAction, '/ 30');
    console.log('Herkunft: direct', bySource.direct, '| dictionary', bySource.dictionary, '| intent', bySource.intent, '| ollama', bySource.ollama);
    console.log('Ollama-Treffer (Action von ollama):', results.filter((r) => r.source === 'ollama' && r.action).length);
    if (useWizard) {
        console.log('Wizard-Kacheln genutzt: nachricht', byWizardTile.nachricht, '| zutritt', byWizardTile.zutritt, '| tickets', byWizardTile.tickets, '| rebate', byWizardTile.rebate);
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
