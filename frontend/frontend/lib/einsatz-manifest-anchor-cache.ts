'use client'

import type { EinsatzManifestV1 } from '@/frontend/lib/einsatz-manifest-v1'

const LS_ANCHOR_HASHES = 'morgendrot.einsatz.manifestAnchoredEntryHashes.v1'
const LS_LAST_META = 'morgendrot.einsatz.manifestLastAnchorMeta.v1'

export const EINSATZ_MANIFEST_ANCHOR_CHANGED = 'morgendrot:einsatz-manifest-anchor-changed'

export type EinsatzManifestAnchorMeta = {
    sequence: number
    manifest_hash: string
    anchoredAt: number
    digest?: string
}

export function readAnchoredManifestEntryHashes(): Set<string> {
    if (typeof window === 'undefined') return new Set()
    try {
        const raw = window.localStorage.getItem(LS_ANCHOR_HASHES)
        if (!raw) return new Set()
        const parsed = JSON.parse(raw) as unknown
        if (!Array.isArray(parsed)) return new Set()
        return new Set(parsed.filter((h): h is string => typeof h === 'string').map((h) => h.toLowerCase()))
    } catch {
        return new Set()
    }
}

export function readLastEinsatzManifestAnchorMeta(): EinsatzManifestAnchorMeta | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(LS_LAST_META)
        if (!raw) return null
        const m = JSON.parse(raw) as Partial<EinsatzManifestAnchorMeta>
        if (typeof m.sequence !== 'number' || typeof m.manifest_hash !== 'string') return null
        return {
            sequence: m.sequence,
            manifest_hash: m.manifest_hash,
            anchoredAt: typeof m.anchoredAt === 'number' ? m.anchoredAt : 0,
            digest: typeof m.digest === 'string' ? m.digest : undefined,
        }
    } catch {
        return null
    }
}

/** Nach Download oder On-chain-Anker: entry_hash-Set für Inbox-Badges erweitern. */
export function writeAnchoredManifestFromV1(
    manifest: EinsatzManifestV1,
    opts?: { digest?: string; replace?: boolean }
): void {
    if (typeof window === 'undefined') return
    try {
        const incoming = manifest.entries.map((e) => e.entry_hash.toLowerCase())
        const merged = opts?.replace ? new Set(incoming) : readAnchoredManifestEntryHashes()
        for (const h of incoming) merged.add(h)
        window.localStorage.setItem(LS_ANCHOR_HASHES, JSON.stringify([...merged]))
        const meta: EinsatzManifestAnchorMeta = {
            sequence: manifest.sequence,
            manifest_hash: manifest.manifest_hash,
            anchoredAt: Date.now(),
            digest: opts?.digest?.trim() || undefined,
        }
        window.localStorage.setItem(LS_LAST_META, JSON.stringify(meta))
        window.dispatchEvent(new CustomEvent(EINSATZ_MANIFEST_ANCHOR_CHANGED))
    } catch {
        /* ignore */
    }
}

export function clearAnchoredManifestEntryHashes(): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(LS_ANCHOR_HASHES)
        window.localStorage.removeItem(LS_LAST_META)
        window.dispatchEvent(new CustomEvent(EINSATZ_MANIFEST_ANCHOR_CHANGED))
    } catch {
        /* ignore */
    }
}
