/**
 * Hilfen zum Auslesen von `iota client … --json` (Events / parsedJson).
 * § H.33 — `EinsatzManifestRegistryCreated.registry_id`.
 */

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function normalizeHexId(v: unknown): string | null {
    const s = typeof v === 'string' ? v.trim() : ''
    return /^0x[a-fA-F0-9]{64}$/i.test(s) ? s.toLowerCase() : null
}

function collectEvents(txJson: unknown): unknown[] {
    const root = asRecord(txJson)
    if (!root) return []
    const direct = root.events
    if (Array.isArray(direct)) return direct
    const effects = asRecord(root.effects)
    const fromEffects = effects?.events
    if (Array.isArray(fromEffects)) return fromEffects
    const result = asRecord(root.result)
    const fromResult = result?.events
    if (Array.isArray(fromResult)) return fromResult
    return []
}

/** Sucht `parsedJson[field]` im ersten Event, dessen `type` den Suffix enthält. */
export function extractEventParsedField(
    txJson: unknown,
    eventTypeSuffix: string,
    field: string
): string | null {
    const suffix = eventTypeSuffix.trim()
    const key = field.trim()
    if (!suffix || !key) return null
    for (const raw of collectEvents(txJson)) {
        const ev = asRecord(raw)
        if (!ev) continue
        const typeStr = String(ev.type ?? '')
        if (!typeStr.includes(suffix)) continue
        const parsed = asRecord(ev.parsedJson) ?? asRecord(ev.parsed_json)
        if (!parsed) continue
        const id = normalizeHexId(parsed[key])
        if (id) return id
    }
    return null
}

export function extractEinsatzManifestRegistryIdFromTxJson(txJson: unknown): string | null {
    return extractEventParsedField(txJson, 'EinsatzManifestRegistryCreated', 'registry_id')
}
