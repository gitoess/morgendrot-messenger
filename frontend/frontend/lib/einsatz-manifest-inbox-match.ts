'use client'

import {
    buildEinsatzManifestCanonicalMsgRef,
    buildEinsatzManifestEntryHash,
    type EinsatzManifestV1,
} from '@/frontend/lib/einsatz-manifest-v1'
import type { Message } from '@/frontend/lib/types'

export type EinsatzManifestInboxMatchResult =
    | {
          ok: true
          matchedCount: number
          manifestOnlyCount: number
          inboxOnlyCount: number
      }
    | { ok: false; error: string }

async function inboxEntryHashes(messages: readonly Message[]): Promise<Set<string>> {
    const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)
    const hashes = new Set<string>()
    for (const m of sorted) {
        const canonical_msg_ref = await buildEinsatzManifestCanonicalMsgRef(m)
        const entry_hash = await buildEinsatzManifestEntryHash({
            canonical_msg_ref,
            sender: m.from,
            timestamp_ms: m.timestamp,
            content: m.content ?? '',
        })
        hashes.add(entry_hash.toLowerCase())
    }
    return hashes
}

/** § H.33d — Manifest-Einträge gegen aktuellen Posteingang abgleichen. */
export async function matchEinsatzManifestAgainstInbox(
    manifest: EinsatzManifestV1,
    messages: readonly Message[]
): Promise<EinsatzManifestInboxMatchResult> {
    if (!manifest.entries?.length) {
        return { ok: false, error: 'Manifest enthält keine Einträge.' }
    }
    const manifestHashes = new Set(manifest.entries.map((e) => e.entry_hash.toLowerCase()))
    const liveHashes = await inboxEntryHashes(messages)
    let matchedCount = 0
    for (const h of manifestHashes) {
        if (liveHashes.has(h)) matchedCount++
    }
    const manifestOnlyCount = manifestHashes.size - matchedCount
    const inboxOnlyCount = [...liveHashes].filter((h) => !manifestHashes.has(h)).length
    if (matchedCount === 0) {
        return {
            ok: false,
            error: 'Kein Eintrag des Manifests im aktuellen Posteingang gefunden.',
        }
    }
    return { ok: true, matchedCount, manifestOnlyCount, inboxOnlyCount }
}

export function parseEinsatzManifestV1Json(raw: string): EinsatzManifestV1 | { error: string } {
    try {
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object') {
            return { error: 'Ungültiges JSON.' }
        }
        const m = parsed as Partial<EinsatzManifestV1>
        if (m.manifest_version !== 1) return { error: 'manifest_version muss 1 sein.' }
        if (!m.einsatz_id?.trim()) return { error: 'einsatz_id fehlt.' }
        if (!Array.isArray(m.entries)) return { error: 'entries fehlt.' }
        if (!m.manifest_hash || !m.merkle_root) return { error: 'manifest_hash oder merkle_root fehlt.' }
        return m as EinsatzManifestV1
    } catch {
        return { error: 'JSON konnte nicht gelesen werden.' }
    }
}
