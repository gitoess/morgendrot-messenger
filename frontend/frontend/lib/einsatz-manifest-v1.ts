'use client'

/**
 * § H.33b — MORG_EINSATZ_MANIFEST_V1 (off-chain Rollup, Merkle + manifest_hash).
 */
import type { Message } from '@/frontend/lib/types'
import {
    einsatzChainModeSourceNetwork,
    type EinsatzChainMode,
} from '@morgendrot/shared/einsatz-chain-mode'
import { sha256HexUtf8 } from '@/frontend/lib/einsatzprotokoll-anchor'

export const MORG_EINSATZ_MANIFEST_VERSION = 1 as const

export type EinsatzManifestEntryV1 = {
    canonical_msg_ref: string
    entry_hash: string
    source_tx_digest?: string
    primary_transport: 'iota' | 'lora' | 'bluetooth' | 'sneakernet' | 'telegram'
    channel: '1:1' | 'group' | 'pinnwand' | 'telegram'
    sender: string
    recipient_or_board: string
    timestamp_ms: number
}

export type EinsatzManifestV1 = {
    manifest_version: typeof MORG_EINSATZ_MANIFEST_VERSION
    einsatz_id: string
    handoff_label?: string
    period_start_ms: number
    period_end_ms: number
    source_network: 'testnet' | 'mainnet'
    source_package_id: string
    entries: EinsatzManifestEntryV1[]
    merkle_root: string
    sequence: number
    manifest_hash: string
}

export type EinsatzManifestBodyForHash = Omit<EinsatzManifestV1, 'manifest_hash'>

export function manifestBodyForHash(manifest: EinsatzManifestV1): EinsatzManifestBodyForHash {
    const { manifest_hash: _omit, ...body } = manifest
    return body
}

export async function computeEinsatzManifestHash(manifest: EinsatzManifestV1): Promise<string> {
    return sha256HexUtf8(JSON.stringify(manifestBodyForHash(manifest)))
}

export async function einsatzIdUtf8ToMoveAddress(einsatzId: string): Promise<string> {
    const h = await sha256HexUtf8(einsatzId.trim() || 'einsatz')
    return `0x${h.slice(0, 64)}`
}

function hexToBytes(hex: string): Uint8Array {
    const h = hex.trim().toLowerCase().replace(/^0x/, '')
    if (h.length % 2 !== 0) throw new Error('Ungültige Hex-Länge')
    const out = new Uint8Array(h.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
    return out
}

function bytesToHex(bytes: Uint8Array): string {
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
    const digest = await crypto.subtle.digest('SHA-256', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
    return new Uint8Array(digest)
}

async function sha256HexBytes(data: Uint8Array): Promise<string> {
    return bytesToHex(await sha256Bytes(data))
}

function inferChannel(m: Message): EinsatzManifestEntryV1['channel'] {
    if (m.pinnwandPost) return 'pinnwand'
    if (m.chainPurgeKind === 'team-broadcast') return 'group'
    if (m.transports?.includes('telegram') || m.source === 'telegram') return 'telegram'
    return '1:1'
}

function inferTransport(m: Message): EinsatzManifestEntryV1['primary_transport'] {
    if (m.transports?.includes('mesh')) return 'lora'
    if (m.transports?.includes('adhoc')) return 'bluetooth'
    if (m.transports?.includes('telegram')) return 'telegram'
    if (m.source === 'mesh') return 'lora'
    return 'iota'
}

export async function buildCanonicalMsgRefPlaceholder(m: Message): Promise<string> {
    const canon = `${m.id}|${m.from}|${m.timestamp}|${(m.content ?? '').length}`
    return sha256HexUtf8(canon)
}

export async function buildEinsatzManifestEntryHash(entry: {
    canonical_msg_ref: string
    sender: string
    timestamp_ms: number
    content: string
}): Promise<string> {
    const contentHash = await sha256HexUtf8(entry.content)
    const canon = `${entry.canonical_msg_ref}|${entry.sender}|${entry.timestamp_ms}|${contentHash}`
    return sha256HexUtf8(canon)
}

/** Binärer Merkle-Tree über sortierte entry_hash (je 32 B). */
export async function merkleRootFromEntryHashes(entryHashesHex: string[]): Promise<string> {
    if (entryHashesHex.length === 0) {
        return '0'.repeat(64)
    }
    let level = entryHashesHex.map((h) => hexToBytes(h.padStart(64, '0').slice(-64)))
    while (level.length > 1) {
        const next: Uint8Array[] = []
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i]!
            const right = level[i + 1] ?? left
            const combined = new Uint8Array(left.length + right.length)
            combined.set(left, 0)
            combined.set(right, left.length)
            next.push(await sha256Bytes(combined))
        }
        level = next
    }
    return bytesToHex(level[0]!)
}

export type BuildEinsatzManifestV1Input = {
    einsatzId: string
    handoffLabel?: string
    packageId: string
    chainMode: EinsatzChainMode
    rpcUrl?: string
    messages: Message[]
    sequence?: number
}

export async function buildEinsatzManifestV1(input: BuildEinsatzManifestV1Input): Promise<EinsatzManifestV1> {
    const sorted = [...input.messages].sort((a, b) => a.timestamp - b.timestamp)
    const entries: EinsatzManifestEntryV1[] = []
    for (const m of sorted) {
        const canonical_msg_ref = await buildCanonicalMsgRefPlaceholder(m)
        const content = m.content ?? ''
        const entry_hash = await buildEinsatzManifestEntryHash({
            canonical_msg_ref,
            sender: m.from,
            timestamp_ms: m.timestamp,
            content,
        })
        entries.push({
            canonical_msg_ref,
            entry_hash,
            source_tx_digest: undefined,
            primary_transport: inferTransport(m),
            channel: inferChannel(m),
            sender: m.from,
            recipient_or_board: (m.recipient ?? '').trim() || m.from,
            timestamp_ms: m.timestamp,
        })
    }
    const period_start_ms = entries[0]?.timestamp_ms ?? Date.now()
    const period_end_ms = entries[entries.length - 1]?.timestamp_ms ?? period_start_ms
    const entryHashes = entries.map((e) => e.entry_hash).sort()
    const merkle_root = await merkleRootFromEntryHashes(entryHashes)
    const source_network = einsatzChainModeSourceNetwork(input.chainMode, input.rpcUrl ?? '')
    const body = {
        manifest_version: MORG_EINSATZ_MANIFEST_VERSION,
        einsatz_id: input.einsatzId,
        handoff_label: input.handoffLabel?.trim() || undefined,
        period_start_ms,
        period_end_ms,
        source_network,
        source_package_id: input.packageId.trim(),
        entries,
        merkle_root,
        sequence: input.sequence ?? 0,
    }
    const manifest_hash = await sha256HexUtf8(JSON.stringify(body))
    return { ...body, manifest_hash, sequence: body.sequence ?? 0 }
}

export function downloadEinsatzManifestJson(manifest: EinsatzManifestV1): void {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `morgendrot-einsatz-manifest-${manifest.einsatz_id.slice(0, 12)}-seq${manifest.entries.length}.json`
    a.click()
    URL.revokeObjectURL(url)
}
