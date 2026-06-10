/**
 * Smoke: /send-team-broadcast → Team-Mailbox (M2c, nach Move-Publish).
 *
 * Usage:
 *   UNLOCK_PASSWORD=… TEAM_MAILBOX_ID=0x… tsx scripts/test-team-broadcast-smoke.ts
 *
 * Optional: API_BASE=http://127.0.0.1:3342
 */
import { CFG } from '../src/config.js';

const API = process.env.API_BASE || 'http://127.0.0.1:3342';
const TEAM_MB = process.env.TEAM_MAILBOX_ID?.trim() || '';

async function main() {
    if (!/^0x[a-fA-F0-9]{64}$/.test(TEAM_MB)) {
        console.error('TEAM_MAILBOX_ID fehlt oder ungültig (0x + 64 Hex).');
        console.error('Zuerst: npx tsx scripts/test-create-team-mailbox-command.ts');
        process.exit(1);
    }
    console.log('PACKAGE_ID:', CFG.PACKAGE_ID?.slice(0, 18) + '…');
    console.log('TEAM_MAILBOX_ID:', TEAM_MB.slice(0, 14) + '…');

    const pw = process.env.UNLOCK_PASSWORD?.trim();
    if (pw) {
        const unlock = await fetch(`${API}/api/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pw }),
        });
        const uj = (await unlock.json()) as { ok?: boolean; error?: string };
        if (!uj.ok) {
            console.error('Unlock fehlgeschlagen:', uj.error || unlock.status);
            process.exit(1);
        }
        console.log('Tresor entsperrt.');
    }

    const text = `M2c smoke ${new Date().toISOString()}`;
    const res = await fetch(`${API}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cmd: '/send-team-broadcast',
            args: [text],
            mailboxObjectId: TEAM_MB,
            messagingPersistenceMode: 'mailbox',
        }),
    });
    const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        digest?: string;
        txDigest?: string;
        nonce?: string;
    };
    console.log(JSON.stringify(body, null, 2));
    if (!body.ok) {
        console.error('\nHinweis: Move publish + create_globals + MAILBOX_STORE_PLAINTEXT nötig.');
        process.exit(1);
    }
    const digest = body.txDigest || body.digest;
    if (digest) console.log('\nExplorer: TX-Digest', digest);
    console.log('\nNächster Check: Posteingang / Direkt-RPC — Team-Broadcast von MY_ADDRESS sichtbar.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
