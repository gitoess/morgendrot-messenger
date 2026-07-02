import { describe, expect, it } from 'vitest'
import {
    applyBossWizardNetworkSetupPlan,
    defaultNetworkProfilesState,
    readNetworkProfilesState,
    writeNetworkProfilesState,
} from '@/frontend/lib/einsatz-network-profiles'
import {
    getBossMainnetWizardStatus,
    inferNetworkSetupPlanFromProfiles,
    isBossChainStepSatisfied,
    isBossMainnetProfileReady,
    readBossWizardNetworkSetupPlan,
} from '@/frontend/lib/boss-wizard-network-plan'

const PKG = '0x' + 'a'.repeat(64)
const MB = '0x' + 'b'.repeat(64)
const MAINNET_PKG = '0x' + 'c'.repeat(64)

describe('boss-wizard-network-plan', () => {
    it('liest Standard-Plan both wenn nicht gewählt', () => {
        writeNetworkProfilesState(defaultNetworkProfilesState())
        expect(readBossWizardNetworkSetupPlan()).toBe('both')
    })

    it('speichert gewählten Plan', () => {
        writeNetworkProfilesState(defaultNetworkProfilesState())
        applyBossWizardNetworkSetupPlan('testnet-only')
        expect(readBossWizardNetworkSetupPlan()).toBe('testnet-only')
    })

    it('inferiert testnet-only aus Server-Package', () => {
        const base = defaultNetworkProfilesState()
        expect(inferNetworkSetupPlanFromProfiles(base, { hasPackageId: true })).toBe('testnet-only')
    })

    it('inferiert both wenn Testnet und Mainnet bereit', () => {
        const base = defaultNetworkProfilesState()
        const state = {
            ...base,
            testnet: { ...base.testnet, packageId: PKG, mailboxId: MB },
            mainnet: {
                ...base.mainnet,
                packageId: MAINNET_PKG,
                mailboxId: '0x' + 'd'.repeat(64),
            },
        }
        expect(inferNetworkSetupPlanFromProfiles(state)).toBe('both')
    })

    it('chain-Schritt: testnet-only braucht Server-Package', () => {
        writeNetworkProfilesState(applyBossWizardNetworkSetupPlan('testnet-only'))
        expect(isBossChainStepSatisfied({ hasPackageId: false })).toBe(false)
        expect(isBossChainStepSatisfied({ hasPackageId: true })).toBe(true)
    })

    it('chain-Schritt: mainnet-only braucht Mainnet-Profil', () => {
        const base = defaultNetworkProfilesState()
        writeNetworkProfilesState(
            applyBossWizardNetworkSetupPlan('mainnet-only', {
                ...base,
                mainnet: {
                    ...base.mainnet,
                    packageId: MAINNET_PKG,
                    mailboxId: MB,
                },
            })
        )
        expect(isBossMainnetProfileReady()).toBe(true)
        expect(isBossChainStepSatisfied({ hasPackageId: false })).toBe(true)
    })

    it('erkennt Mainnet-Package aus Boss-API ohne lokales Profil (Verankern)', () => {
        writeNetworkProfilesState(defaultNetworkProfilesState())
        const status = getBossMainnetWizardStatus({
            packageId: PKG,
            einsatzConfig: {
                editionLabel: 'x',
                defaultTtlDays: 30,
                enablePurge: true,
                mainnetPackageId: MAINNET_PKG,
                mainnetRpcUrl: 'https://api.mainnet.iota.cafe',
            },
        } as never)
        expect(status.anchorReady).toBe(true)
        expect(status.sendReady).toBe(false)
        expect(inferNetworkSetupPlanFromProfiles(readNetworkProfilesState(), {
            hasPackageId: true,
            apiStatus: { packageId: PKG, einsatzConfig: { mainnetPackageId: MAINNET_PKG } } as never,
        })).toBe('both')
    })
})
