/**
 * Boss-Provisioning: Handshake beim Erstellen/Zuweisen einer Adresse senden.
 * Wenn der Boss Adressen für Maschinen erstellt, kann er mit diesem Skript sofort
 * den Handshake an den Partner senden – die Maschine braucht dann keinen separaten
 * Handshake-Schritt mehr; /connect findet den bereits gesendeten Handshake.
 *
 * Aufruf (auf dem Boss-Rechner mit Wallet/CLI):
 *   npx tsx scripts/boss-provision-handshake.ts --address 0x... --partner 0x... --pubkey <base64>
 * oder --pubkey-file <Pfad> (eine Zeile Base64 mit dem öffentlichen Key der Maschine).
 *
 * .env auf dem Boss: PACKAGE_ID, ggf. MAILBOX_ID, RPC_URL. MY_ADDRESS wird durch --address überschrieben.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

function parseArgs(): { address: string; partner: string; pubkey: string } {
    const args = process.argv.slice(2);
    let address = '';
    let partner = '';
    let pubkey = '';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--address' && args[i + 1]) {
            address = args[++i];
        } else if (args[i] === '--partner' && args[i + 1]) {
            partner = args[++i];
        } else if (args[i] === '--pubkey' && args[i + 1]) {
            pubkey = args[++i];
        } else if (args[i] === '--pubkey-file' && args[i + 1]) {
            const file = path.resolve(process.cwd(), args[++i]);
            pubkey = fs.readFileSync(file, 'utf-8').trim();
        }
    }
    if (!address || !partner || !pubkey) {
        console.error('Verwendung: npx tsx scripts/boss-provision-handshake.ts --address 0x... --partner 0x... --pubkey <base64>');
        console.error('  oder --pubkey-file <datei> (eine Zeile Base64 = öffentlicher Key der Maschine).');
        process.exit(1);
    }
    return { address, partner, pubkey };
}

async function main() {
    const { address, partner, pubkey } = parseArgs();
    process.env.MY_ADDRESS = address;

    const pubKeyRaw = Buffer.from(pubkey, 'base64');
    if (pubKeyRaw.length < 32) {
        console.error('Ungültiger Pubkey (Base64 sollte mind. 32 Bytes ergeben).');
        process.exit(1);
    }

    const { getClient, buildHandshakeTransaction, signAndExecute } = await import('../src/chain-access.js');
    const { readPasswordMasked } = await import('../src/read-password.js');

    const password = process.env.WALLET_PASSWORD || (await readPasswordMasked('Wallet-Passwort (Boss): '));
    const client = getClient();
    const txb = buildHandshakeTransaction(address, partner, new Uint8Array(pubKeyRaw));
    const result = await signAndExecute(client, txb, address, password);
    console.log('Handshake gesendet. Digest:', result.digest ?? '–');
}

main().catch((e) => {
    console.error(e?.message || e);
    process.exit(1);
});
