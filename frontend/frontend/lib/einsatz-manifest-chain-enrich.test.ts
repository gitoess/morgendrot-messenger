import { describe, expect, it, vi } from 'vitest'
import {
    enrichEinsatzManifestChainEvidence,
    fetchSourceTxTimestampMs,
    inferEinsatzManifestEvidenceStatus,
} from './einsatz-manifest-chain-enrich'
import type { EinsatzManifestV1 } from './einsatz-manifest-v1'

const baseManifest = (): EinsatzManifestV1 => ({
    manifest_version: 1,
    einsatz_id: 'demo',
    period_start_ms: 1000,
    period_end_ms: 2000,
    source_network: 'testnet',
    source_package_id: '0x' + 'a'.repeat(64),
    merkle_root: 'b'.repeat(64),
    sequence: 1,
    manifest_hash: 'c'.repeat(64),
    entries: [
        {
            canonical_msg_ref: 'd'.repeat(64),
            entry_hash: 'e'.repeat(64),
            source_tx_digest: 'digest-abc',
            primary_transport: 'iota',
            channel: '1:1',
            sender: '0x' + 'f'.repeat(64),
            recipient_or_board: '0x' + '1'.repeat(64),
            timestamp_ms: 1500,
        },
    ],
})

describe('inferEinsatzManifestEvidenceStatus', () => {
    it('markiert chain_linked bei Digest', () => {
        expect(
            inferEinsatzManifestEvidenceStatus({ source_tx_digest: 'tx1', primary_transport: 'lora' })
        ).toBe('chain_linked')
    })
    it('markiert mesh_only ohne Digest auf LoRa', () => {
        expect(inferEinsatzManifestEvidenceStatus({ primary_transport: 'lora' })).toBe('mesh_only')
    })
})

describe('fetchSourceTxTimestampMs', () => {
    it('liest timestampMs aus RPC-Antwort', async () => {
        const client = {
            getTransactionBlock: vi.fn().mockResolvedValue({ timestampMs: 1_700_000_000_000 }),
        }
        const ts = await fetchSourceTxTimestampMs(client as never, 'digest-abc')
        expect(ts).toBe(1_700_000_000_000)
    })
})

describe('enrichEinsatzManifestChainEvidence', () => {
    it('fügt evidence_status ohne RPC-Zeit bei fehlendem Digest', async () => {
        const out = await enrichEinsatzManifestChainEvidence(
            {
                ...baseManifest(),
                entries: [
                    {
                        ...baseManifest().entries[0]!,
                        source_tx_digest: undefined,
                        primary_transport: 'lora',
                    },
                ],
            },
            ''
        )
        expect(out.entries[0]?.evidence_status).toBe('mesh_only')
        expect(out.entries[0]?.source_tx_timestamp_ms).toBeUndefined()
    })
})
