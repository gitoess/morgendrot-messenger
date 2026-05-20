/**
 * Smoke: /create-private-mailbox gegen laufende API (Tresor entsperrt, neues PACKAGE_ID).
 * Usage: UNLOCK_PASSWORD=… tsx scripts/test-create-private-mailbox-command.ts
 */
import { CFG } from '../src/config.js';

const API = process.env.API_BASE || 'http://127.0.0.1:3342';

async function main() {
    console.log('PACKAGE_ID:', CFG.PACKAGE_ID?.slice(0, 18) + '…');
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
    const res = await fetch(`${API}/api/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: '/create-private-mailbox', args: [] }),
    });
    const body = (await res.json()) as {
        ok?: boolean;
        objectId?: string;
        message?: string;
        error?: string;
        digest?: string;
    };
    console.log(JSON.stringify(body, null, 2));
    if (!body.ok) process.exit(1);
    if (body.objectId) console.log('\nPrivate Mailbox Object-ID:', body.objectId);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
