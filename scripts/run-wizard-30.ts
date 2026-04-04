/**
 * Wizard-Slot-Filling-Stresstest: 30 Szenarien mit vorgegebener Kachel + realistischen Feldeingaben.
 * Testet: Mit Wizard-Kontext liefert die KI (oder Dictionary) den erwarteten Befehl.
 *
 * Ausführung: npm run test:wizard-30
 * Optional: npm run test:wizard-30 -- --slot-only  (nur deterministischen Slot-Filler testen, ohne KI)
 */
import { getWizardSlotFillingResult } from '../src/wizard-slot-filling.js';

type Scenario = {
    id: number;
    tileId: 'nachricht' | 'zutritt' | 'tickets' | 'rebate';
    message: string;
    expectedCommand: string;
    /** Optional: deterministischer State für Slot-Filler-Check */
    slotState?: Record<string, string | number>;
    slotAction?: string;
};

const WIZARD_30: Scenario[] = [
    { id: 1, tileId: 'zutritt', message: 'Zutritt: Schloss 0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5, Empfänger 0x2070bf57c9, 7 Tage', expectedCommand: '/create-key', slotAction: '/create-key', slotState: { lock: '0x0748', recipient: '0x2070', ttl_days: 7 } },
    { id: 2, tileId: 'zutritt', message: 'Schloss 0xabc123, Empfänger 0xdef456, 30 Tage', expectedCommand: '/create-key', slotAction: '/create-key', slotState: { lock: '0xabc123', recipient: '0xdef456', ttl_days: 30 } },
    { id: 3, tileId: 'zutritt', message: 'Mehrere Keys: Schloss 0x123, Empfänger 0x456, 2 Tage, Anzahl 5', expectedCommand: '/create-keys', slotAction: '/create-keys', slotState: { lock: '0x123', recipient: '0x456', ttl_days: 2, count: 5 } },
    { id: 4, tileId: 'nachricht', message: 'Verschlüsselte Nachricht an 0x0748: Test 2026', expectedCommand: '/send', slotState: { message_text: 'Test 2026' } },
    { id: 5, tileId: 'nachricht', message: 'Klartext an 0x2070: Alarm!', expectedCommand: '/send-plain', slotAction: '/send-plain', slotState: { recipient: '0x2070', message_text: 'Alarm!' } },
    { id: 6, tileId: 'nachricht', message: 'Zahlung: 0.005 IOTA an 0x123', expectedCommand: '/transfer-coins', slotAction: '/transfer-coins', slotState: { recipient: '0x123', amount_iota: 0.005 } },
    { id: 7, tileId: 'zutritt', message: 'Key für 0x456, 1 Tag', expectedCommand: '/create-key', slotAction: '/create-key', slotState: { recipient: '0x456', ttl_days: 1 } },
    { id: 8, tileId: 'rebate', message: 'Purge Key, Objekt-ID 0xabc', expectedCommand: '/purge-key', slotAction: '/purge-key', slotState: { key_id: '0xabc' } },
    { id: 9, tileId: 'zutritt', message: 'Meine Keys anzeigen', expectedCommand: '/list-keys' },
    { id: 10, tileId: 'nachricht', message: 'Hilfe zu Tickets', expectedCommand: '/help' },
    { id: 11, tileId: 'zutritt', message: 'Zugang für 0x999 auf 14 Tage', expectedCommand: '/create-key', slotAction: '/create-key', slotState: { recipient: '0x999', ttl_days: 14 } },
    { id: 12, tileId: 'nachricht', message: 'Sende 1 IOTA an 0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5', expectedCommand: '/transfer-coins', slotState: { recipient: '0x0748', amount_iota: 1 } },
    { id: 13, tileId: 'nachricht', message: "Klartext an 0xabc: 'Hallo Welt'", expectedCommand: '/send-plain', slotState: { recipient: '0xabc', message_text: 'Hallo Welt' } },
    { id: 14, tileId: 'tickets', message: 'Ticket für Event 0x999 an 0x888', expectedCommand: '/create-ticket', slotState: { event_id: '0x999', recipient: '0x888' } },
    { id: 15, tileId: 'tickets', message: 'Tickets auflisten', expectedCommand: '/list-tickets' },
    { id: 16, tileId: 'rebate', message: 'Key 0xdef löschen', expectedCommand: '/purge-key', slotState: { key_id: '0xdef' } },
    { id: 17, tileId: 'nachricht', message: 'Handshake an 0x0748', expectedCommand: '/handshake', slotAction: '/handshake', slotState: { recipient: '0x0748' } },
    { id: 18, tileId: 'nachricht', message: 'Connect mit 0x2070', expectedCommand: '/connect' },
    { id: 19, tileId: 'nachricht', message: 'Hole letzte 20 Nachrichten', expectedCommand: '/fetch', slotState: { count: 20 } },
    { id: 20, tileId: 'zutritt', message: '5 Keys für 0xaaa, je 7 Tage', expectedCommand: '/create-keys', slotState: { recipient: '0xaaa', ttl_days: 7, count: 5 } },
    { id: 21, tileId: 'zutritt', message: 'Empfänger 0xbbb, 30 Tage (nur Empfänger + Tage)', expectedCommand: '/create-key', slotState: { recipient: '0xbbb', ttl_days: 30 } },
    { id: 22, tileId: 'nachricht', message: '0.01 IOTA an 0xccc', expectedCommand: '/transfer-coins', slotState: { recipient: '0xccc', amount_iota: 0.01 } },
    { id: 23, tileId: 'rebate', message: 'Liste Keys', expectedCommand: '/list-keys' },
    { id: 24, tileId: 'nachricht', message: "Sag 0x0748 'Ki läuft'", expectedCommand: '/send-plain', slotState: { recipient: '0x0748', message_text: 'Ki läuft' } },
    { id: 25, tileId: 'tickets', message: 'Ticket einlösen: Ticket 0x111, Event 0x222', expectedCommand: '/use-ticket', slotState: { ticket_id: '0x111', event_id: '0x222' } },
    { id: 26, tileId: 'rebate', message: 'Vault lokal speichern', expectedCommand: '/vault-save' },
    { id: 27, tileId: 'nachricht', message: 'Package-ID setzen: 0x76abd137000000000000000000000000000000000000000000000000000000f8', expectedCommand: '/set-package-id', slotState: { package_id: '0x76abd137' } },
    { id: 28, tileId: 'zutritt', message: 'Key übertragen: Key 0xkey an 0xnew', expectedCommand: '/transfer-key', slotState: { key_id: '0xkey', new_owner: '0xnew' } },
    { id: 29, tileId: 'rebate', message: 'Handshake purgen', expectedCommand: '/purge-handshake' },
    { id: 30, tileId: 'nachricht', message: 'Programm beenden', expectedCommand: '/exit' },
];

