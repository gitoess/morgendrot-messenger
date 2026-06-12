import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { API_BASE } from '@/frontend/lib/api/api-base'
import type { EinsatzManifestAnchorRow } from '@morgendrot/core/iota'
import type { EinsatzChainMode } from '@morgendrot/shared/einsatz-chain-mode'

export type EinsatzManifestConfigResponse = {
    ok: true
    chainMode: EinsatzChainMode
    showManifestAnchorUi: boolean
    einsatzIdUtf8: string
    einsatzIdMoveAddress: string
    packageId?: string
    handoffLabel?: string
    einsatzManifestRegistryId?: string
    einsatzManifestRegistryIdMasked?: string
    mainnetPackageId?: string
    mainnetPackageIdMasked?: string
    mainnetRpcUrl?: string
    mainnetRpcUrlLabel?: string
    registryConfigured: boolean
    mainnetPackageConfigured: boolean
}

export type FetchEinsatzManifestAnchorsApiResult =
    | {
          ok: true
          rows: EinsatzManifestAnchorRow[]
          einsatzIdUtf8?: string
          einsatzIdMoveAddress?: string
          viaApi: true
      }
    | { ok: false; error: string; httpStatus?: number; viaApi?: true }

export type ProbeEinsatzManifestApiResult =
    | { ok: true; exists: boolean; sequence: number; viaApi: true }
    | { ok: false; error: string; httpStatus?: number; viaApi?: true }

function buildQuery(params: Record<string, string | number | undefined>): string {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === '') continue
        q.set(k, String(v))
    }
    const s = q.toString()
    return s ? `?${s}` : ''
}

function parseJsonBody<T extends Record<string, unknown>>(text: string): T | null {
    try {
        const parsed = JSON.parse(text) as unknown
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as T) : null
    } catch {
        return null
    }
}

export function parseEinsatzManifestAnchorsResponse(
    text: string,
    httpStatus: number
): FetchEinsatzManifestAnchorsApiResult | { ok: true; rows: EinsatzManifestAnchorRow[]; einsatzIdUtf8?: string; einsatzIdMoveAddress?: string } {
    const body = parseJsonBody<{
        ok?: boolean
        error?: string
        rows?: EinsatzManifestAnchorRow[]
        einsatzIdUtf8?: string
        einsatzIdMoveAddress?: string
    }>(text)
    if (!body) return { ok: false, error: 'Antwort ist kein gültiges JSON.', viaApi: true }
    if (httpStatus === 403) {
        return { ok: false, error: body.error || 'Keine Berechtigung.', httpStatus: 403, viaApi: true }
    }
    if (httpStatus < 200 || httpStatus >= 300 || !body.ok) {
        return {
            ok: false,
            error: body.error || `HTTP ${httpStatus}`,
            httpStatus,
            viaApi: true,
        }
    }
    return {
        ok: true,
        rows: Array.isArray(body.rows) ? body.rows : [],
        einsatzIdUtf8: body.einsatzIdUtf8,
        einsatzIdMoveAddress: body.einsatzIdMoveAddress,
    }
}

export function parseEinsatzManifestProbeResponse(
    text: string,
    httpStatus: number,
    fallbackSequence: number
): ProbeEinsatzManifestApiResult | { ok: true; exists: boolean; sequence: number } {
    const body = parseJsonBody<{ ok?: boolean; error?: string; exists?: boolean; sequence?: number }>(text)
    if (!body) return { ok: false, error: 'Antwort ist kein gültiges JSON.', viaApi: true }
    if (httpStatus === 403) {
        return { ok: false, error: body.error || 'Keine Berechtigung.', httpStatus: 403, viaApi: true }
    }
    if (httpStatus < 200 || httpStatus >= 300 || !body.ok) {
        return {
            ok: false,
            error: body.error || `HTTP ${httpStatus}`,
            httpStatus,
            viaApi: true,
        }
    }
    return {
        ok: true,
        exists: body.exists === true,
        sequence: Number.isFinite(body.sequence) ? Number(body.sequence) : fallbackSequence,
    }
}

/** GET `/api/einsatz-manifest/config` — Boss/Kommandant/Werkstatt. */
export async function fetchEinsatzManifestConfigFromApi(opts?: {
    einsatzId?: string
}): Promise<{ ok: true; config: EinsatzManifestConfigResponse } | { ok: false; error: string }> {
    try {
        const qs = buildQuery({ einsatzId: opts?.einsatzId })
        const fr = await fetchApiText(API_BASE, `/api/einsatz-manifest/config${qs}`)
        if (!fr.ok) return { ok: false, error: fr.error }
        const body = parseJsonBody<EinsatzManifestConfigResponse & { error?: string }>(fr.text)
        if (!body) return { ok: false, error: 'Antwort ist kein gültiges JSON.' }
        if (fr.response.status === 403) {
            return { ok: false, error: body.error || 'Keine Berechtigung für Einsatz-Manifest-API.' }
        }
        if (fr.response.status < 200 || fr.response.status >= 300 || body.ok !== true) {
            return { ok: false, error: body.error || `HTTP ${fr.response.status}` }
        }
        return { ok: true, config: body }
    } catch (e) {
        return { ok: false, error: formatFetchFailureMessage(e) }
    }
}

/** GET `/api/einsatz-manifest/anchors` — Mainnet-Anker via Boss-API (Fallback: Direct-RPC). */
export async function fetchEinsatzManifestAnchorsFromApi(opts?: {
    einsatzId?: string
}): Promise<FetchEinsatzManifestAnchorsApiResult> {
    try {
        const qs = buildQuery({ einsatzId: opts?.einsatzId })
        const fr = await fetchApiText(API_BASE, `/api/einsatz-manifest/anchors${qs}`)
        if (!fr.ok) return { ok: false, error: fr.error, viaApi: true }
        const parsed = parseEinsatzManifestAnchorsResponse(fr.text, fr.response.status)
        if (!parsed.ok) return parsed
        return { ...parsed, viaApi: true as const }
    } catch (e) {
        return { ok: false, error: formatFetchFailureMessage(e), viaApi: true }
    }
}

/** GET `/api/einsatz-manifest/probe?sequence=` — Sequenz auf Mainnet prüfen. */
export async function probeEinsatzManifestSequenceFromApi(opts: {
    sequence: number
    einsatzId?: string
}): Promise<ProbeEinsatzManifestApiResult> {
    try {
        const qs = buildQuery({ sequence: opts.sequence, einsatzId: opts.einsatzId })
        const fr = await fetchApiText(API_BASE, `/api/einsatz-manifest/probe${qs}`)
        if (!fr.ok) return { ok: false, error: fr.error, viaApi: true }
        const parsed = parseEinsatzManifestProbeResponse(fr.text, fr.response.status, opts.sequence)
        if (!parsed.ok) return parsed
        return { ...parsed, viaApi: true as const }
    } catch (e) {
        return { ok: false, error: formatFetchFailureMessage(e), viaApi: true }
    }
}
