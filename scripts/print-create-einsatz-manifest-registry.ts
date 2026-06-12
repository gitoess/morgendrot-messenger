/**
 * § H.33 Phase 2 — Hinweis für `create_einsatz_manifest_registry` nach Move-Deploy.
 *
 * Usage: npm run print:create-einsatz-manifest-registry
 */
import { CFG } from '../src/config.js'

function main() {
    const pkg = (CFG.PACKAGE_ID || '').trim()
    const boss = (CFG.BOSS_ADDRESS || CFG.MY_ADDRESS || '').trim()
    if (!/^0x[a-fA-F0-9]{64}$/i.test(pkg)) {
        console.error('PACKAGE_ID fehlt oder ungültig — zuerst npm run deploy:move-package')
        process.exit(1)
    }
    if (!/^0x[a-fA-F0-9]{64}$/i.test(boss)) {
        console.error('BOSS_ADDRESS oder MY_ADDRESS (0x+64) in .env setzen.')
        process.exit(1)
    }
    console.log('EinsatzManifestRegistry anlegen (einmal pro Mainnet-Package):\n')
    console.log(
        `iota client call --package ${pkg} --module messaging --function create_einsatz_manifest_registry --args ${boss} --gas-budget 20000000 --json`
    )
    console.log(
        '\nDanach Registry-ID aus Event EinsatzManifestRegistryCreated in .env:\n' +
            '  EINSATZ_MANIFEST_REGISTRY_ID=0x…\n' +
            'Siehe docs/EINSATZ-MANIFEST-MOVE-SKIZZE.md'
    )
}

main()
