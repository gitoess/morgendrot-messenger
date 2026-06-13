/**
 * Typ-sichere Referenz-Gas-Preis-Abfrage (SDK-Methode nicht in allen IotaClient-Typen exportiert).
 */
import type { IotaClient } from '@iota/iota-sdk/client'

const DEFAULT_REFERENCE_GAS_PRICE = 1000n

type IotaClientWithReferenceGas = IotaClient & {
    getReferenceGasPrice(): Promise<string | number | bigint>
}

function hasReferenceGasPrice(client: IotaClient): client is IotaClientWithReferenceGas {
    return typeof (client as IotaClientWithReferenceGas).getReferenceGasPrice === 'function'
}

export async function fetchReferenceGasPrice(client: IotaClient): Promise<bigint> {
    if (!hasReferenceGasPrice(client)) return DEFAULT_REFERENCE_GAS_PRICE
    try {
        const price = await client.getReferenceGasPrice()
        const n = BigInt(String(price ?? DEFAULT_REFERENCE_GAS_PRICE))
        return n > 0n ? n : DEFAULT_REFERENCE_GAS_PRICE
    } catch {
        return DEFAULT_REFERENCE_GAS_PRICE
    }
}
