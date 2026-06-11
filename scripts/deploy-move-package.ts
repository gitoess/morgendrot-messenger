/**
 * Move-Paket (move-test) **neu publizieren** → neue PACKAGE_ID.
 * Für Erst-Deploy oder bewusst neues Package (Secure Edition, Breaking Change).
 *
 * Für Bugfixes ohne ID-Wechsel: npm run upgrade:move-package
 *
 * Usage: npm run deploy:move-package
 *        npm run deploy:move-package -- move-test
 */
import { CFG } from '../src/config.js';
import { applyPublishResultToEnv, publishPackageCli } from '../src/move-package-deploy.js';

const packageDir = process.argv[2]?.trim() || 'move-test';

async function main() {
    if (!CFG.RPC_URL?.trim()) {
        console.error('RPC_URL fehlt in .env — bitte Testnet/Mainnet-URL setzen.');
        process.exit(1);
    }
    console.log(`Publiziere Move-Paket aus ${packageDir} (RPC: ${CFG.RPC_URL})…`);
    console.log('Hinweis: Erzeugt neue PACKAGE_ID. Für In-Place-Update: npm run upgrade:move-package\n');
    const result = await publishPackageCli(packageDir);
    const applied = applyPublishResultToEnv(result);
    console.log('\nOK — Package-ID:', result.packageId);
    if (result.upgradeCapId) {
        console.log('UpgradeCap-ID:', result.upgradeCapId, '(in .env als UPGRADE_CAP_ID — für upgrade:move-package)');
    } else {
        console.warn('UpgradeCap-ID nicht in CLI-Ausgabe — ggf. Explorer prüfen und UPGRADE_CAP_ID manuell setzen.');
    }
    if (applied.envPackageOk) {
        console.log('PACKAGE_ID in .env aktualisiert.');
    } else {
        console.warn('.env PACKAGE_ID:', applied.envPackageError || 'nicht aktualisiert');
    }
    if (result.upgradeCapId) {
        console.log(applied.envCapOk ? 'UPGRADE_CAP_ID in .env gespeichert.' : `.env UPGRADE_CAP_ID: ${applied.envCapError || 'fehlgeschlagen'}`);
    }
    console.log(
        '\nNächste Schritte (Neu-Publish):\n' +
            '  1. create_globals (einmal pro Package) → MAILBOX_ID, VAULT_REGISTRY_ID, COMMAND_REGISTRY_ID\n' +
            '     Siehe docs/DEPLOY-MOVE-M4d.md\n' +
            '  2. Backend neu starten\n' +
            '  3. Neues Handoff-ZIP an Helfer\n' +
            '  Alternative ohne neue IDs: docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md'
    );
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
});
