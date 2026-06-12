import { describe, expect, it } from 'vitest'
import {
    describeEinsatzChainModeBanner,
    einsatzChainModeShowsManifestAnchorUi,
    parseEinsatzChainMode,
} from './einsatz-chain-mode.js'

describe('einsatz-chain-mode', () => {
    it('parst Modus mit Default mainnet-direct', () => {
        expect(parseEinsatzChainMode('testnet-with-mainnet-anchor')).toBe('testnet-with-mainnet-anchor')
        expect(parseEinsatzChainMode('')).toBe('mainnet-direct')
    })

    it('Rollup-UI nur wenn nicht no-rollup', () => {
        expect(einsatzChainModeShowsManifestAnchorUi('mainnet-direct')).toBe(true)
        expect(einsatzChainModeShowsManifestAnchorUi('mainnet-direct-no-rollup')).toBe(false)
    })

    it('Banner Testnet', () => {
        const b = describeEinsatzChainModeBanner('testnet-with-mainnet-anchor', 'https://api.testnet.iota.cafe')
        expect(b.tone).toBe('testnet')
        expect(b.title).toContain('Testnet')
    })
})
