/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { Transaction } from '@iota/iota-sdk/transactions'
import {
    parseBossSignerAllowedPackageIds,
    validateBossSignerPtbBytes,
    validateBossSignerPtbPolicyConfig,
} from './boss-signer-ptb-policy.js'

const PKG = '0x' + 'a'.repeat(64)

async function buildMessagingTxBase64(fn: string, pkg = PKG): Promise<string> {
    const tx = new Transaction()
    tx.moveCall({ target: `${pkg}::messaging::${fn}`, arguments: [] })
    const bytes = await tx.build({ onlyTransactionKind: true })
    return Buffer.from(bytes).toString('base64')
}

async function buildTransferTxBase64(): Promise<string> {
    const tx = new Transaction()
    tx.setSender('0x' + 'b'.repeat(64))
    const coin = tx.splitCoins(tx.gas, [1n])
    tx.transferObjects([coin], '0x' + 'c'.repeat(64))
    const bytes = await tx.build({ onlyTransactionKind: true })
    return Buffer.from(bytes).toString('base64')
}

describe('boss-signer-ptb-policy', () => {
    it('requires package ids for worker-messenger policy', () => {
        expect(validateBossSignerPtbPolicyConfig('worker-messenger', new Set(), false)).toMatch(/PACKAGE_ID/)
        expect(
            validateBossSignerPtbPolicyConfig('worker-messenger', parseBossSignerAllowedPackageIds(undefined, PKG), false)
        ).toBeNull()
    })

    it('allows messaging handshake store', async () => {
        const b64 = await buildMessagingTxBase64('store_ecdh_init')
        const r = validateBossSignerPtbBytes(b64, 'worker-messenger', new Set([PKG]))
        expect(r.ok).toBe(true)
        if (r.ok) expect(r.moveCalls[0]?.function).toBe('store_ecdh_init')
    })

    it('rejects create_access_key', async () => {
        const b64 = await buildMessagingTxBase64('create_access_key')
        const r = validateBossSignerPtbBytes(b64, 'worker-messenger', new Set([PKG]))
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.error).toMatch(/create_access_key/)
    })

    it('rejects wrong package id', async () => {
        const other = '0x' + 'b'.repeat(64)
        const b64 = await buildMessagingTxBase64('emit_ecdh_init', other)
        const r = validateBossSignerPtbBytes(b64, 'worker-messenger', new Set([PKG]))
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.error).toMatch(/Package nicht erlaubt/)
    })

    it('rejects SplitCoins / TransferObjects PTB', async () => {
        const b64 = await buildTransferTxBase64()
        const r = validateBossSignerPtbBytes(b64, 'worker-messenger', new Set([PKG]))
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.error).toMatch(/Nicht erlaubter PTB-Command/)
    })

    it('skips validation when policy off', async () => {
        const b64 = await buildTransferTxBase64()
        const r = validateBossSignerPtbBytes(b64, 'off', new Set())
        expect(r.ok).toBe(true)
    })
})
