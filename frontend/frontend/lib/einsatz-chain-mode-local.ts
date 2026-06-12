'use client'

import {
    parseEinsatzChainMode,
    type EinsatzChainMode,
    EINSATZ_CHAIN_MODE_ENV_KEY,
} from '@morgendrot/shared/einsatz-chain-mode'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'

const LS_CHAIN_MODE = 'morgendrot.einsatz.chainMode.v1'
const LS_LAST_ANCHOR_SEQ = 'morgendrot.einsatz.manifestLastSequence.v1'

function parseEnvChainMode(envText: string): EinsatzChainMode | null {
    const lines = envText.split(/\r?\n/)
    for (const raw of lines) {
        const line = raw.trim()
        if (!line || line.startsWith('#')) continue
        const i = line.indexOf('=')
        if (i < 1) continue
        const k = line.slice(0, i).trim()
        if (k !== EINSATZ_CHAIN_MODE_ENV_KEY) continue
        return parseEinsatzChainMode(line.slice(i + 1).trim())
    }
    return null
}

export function readPersistedEinsatzChainMode(): EinsatzChainMode | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(LS_CHAIN_MODE)?.trim()
        if (raw) return parseEinsatzChainMode(raw)
    } catch {
        /* ignore */
    }
    return null
}

export function persistEinsatzChainMode(mode: EinsatzChainMode): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(LS_CHAIN_MODE, mode)
    } catch {
        /* ignore */
    }
}

/** Aus Handoff-.env (Import) oder localStorage. */
export function resolveActiveEinsatzChainMode(envText?: string): EinsatzChainMode {
    if (envText?.trim()) {
        const fromEnv = parseEnvChainMode(envText)
        if (fromEnv) {
            persistEinsatzChainMode(fromEnv)
            return fromEnv
        }
    }
    const snap = readLocalHandoffAppliedSnapshot()
    if (snap?.einsatzChainMode) {
        persistEinsatzChainMode(snap.einsatzChainMode)
        return snap.einsatzChainMode
    }
    return readPersistedEinsatzChainMode() ?? 'mainnet-direct'
}

export function readEinsatzManifestLastAnchoredSequence(): number {
    if (typeof window === 'undefined') return 0
    try {
        const n = parseInt(window.localStorage.getItem(LS_LAST_ANCHOR_SEQ) ?? '0', 10)
        return Number.isFinite(n) && n >= 0 ? n : 0
    } catch {
        return 0
    }
}

export function writeEinsatzManifestLastAnchoredSequence(sequence: number): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(LS_LAST_ANCHOR_SEQ, String(Math.max(0, Math.floor(sequence))))
    } catch {
        /* ignore */
    }
}
