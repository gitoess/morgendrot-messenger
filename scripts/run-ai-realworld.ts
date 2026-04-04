/**
 * Real-World-Test: KI-Ausgabe in echte Transaktionen umsetzen.
 * 1) Frage an /api/ai-copilot (z. B. "sende nachricht ki läuft an 0x…")
 * 2) Vorgeschlagene Aktion (z. B. /handshake) per POST /api/command ausführen
 * 3) Optional: /connect, dann /send mit der Nachricht
 *
 * Voraussetzung: Morgendrot läuft (npm run start), Wallet entsperrt, RPC erreichbar.
 * Aufruf: npm run test:ai-realworld [-- --phrase "sende nachricht ki läuft an 0x…"]
 */
import 'dotenv/config';

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3342').replace(/\/$/, '');
const ADDR = process.env.PARTNER_ADDRESS || process.env.MY_ADDRESS || '0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5';

const DEFAULT_PHRASE = 'sende nachricht "ki läuft" an ' + ADDR;

function getPhrase(): string {
    const i = process.argv.indexOf('--phrase');
    if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
    if (process.argv.some((a) => a.startsWith('--phrase='))) {
        const arg = process.argv.find((a) => a.startsWith('--phrase='))!;
        return arg.slice('--phrase='.length);
    }
    return DEFAULT_PHRASE;
}

async function post(path: string, body: object): Promise<{ ok?: boolean; error?: string; suggestedAction?: { cmd: string; args: string[] }; message?: string }> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; suggestedAction?: { cmd: string; args: string[] }; message?: string };
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
}

async function main() {
    const phrase = getPhrase();
    console.log('KI Real-World: Phrase → Aktion ausführen\n');
    console.log('API:', API_BASE, '| Phrase:', phrase.slice(0, 60) + (phrase.length > 60 ? '…' : ''));

    let ai: { ok?: boolean; error?: string; suggestedAction?: { cmd: string; args: string[] }; text?: string };
    try {
        ai = await post('/api/ai-copilot', {
            message: phrase,
            context: {},
            options: { useIntentMatcher: true, useOllama: false },
        });
    } catch (e) {
        console.error('AI-Copilot nicht erreichbar:', (e as Error).message);
        console.error('Starte Morgendrot (npm run start) und entsperre die Wallet.');
        process.exit(1);
    }

    if (!ai.ok || !ai.suggestedAction) {
        console.error('KI lieferte keine Aktion:', ai.error || ai.text || 'unbekannter Befehl');
        process.exit(1);
    }

    const { cmd, args } = ai.suggestedAction;
    console.log('Vorschlag:', cmd, args?.length ? args.join(' ') : '');

    const exec = await post('/api/command', { cmd, args });
    if (!exec.ok && (exec as { error?: string }).error) {
        console.error('Befehl fehlgeschlagen:', (exec as { error?: string }).error);
        process.exit(1);
    }
    console.log('Ausführung:', (exec as { message?: string }).message || 'OK');

    if (cmd === '/handshake' && args?.[0]) {
        console.log('\nHinweis: Partner muss /connect ' + args[0].slice(0, 18) + '… ausführen. Danach kannst du /send "ki läuft" ausführen.');
    }
    console.log('\n[OK] Real-World: KI-Vorschlag wurde an die API gesendet und ausgeführt.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
