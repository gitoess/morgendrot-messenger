/**
 * Move-Paket **upgraden** (gleiche PACKAGE_ID, Team-Mailbox-IDs bleiben).
 * Voraussetzung: UPGRADE_CAP_ID in .env (vom Erst-Publish) + IOTA-CLI-Wallet mit Cap-Besitz.
 *
 * Usage: npm run upgrade:move-package
 *        npm run upgrade:move-package -- move-test
 *        UPGRADE_CAP_ID=0x… npm run upgrade:move-package
 */
import { CFG } from '../src/config.js';
import { getClient } from '../src/chain-access.js';
import {
    resolveUpgradeCapId,
    upgradePackageCli,
} from '../src/move-package-deploy.js';

const packageDir = process.argv[2]?.trim() || 'move-test';
const capArg = process.argv.find((a) => /^0x[a-fA-F0-9]{64}$/i.test(a));

async function main() {
    if (!CFG.RPC_URL?.trim()) {
        console.error('RPC_URL fehlt in .env.');
        process.exit(1);
    }
    const packageId = (CFG.PACKAGE_ID || '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(packageId)) {
        console.error('PACKAGE_ID fehlt — Erst-Publish mit npm run deploy:move-package nötig.');
        process.exit(1);
    }
    let cap = capArg?.trim() || (CFG.UPGRADE_CAP_ID || '').trim();
    if (!/^0x[a-fA-F0-9]{64}$/i.test(cap)) {
        console.log('UPGRADE_CAP_ID nicht in .env — suche in CLI-Wallet…');
        cap =
            (await resolveUpgradeCapId({
                client: getClient(),
                packageId,
                ownerAddress: CFG.MY_ADDRESS || process.env.MY_ADDRESS || '',
            })) || '';
    }
    if (!/^0x[a-fA-F0-9]{64}$/i.test(cap)) {
        console.error(
            'Keine UpgradeCap gefunden. Nach Erst-Publish UPGRADE_CAP_ID in .env setzen (wird bei deploy:move-package mitgeschrieben).'
        );
        process.exit(1);
    }
    console.log(`Upgrade Move-Paket ${packageDir} (Package ${packageId.slice(0, 10)}…, Cap ${cap.slice(0, 10)}…)…`);
    const result = await upgradePackageCli(cap, packageDir);
    console.log('\nOK — Package upgraded (gleiche ID):', result.packageId);
    console.log(
        '\nNächste Schritte:\n' +
            '  1. Backend neu starten (npm run dev)\n' +
            '  2. Einsatzleitung → Erweitert → Chain-Status: Move-Funktionen prüfen\n' +
            '  3. Kein neues Handoff nötig (PACKAGE_ID + MAILBOX_ID unverändert)\n' +
            '  Siehe docs/DEPLOY-MOVE-UPGRADE-VS-PUBLISH.md'
    );
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
});
