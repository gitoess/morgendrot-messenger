'use client'

import {
    computeEinsatzManifestHash,
    merkleRootFromEntryHashes,
    type EinsatzManifestV1,
} from '@/frontend/lib/einsatz-manifest-v1'

export type EinsatzManifestVerifyResult =
    | { ok: true }
    | { ok: false; error: string }

export async function verifyEinsatzManifestV1(manifest: EinsatzManifestV1): Promise<EinsatzManifestVerifyResult> {
    if (manifest.manifest_version !== 1) {
        return { ok: false, error: 'manifest_version muss 1 sein.' }
    }
    if (!manifest.manifest_hash || manifest.manifest_hash.length !== 64) {
        return { ok: false, error: 'manifest_hash fehlt oder ungültige Länge.' }
    }
    if (!manifest.merkle_root || manifest.merkle_root.length !== 64) {
        return { ok: false, error: 'merkle_root fehlt oder ungültige Länge.' }
    }
    const expectedHash = await computeEinsatzManifestHash(manifest)
    if (expectedHash !== manifest.manifest_hash.toLowerCase()) {
        return { ok: false, error: 'manifest_hash stimmt nicht mit Inhalt überein.' }
    }
    const entryHashes = manifest.entries.map((e) => e.entry_hash).sort()
    const expectedRoot = await merkleRootFromEntryHashes(entryHashes)
    if (expectedRoot !== manifest.merkle_root.toLowerCase()) {
        return { ok: false, error: 'merkle_root stimmt nicht mit entries überein.' }
    }
    return { ok: true }
}
