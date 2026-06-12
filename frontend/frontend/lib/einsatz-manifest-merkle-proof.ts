/**
 * § H.33d — Merkle-Proof über sortierte entry_hash (gleicher Baum wie merkleRootFromEntryHashes).
 */
import { merkleRootFromEntryHashes } from '@/frontend/lib/einsatz-manifest-v1'

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
    const digest = await crypto.subtle.digest(
        'SHA-256',
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    )
    return new Uint8Array(digest)
}

function normalizeLeafHex(h: string): string {
    return h.trim().toLowerCase().replace(/^0x/, '').padStart(64, '0').slice(-64)
}

/** Geschwister-Hashes von Blatt bis zur Wurzel (ohne Wurzel). */
export async function buildMerkleProofForEntryHash(
    sortedEntryHashesHex: string[],
    targetEntryHashHex: string
): Promise<{ ok: true; proof: string[]; leafIndex: number } | { ok: false; error: string }> {
    const sorted = sortedEntryHashesHex.map(normalizeLeafHex).sort()
    const target = normalizeLeafHex(targetEntryHashHex)
    const leafIndex = sorted.indexOf(target)
    if (leafIndex < 0) {
        return { ok: false, error: 'entry_hash nicht in sortierter Blattmenge.' }
    }
    let level = sorted
    let index = leafIndex
    const proof: string[] = []
    while (level.length > 1) {
        const siblingIndex = index % 2 === 0 ? index + 1 : index - 1
        const sibling = level[siblingIndex] ?? level[index]!
        proof.push(sibling)
        index = Math.floor(index / 2)
        const next: string[] = []
        for (let i = 0; i < level.length; i += 2) {
            const left = hexToBytes(level[i]!)
            const right = hexToBytes(level[i + 1] ?? level[i]!)
            const combined = new Uint8Array(left.length + right.length)
            combined.set(left, 0)
            combined.set(right, left.length)
            next.push(bytesToHex(await sha256Bytes(combined)))
        }
        level = next
    }
    return { ok: true, proof, leafIndex }
}

export async function verifyMerkleProofForEntryHash(opts: {
    entryHashHex: string
    proof: string[]
    merkleRootHex: string
    leafIndex: number
}): Promise<boolean> {
    let hash = hexToBytes(normalizeLeafHex(opts.entryHashHex))
    let idx = opts.leafIndex
    for (const siblingHex of opts.proof) {
        const sibling = hexToBytes(normalizeLeafHex(siblingHex))
        const left = idx % 2 === 0 ? hash : sibling
        const right = idx % 2 === 0 ? sibling : hash
        const combined = new Uint8Array(left.length + right.length)
        combined.set(left, 0)
        combined.set(right, left.length)
        hash = await sha256Bytes(combined)
        idx = Math.floor(idx / 2)
    }
    return bytesToHex(hash) === normalizeLeafHex(opts.merkleRootHex)
}

/** Prüft Proof für ersten Eintrag — Smoke für gesamtes Manifest. */
export async function verifySampleMerkleProofForManifest(opts: {
    sortedEntryHashesHex: string[]
    merkleRootHex: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
    if (opts.sortedEntryHashesHex.length === 0) {
        const root = await merkleRootFromEntryHashes([])
        if (root !== normalizeLeafHex(opts.merkleRootHex)) {
            return { ok: false, error: 'Leerer Merkle-Baum stimmt nicht.' }
        }
        return { ok: true }
    }
    const first = normalizeLeafHex(opts.sortedEntryHashesHex[0]!)
    const built = await buildMerkleProofForEntryHash(opts.sortedEntryHashesHex, first)
    if (!built.ok) return built
    const valid = await verifyMerkleProofForEntryHash({
        entryHashHex: first,
        proof: built.proof,
        merkleRootHex: opts.merkleRootHex,
        leafIndex: built.leafIndex,
    })
    if (!valid) return { ok: false, error: 'Merkle-Proof (Beispiel-Blatt) ungültig.' }
    return { ok: true }
}
