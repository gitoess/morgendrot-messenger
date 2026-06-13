/**
 * Typ-Guards für entschlüsselte Vault-JSON-Payloads (Fail-Closed vor Key-Import).
 */
const B64_RE = /^[A-Za-z0-9+/=]+$/

function isRecord(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function assertBase64Field(obj: Record<string, unknown>, key: string): string {
    const v = obj[key]
    if (typeof v !== 'string' || !v.trim() || !B64_RE.test(v.trim())) {
        throw new Error(`Vault-Payload: ${key} fehlt oder ungültig.`)
    }
    return v.trim()
}

export type VaultKeysPayload = { pkcs8: string; pubRaw: string }

export function parseVaultKeysPayload(json: string): VaultKeysPayload {
    let parsed: unknown
    try {
        parsed = JSON.parse(json)
    } catch {
        throw new Error('Vault-Payload ist kein gültiges JSON.')
    }
    if (!isRecord(parsed)) throw new Error('Vault-Payload: Objekt erwartet.')
    return {
        pkcs8: assertBase64Field(parsed, 'pkcs8'),
        pubRaw: assertBase64Field(parsed, 'pubRaw'),
    }
}

export function parseVaultContentFields(parsed: Record<string, unknown>): {
    notes: string
    iotaSdkSignerImport?: string
    personalSecrets: unknown
} {
    const fromSdk =
        typeof parsed.iotaSdkSignerImport === 'string' ? parsed.iotaSdkSignerImport.trim() : ''
    const fromMnemonic = typeof parsed.iotaMnemonic === 'string' ? parsed.iotaMnemonic.trim() : ''
    const merged = fromSdk || fromMnemonic || undefined
    return {
        notes: typeof parsed.notes === 'string' ? parsed.notes : '',
        iotaSdkSignerImport: merged,
        personalSecrets: parsed.personalSecrets,
    }
}