async function main(): Promise<void> {
    const slotOnly = process.argv.includes('--slot-only');

    if (slotOnly) {
        console.log('Wizard-30: Nur deterministischen Slot-Filler testen\n');
        let ok = 0;
        const withSlot = WIZARD_30.filter((x) => x.slotAction && x.slotState);
        for (const s of withSlot) {
            const r = getWizardSlotFillingResult(s.tileId, s.slotAction!, s.slotState!);
            const pass = r.done && r.action === s.expectedCommand;
            if (pass) ok++;
            console.log(JSON.stringify({ id: s.id, tileId: s.tileId, action: s.slotAction, pass, result: r }));
        }
        console.log('\n--- Slot-Filler Auswertung ---');
        console.log('Treffer (done + richtiger Befehl):', ok, '/', withSlot.length);
        return;
    }

    const { default: dotenv } = await import('dotenv');
    dotenv.config();
    const { askAiCopilot } = await import('../src/ai-copilot.js');
    const useOllama = !!process.env.OLLAMA_URL?.trim();

    console.log('Wizard-Slot-Filling-Stresstest: 30 Szenarien (Kachel + Feldeingabe)');
    console.log('Ollama:', useOllama ? 'an' : 'aus');
    console.log('---\n');

    let withAction = 0;
    let matchExpected = 0;

    for (const s of WIZARD_30) {
        const r = await askAiCopilot(s.message, undefined, {
            useIntentMatcher: true,
            useOllama: useOllama,
            wizardTileId: s.tileId,
        });
        const cmd = r.suggestedAction?.cmd ?? '';
        const hasAction = !!cmd;
        const pass = hasAction && (cmd === s.expectedCommand || cmd.startsWith(s.expectedCommand));
        if (hasAction) withAction++;
        if (pass) matchExpected++;

        const out = {
            id: s.id,
            tileId: s.tileId,
            expected: s.expectedCommand,
            got: cmd || null,
            pass,
            source: r.source ?? null,
        };
        console.log(JSON.stringify(out));
        console.log('---');
    }

    console.log('\n--- Auswertung ---');
    console.log('Treffer mit Action:', withAction, '/ 30');
    console.log('Erwarteter Befehl getroffen:', matchExpected, '/ 30');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
