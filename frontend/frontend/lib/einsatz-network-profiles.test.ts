import { describe, expect, it } from 'vitest'
import {
    chainModeForNetwork,
    defaultNetworkProfilesState,
    mergeNetworkProfilesFromApi,
    validateNetworkProfile,
} from './einsatz-network-profiles'

describe('einsatz-network-profiles', () => {
    it('mappt Netz zu Kettenmodus', () => {
        expect(chainModeForNetwork('testnet')).toBe('testnet-with-mainnet-anchor')
        expect(chainModeForNetwork('mainnet')).toBe('mainnet-direct')
    })

    it('validiert Package + RPC + Mailbox', () => {
        const ok = validateNetworkProfile({
            rpcUrl: 'https://api.testnet.iota.cafe',
            packageId: '0x' + 'a'.repeat(64),
            mailboxId: '0x' + 'b'.repeat(64),
        })
        expect(ok.ok).toBe(true)

        const bad = validateNetworkProfile({
            rpcUrl: 'Testnet',
            packageId: '',
            mailboxId: '',
        })
        expect(bad.ok).toBe(false)
        expect(bad.missing).toContain('RPC-URL')
        expect(bad.missing).toContain('Mailbox-ID')
    })

    it('mergt Mainnet-Felder aus ApiStatus', () => {
        const base = defaultNetworkProfilesState()
        const merged = mergeNetworkProfilesFromApi(base, {
            packageId: '0x' + 'b'.repeat(64),
            einsatzConfig: {
                editionLabel: 'x',
                defaultTtlDays: 30,
                enablePurge: true,
                mainnetPackageId: '0x' + 'c'.repeat(64),
                mainnetRpcUrl: 'https://api.mainnet.iota.cafe',
            },
        } as never)
        expect(merged.testnet.packageId).toBe('0x' + 'b'.repeat(64))
        expect(merged.mainnet.packageId).toBe('0x' + 'c'.repeat(64))
    })

    it('überschreibt Testnet-Profil nicht wenn Mainnet aktiv und Boss noch Testnet-IDs liefert', () => {
        const testnetPkg = '0x' + 'a'.repeat(64)
        const testnetMb = '0x' + 'b'.repeat(64)
        const mainnetPkg = '0x' + 'c'.repeat(64)
        const base: ReturnType<typeof defaultNetworkProfilesState> = {
            active: 'mainnet',
            testnet: {
                rpcUrl: 'https://api.testnet.iota.cafe',
                packageId: testnetPkg,
                mailboxId: testnetMb,
            },
            mainnet: {
                rpcUrl: 'https://api.mainnet.iota.cafe',
                packageId: mainnetPkg,
                mailboxId: '0x' + 'd'.repeat(64),
            },
        }
        const merged = mergeNetworkProfilesFromApi(base, {
            packageId: testnetPkg,
            mailboxId: testnetMb,
        } as never)
        expect(merged.testnet.packageId).toBe(testnetPkg)
        expect(merged.mainnet.packageId).toBe(mainnetPkg)
    })
})
