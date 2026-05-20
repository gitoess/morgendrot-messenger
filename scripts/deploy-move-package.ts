/**
 * Move-Paket (move-test) publizieren und PACKAGE_ID in .env + .morgendrot-package-id schreiben.
 * Voraussetzung: IOTA-CLI (`iota client publish`), RPC_URL in .env, Gas auf der CLI-Wallet.
 *
 * Usage: npm run deploy:move-package
 *        npm run deploy:move-package -- move-test
 */
import { CFG, savePackageIdToFile, setEnvKey } from '../src/config.js';
import { publishPackageCli } from '../src/chain-access.js';

const packageDir = process.argv[2]?.trim() || 'move-test';

async function main() {
    if (!CFG.RPC_URL?.trim()) {
        console.error('RPC_URL fehlt in .env — bitte Testnet/Mainnet-URL setzen.');
        process.exit(1);
    }
    console.log(`Publiziere Move-Paket aus ${packageDir} (RPC: ${CFG.RPC_URL})…`);
    const packageId = await publishPackageCli(packageDir);
    (CFG as { PACKAGE_ID: string }).PACKAGE_ID = packageId;
    process.env.PACKAGE_ID = packageId;
    savePackageIdToFile(packageId);
    const envResult = setEnvKey('PACKAGE_ID', packageId);
    console.log('\nOK — Package-ID:', packageId);
    if (envResult.ok) {
        console.log('PACKAGE_ID in .env aktualisiert.');
    } else {
        console.warn('.env nicht aktualisiert:', envResult.error || 'unbekannt');
    }
    console.log(
        '\nNächste Schritte:\n' +
            '  1. create_globals (einmal pro Package) → MAILBOX_ID, VAULT_REGISTRY_ID, COMMAND_REGISTRY_ID in .env\n' +
            '     Siehe docs/DEPLOY-MOVE-M4d.md\n' +
            '  2. Backend neu starten (npm run dev)\n' +
            '  3. UI: Mailbox-Liste + /create-private-mailbox + /purge-private-mailbox (Rebate)'
    );
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
});
