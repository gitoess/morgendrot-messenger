/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'
import { fetchReferenceGasPrice } from './chain-iota-gas-price.js'

describe('chain-iota-gas-price', () => {
    it('nutzt SDK-Methode wenn vorhanden', async () => {
        const client = {
            getReferenceGasPrice: vi.fn(async () => '2500'),
        }
        await expect(fetchReferenceGasPrice(client as never)).resolves.toBe(2500n)
    })

    it('Fallback bei fehlender Methode', async () => {
        await expect(fetchReferenceGasPrice({} as never)).resolves.toBe(1000n)
    })

    it('Fallback bei Fehler', async () => {
        const client = {
            getReferenceGasPrice: vi.fn(async () => {
                throw new Error('rpc down')
            }),
        }
        await expect(fetchReferenceGasPrice(client as never)).resolves.toBe(1000n)
    })
})
