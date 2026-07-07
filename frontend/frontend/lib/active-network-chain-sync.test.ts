import { describe, expect, it, beforeEach } from 'vitest'
import {
    isPackageNotFoundOnChainError,
    isWrongNetworkPackageError,
    applyDirectChainSnapshotFromStatusOrNetworkProfile,
    ensureDirectChainAlignedWithActiveProfile,
    isMainnetDirectSendBlockedError,
    purgeStaleOfflineMailboxQueue,
    recoverMainnetDirectSendBlockedFailure,
    recoverWrongNetworkPackageSendFailure,
} from './active-network-chain-sync'
import { getDirectChainFieldIdsFromLs } from '@/frontend/lib/direct-iota-chain-context'
import { saveOfflineMailboxQueue } from '@/frontend/lib/api/offline-queue'

const TESTNET_PKG = '0x' + '6'.repeat(64)
const MAINNET_PKG = '0x' + '7'.repeat(64)

describe('active-network-chain-sync', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('erkennt Package-not-found Fehler', () => {
        expect(
            isPackageNotFoundOnChainError(
                'Package object does not exist with ID 0x06e099c095548b36cfb6eb3373ad1aa73e72f83f6e53c51854df719e7836dc88'
            )
        ).toBe(true)
    })

    it('erkennt Dependent-package-not-found Fehler', () => {
        expect(
            isWrongNetworkPackageError(
                'Transaction execution failed: Dependent package not found on-chain: 0x06e099c095548b36cfb6eb3373ad1aa73e72f83f6e53c51854df719e7836dc88'
            )
        ).toBe(true)
    })

    it('Boss-Status überschreibt Mainnet-Profil nicht', () => {
        localStorage.setItem(
            'morgendrot.einsatz.networkProfiles.v1',
            JSON.stringify({
                active: 'mainnet',
                testnet: {
                    rpcUrl: 'https://api.testnet.iota.cafe',
                    packageId: TESTNET_PKG,
                    mailboxId: '0x' + 'a'.repeat(64),
                },
                mainnet: {
                    rpcUrl: 'https://api.mainnet.iota.cafe',
                    packageId: MAINNET_PKG,
                    mailboxId: '0x' + 'b'.repeat(64),
                },
            })
        )
        localStorage.setItem('morgendrot.directChain.packageId', TESTNET_PKG)
        localStorage.setItem('morgendrot.directChain.mailboxId', '0x' + 'a'.repeat(64))
        localStorage.setItem('morgendrot.directChain.senderAddress', '0x' + 'd'.repeat(64))

        applyDirectChainSnapshotFromStatusOrNetworkProfile({
            packageId: TESTNET_PKG,
            mailboxId: '0x' + 'a'.repeat(64),
            myAddressFull: '0x' + 'd'.repeat(64),
        })

        expect(getDirectChainFieldIdsFromLs().packageId.toLowerCase()).toBe(MAINNET_PKG.toLowerCase())
    })

    it('Boss-Status füllt Testnet-Profil wenn aktiv', () => {
        localStorage.setItem(
            'morgendrot.einsatz.networkProfiles.v1',
            JSON.stringify({
                active: 'testnet',
                testnet: {
                    rpcUrl: 'https://api.testnet.iota.cafe',
                    packageId: TESTNET_PKG,
                    mailboxId: '0x' + 'a'.repeat(64),
                },
                mainnet: { rpcUrl: 'https://api.mainnet.iota.cafe', packageId: '', mailboxId: '' },
            })
        )
        applyDirectChainSnapshotFromStatusOrNetworkProfile({
            packageId: TESTNET_PKG,
            mailboxId: '0x' + 'a'.repeat(64),
            myAddressFull: '0x' + 'd'.repeat(64),
        })
        expect(getDirectChainFieldIdsFromLs().packageId.toLowerCase()).toBe(TESTNET_PKG.toLowerCase())
    })

    it('ensureDirectChainAlignedWithActiveProfile korrigiert veraltete LS-Package-ID', () => {
        localStorage.setItem(
            'morgendrot.einsatz.networkProfiles.v1',
            JSON.stringify({
                active: 'mainnet',
                testnet: {
                    rpcUrl: 'https://api.testnet.iota.cafe',
                    packageId: TESTNET_PKG,
                    mailboxId: '0x' + 'a'.repeat(64),
                },
                mainnet: {
                    rpcUrl: 'https://api.mainnet.iota.cafe',
                    packageId: MAINNET_PKG,
                    mailboxId: '0x' + 'b'.repeat(64),
                },
            })
        )
        localStorage.setItem('morgendrot.directChain.packageId', TESTNET_PKG)
        localStorage.setItem('morgendrot.directChain.mailboxId', '0x' + 'a'.repeat(64))
        localStorage.setItem('morgendrot.directChain.senderAddress', '0x' + 'd'.repeat(64))
        localStorage.setItem('morgendrot.directIotaRpcUrl', 'https://api.mainnet.iota.cafe')

        expect(ensureDirectChainAlignedWithActiveProfile()).toBe(true)
        expect(getDirectChainFieldIdsFromLs().packageId.toLowerCase()).toBe(MAINNET_PKG.toLowerCase())
    })

    it('recoverMainnetDirectSendBlockedFailure leert Queue', () => {
        saveOfflineMailboxQueue([
            {
                id: 'q2',
                kind: 'plain_send',
                status: 'pending',
                recipient: '0x' + 'c'.repeat(64),
                payload: 'hi',
                encrypted: false,
                createdAt: 1,
                attempts: 1,
                lastAttemptAt: 0,
                clientOutSeq: 1,
                timeIsTrusted: true,
                priority: 100,
            },
        ])
        expect(isMainnetDirectSendBlockedError('Produktion (Mainnet): Direkt-RPC, Session-Signer')).toBe(true)
        const { cleared } = recoverMainnetDirectSendBlockedFailure()
        expect(cleared).toBe(1)
    })

    it('recoverWrongNetworkPackageSendFailure leert Queue und liefert Hinweis', () => {
        saveOfflineMailboxQueue([
            {
                id: 'q1',
                kind: 'plain_send',
                status: 'pending',
                recipient: '0x' + 'c'.repeat(64),
                payload: 'hi',
                encrypted: false,
                createdAt: 1,
                attempts: 1,
                lastAttemptAt: 0,
                clientOutSeq: 1,
                timeIsTrusted: true,
                priority: 100,
            },
        ])
        const { cleared, userMessage } = recoverWrongNetworkPackageSendFailure(
            'Dependent package not found on-chain: 0x06e099'
        )
        expect(cleared).toBe(1)
        expect(userMessage).toMatch(/Package existiert auf diesem Netz nicht/)
        expect(userMessage).toMatch(/Warteschlange entfernt/)
    })

    it('leert Queue bei Mainnet-RPC + Testnet-Package im Snapshot', () => {
        localStorage.setItem(
            'morgendrot.einsatz.networkProfiles.v1',
            JSON.stringify({
                active: 'mainnet',
                testnet: {
                    rpcUrl: 'https://api.testnet.iota.cafe',
                    packageId: TESTNET_PKG,
                    mailboxId: '0x' + 'a'.repeat(64),
                },
                mainnet: {
                    rpcUrl: 'https://api.mainnet.iota.cafe',
                    packageId: MAINNET_PKG,
                    mailboxId: '0x' + 'b'.repeat(64),
                },
            })
        )
        localStorage.setItem('morgendrot.directChain.packageId', TESTNET_PKG)
        localStorage.setItem('morgendrot.directIotaRpcUrl', 'https://api.mainnet.iota.cafe')
        localStorage.setItem('morgendrot.offlineMailboxQueue', '1')
        localStorage.setItem(
            'morgendrot.offline-mailbox-queue.v1',
            JSON.stringify([
                {
                    id: 'q1',
                    kind: 'plain_send',
                    status: 'queued',
                    recipient: '0x' + 'c'.repeat(64),
                    payload: 'hi',
                    encrypted: false,
                    createdAt: 1,
                    attempts: 2,
                    lastAttemptAt: 1,
                    clientOutSeq: 1,
                    timeIsTrusted: true,
                    lastError: 'Package object does not exist',
                },
            ])
        )

        expect(purgeStaleOfflineMailboxQueue()).toBe(1)
    })
})
