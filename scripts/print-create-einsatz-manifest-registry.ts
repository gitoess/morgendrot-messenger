/**
 * § H.33 Phase 2 — `create_einsatz_manifest_registry` nach Move-Deploy (Mainnet).
 *
 * Usage: npm run print:create-einsatz-manifest-registry
 */
import { CFG } from '../src/config.js'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

function detectNetworkLabel(rpc: string): string {
    const u = rpc.toLowerCase()
    if (u.includes('mainnet')) return 'Mainnet'
    if (u.includes('testnet')) return 'Testnet'
    return 'unbekannt (RPC prüfen)'
}

function main() {
    const rpc = (CFG.RPC_URL || '').trim() || 'https://api.mainnet.iota.cafe'
    const net = detectNetworkLabel(rpc)
    const pkg =
        (CFG.MAINNET_PACKAGE_ID || '').trim() ||
        (net === 'Mainnet' ? (CFG.PACKAGE_ID || '').trim() : '')
    const boss = (CFG.BOSS_ADDRESS || CFG.MY_ADDRESS || '').trim()

    if (!HEX64.test(pkg)) {
        console.error(
            'PACKAGE_ID bzw. MAINNET_PACKAGE_ID fehlt — zuerst npm run deploy:move-package auf Mainnet.\n' +
                'Modus A: MAINNET_PACKAGE_ID = Mainnet-Deploy; PACKAGE_ID = Testnet-Betrieb.'
        )
        process.exit(1)
    }
    if (!HEX64.test(boss)) {
        console.error('BOSS_ADDRESS oder MY_ADDRESS (0x+64) in .env setzen — wird authorized_anchorer.')
        process.exit(1)
    }

    const gas = '20000000'
    const call = `iota client call --package ${pkg} --module messaging --function create_einsatz_manifest_registry --args ${boss} --gas-budget ${gas} --json`

    console.log('§ H.33 — EinsatzManifestRegistry anlegen (einmal pro Mainnet-Package)\n')
    console.log(`Netz (RPC_URL): ${net}`)
    console.log(`RPC_URL:        ${rpc}`)
    console.log(`Package:        ${pkg}`)
    console.log(`Anchorer:       ${boss}\n`)
    console.log('Voraussetzungen:')
    console.log('  • IOTA-CLI auf dasselbe Netz wie RPC_URL (iota client active-env)')
    console.log('  • CLI-Wallet mit Gas (authorized_anchorer muss Sender sein)')
    console.log('  • Move enthält create_einsatz_manifest_registry (npm run deploy:move-package / upgrade)\n')
    console.log('Befehl:\n')
    console.log(call)
    console.log('\nRegistry-ID in .env (Option A — JSON-Datei):\n')
    console.log(`  ${call} > registry-tx.json`)
    console.log('  npm run apply:einsatz-manifest-registry-from-tx -- registry-tx.json')
    if (net === 'Mainnet' && HEX64.test((CFG.PACKAGE_ID || '').trim()) && pkg !== CFG.PACKAGE_ID?.trim()) {
        console.log(`  npm run apply:einsatz-manifest-registry-from-tx -- registry-tx.json ${pkg}`)
    }
    console.log('\nOption B — manuell aus Event EinsatzManifestRegistryCreated:')
    console.log('  EINSATZ_MANIFEST_REGISTRY_ID=0x…  (Feld registry_id)')
    console.log('\nModus A (Testnet-Betrieb + Mainnet-Anker) zusätzlich in Boss-.env:')
    console.log('  MAINNET_RPC_URL=https://api.mainnet.iota.cafe')
    console.log('  MAINNET_PACKAGE_ID=0x…   # gleiche Package wie oben')
    console.log('\nDoku: docs/DEPLOY-MOVE-H33-EINSATZ-MANIFEST.md')
}

main()
