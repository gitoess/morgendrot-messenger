/**
 * § H.33 Phase 2 — `registry_id` aus `iota client call … --json` in `.env` schreiben.
 *
 * Usage:
 *   iota client call … --json > registry-tx.json
 *   npm run apply:einsatz-manifest-registry-from-tx -- registry-tx.json
 *
 * Optional zweites Argument: Mainnet-PACKAGE_ID für MAINNET_PACKAGE_ID (Modus A).
 */
import fs from 'node:fs'
import path from 'node:path'
import { setEnvKey } from '../src/config.js'
import { extractEinsatzManifestRegistryIdFromTxJson } from '../src/shared/parse-iota-tx-json-events.js'

function readJsonInput(fileArg: string | undefined): unknown {
    if (fileArg && fileArg !== '-') {
        const p = path.resolve(process.cwd(), fileArg)
        const raw = fs.readFileSync(p, 'utf-8')
        return JSON.parse(raw) as unknown
    }
    const stdin = fs.readFileSync(0, 'utf-8')
    if (!stdin.trim()) {
        throw new Error('Keine JSON-Eingabe — Dateipfad oder Pipe von iota client --json.')
    }
    return JSON.parse(stdin) as unknown
}

function main() {
    const fileArg = process.argv[2]
    const mainnetPkgArg = (process.argv[3] || '').trim()
    const txJson = readJsonInput(fileArg)
    const registryId = extractEinsatzManifestRegistryIdFromTxJson(txJson)
    if (!registryId) {
        console.error(
            'Event EinsatzManifestRegistryCreated.registry_id nicht gefunden.\n' +
                'Prüfe: erfolgreiche TX? --json? Siehe docs/DEPLOY-MOVE-H33-EINSATZ-MANIFEST.md'
        )
        process.exit(1)
    }
    const regResult = setEnvKey('EINSATZ_MANIFEST_REGISTRY_ID', registryId)
    if (!regResult.ok) {
        console.error(regResult.error || 'setEnvKey EINSATZ_MANIFEST_REGISTRY_ID fehlgeschlagen')
        process.exit(1)
    }
    console.log(`EINSATZ_MANIFEST_REGISTRY_ID=${registryId}`)
    if (/^0x[a-fA-F0-9]{64}$/i.test(mainnetPkgArg)) {
        const pkgResult = setEnvKey('MAINNET_PACKAGE_ID', mainnetPkgArg)
        if (!pkgResult.ok) {
            console.error(pkgResult.error || 'setEnvKey MAINNET_PACKAGE_ID fehlgeschlagen')
            process.exit(1)
        }
        console.log(`MAINNET_PACKAGE_ID=${mainnetPkgArg}`)
    }
    console.log('\nBackend neu starten. UI: Einsatzleitung → On-chain prüfen.')
}

main()
