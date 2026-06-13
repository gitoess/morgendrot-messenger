import { describe, expect, it } from 'vitest'
import {
    looksLikeHttpRpcUrl,
    resolveManifestEnrichmentRpcUrl,
} from './einsatz-manifest-rpc'

describe('einsatz-manifest-rpc', () => {
    it('lehnt Netzwerk-Labels ab', () => {
        expect(looksLikeHttpRpcUrl('Testnet')).toBe(false)
        expect(looksLikeHttpRpcUrl('Mainnet / Dienst')).toBe(false)
    })

    it('akzeptiert http(s)-URLs', () => {
        expect(looksLikeHttpRpcUrl('https://api.testnet.iota.cafe')).toBe(true)
    })

    it('nutzt Testnet-Default im Testnet+Anker-Modus', () => {
        expect(
            resolveManifestEnrichmentRpcUrl({
                chainMode: 'testnet-with-mainnet-anchor',
            })
        ).toBe('https://api.testnet.iota.cafe')
    })
})
