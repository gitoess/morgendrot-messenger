/**
 * Feature-basierte Messenger-Capabilities (Transport/UX) — ergänzt ROLE_ID, ersetzt sie nicht on-chain.
 * Handoff: `.morgendrot-runtime-config.json` → `messengerCapabilities`.
 * Siehe docs/CAPABILITIES-MATRIX-ZIELBILD.md
 */
export const MESSENGER_CAPABILITIES_SCHEMA_VERSION = 1 as const

export type TransportChannel = 'lora' | 'telegram' | 'iota' | 'ble' | 'streams'

export type TransportAccess = {
    read: boolean
    write: boolean
}

export type MessengerSecurityCapabilities = {
    /** Mesh/LoRa: kein Klartext-Senden wenn true. */
    forceEncryptionOnly: boolean
    allowPlaintextFallback: boolean
}

export type MessengerProductCapabilities = {
    canCreateGroup: boolean
    canInviteMembers: boolean
    canExportData: boolean
    /** Einsatz-Rollen-Vorlagen speichern (Boss). */
    canManageEinsatzTemplates: boolean
}

export type MessengerTransportCapabilities = Record<TransportChannel, TransportAccess>

/** Vollständige, aufgelöste Matrix (Handoff + Status-API). */
export type MessengerCapabilitiesMatrix = {
    version: typeof MESSENGER_CAPABILITIES_SCHEMA_VERSION
    roleId: number
    simpleMode: boolean
    product: MessengerProductCapabilities
    transport: MessengerTransportCapabilities
    security: MessengerSecurityCapabilities
}

/** Teil-Override aus Handoff / Boss-UI (deep-merge). */
export type MessengerCapabilitiesOverride = {
    version?: number
    roleId?: number
    simpleMode?: boolean
    product?: Partial<MessengerProductCapabilities>
    transport?: Partial<Record<TransportChannel, Partial<TransportAccess>>>
    security?: Partial<MessengerSecurityCapabilities>
}

export type ResolveMessengerCapabilitiesInput = {
    roleId: number
    simpleMode?: boolean
    transportProfile?: 'mesh-first' | 'iota-anchored' | 'iota-full'
    hierarchyRole?: string
    override?: MessengerCapabilitiesOverride | null
}

function clampRoleId(n: number): number {
    return Math.max(0, Math.min(63, Math.floor(n)))
}

/** BW+L+S — aktiver Sender mit Boss-Gas (typisch Boss/Kommandant/Helfer-Vollprofil). */
const WERKSTATT_LEAD_ROLE_ID = 14

function isWerkstattLeadRole(hierarchyRole?: string): boolean {
    const r = String(hierarchyRole || '').trim().toLowerCase()
    return r === 'boss' || r === 'kommandant'
}

/** Boss/Kommandant ohne ROLE_ID in .env → 0 blockiert fälschlich alle Sendepfade. */
function effectiveRoleIdForCapabilities(roleId: number, hierarchyRole?: string): number {
    const id = clampRoleId(roleId)
    if (isWerkstattLeadRole(hierarchyRole) && id === 0) return WERKSTATT_LEAD_ROLE_ID
    return id
}

function hasRoleBit(roleId: number, bit: number): boolean {
    return (clampRoleId(roleId) & bit) !== 0
}

function allTransportWriteDisabled(transport: MessengerTransportCapabilities): boolean {
    return (Object.keys(transport) as TransportChannel[]).every((ch) => !transport[ch].write)
}

function defaultTransportAccess(roleId: number, channel: TransportChannel, transportProfile?: string): TransportAccess {
    const listen = hasRoleBit(roleId, 4)
    const sendLegacy = hasRoleBit(roleId, 2)
    const iotaUi =
        transportProfile === 'iota-anchored' || transportProfile === 'iota-full'
    if (channel === 'iota') {
        return { read: listen && iotaUi, write: sendLegacy && iotaUi }
    }
    if (channel === 'ble') {
        return { read: listen, write: sendLegacy }
    }
    if (channel === 'streams') {
        return { read: listen, write: sendLegacy }
    }
    return { read: listen, write: sendLegacy }
}

function defaultProductCapabilities(hierarchyRole?: string): MessengerProductCapabilities {
    const r = String(hierarchyRole || '').trim().toLowerCase()
    const teamLead = r === 'boss' || r === 'kommandant'
    return {
        canCreateGroup: false,
        canInviteMembers: teamLead,
        canExportData: r === 'boss',
        canManageEinsatzTemplates: r === 'boss',
    }
}

/**
 * Legacy-Ableitung: ein S-Bit steuert heute Senden überall — das ist die Coupling-Lücke.
 * Neue Handoffs sollen transport.* gezielt überschreiben.
 */
export function defaultCapabilitiesFromRoleId(input: ResolveMessengerCapabilitiesInput): MessengerCapabilitiesMatrix {
    const roleId = clampRoleId(input.roleId)
    const transportProfile = input.transportProfile
    const transport: MessengerTransportCapabilities = {
        lora: defaultTransportAccess(roleId, 'lora', transportProfile),
        telegram: defaultTransportAccess(roleId, 'telegram', transportProfile),
        iota: defaultTransportAccess(roleId, 'iota', transportProfile),
        ble: defaultTransportAccess(roleId, 'ble', transportProfile),
        streams: defaultTransportAccess(roleId, 'streams', transportProfile),
    }
    return {
        version: MESSENGER_CAPABILITIES_SCHEMA_VERSION,
        roleId,
        simpleMode: input.simpleMode === true,
        product: defaultProductCapabilities(input.hierarchyRole),
        transport,
        security: {
            forceEncryptionOnly: false,
            allowPlaintextFallback: true,
        },
    }
}

function mergeTransportAccess(base: TransportAccess, patch?: Partial<TransportAccess>): TransportAccess {
    if (!patch) return base
    return {
        read: patch.read ?? base.read,
        write: patch.write ?? base.write,
    }
}

export function mergeCapabilitiesOverride(
    base: MessengerCapabilitiesMatrix,
    override?: MessengerCapabilitiesOverride | null
): MessengerCapabilitiesMatrix {
    if (!override) return base
    const roleId = override.roleId != null ? clampRoleId(override.roleId) : base.roleId
    const transport = { ...base.transport }
    if (override.transport) {
        for (const ch of Object.keys(override.transport) as TransportChannel[]) {
            const patch = override.transport[ch]
            if (patch) transport[ch] = mergeTransportAccess(transport[ch], patch)
        }
    }
    return {
        version: MESSENGER_CAPABILITIES_SCHEMA_VERSION,
        roleId,
        simpleMode: override.simpleMode ?? base.simpleMode,
        product: { ...base.product, ...override.product },
        transport,
        security: { ...base.security, ...override.security },
    }
}

/** Werkstatt-Boss/Kommandant: mindestens voller Transport wenn Matrix alles sperrt (ROLE_ID 0 / fehlerhafter Handoff). */
function enforceWerkstattLeadTransportMinimum(
    cap: MessengerCapabilitiesMatrix,
    hierarchyRole?: string,
    transportProfile?: string
): MessengerCapabilitiesMatrix {
    if (!isWerkstattLeadRole(hierarchyRole) || !allTransportWriteDisabled(cap.transport)) return cap
    const iotaUi = transportProfile === 'iota-anchored' || transportProfile === 'iota-full'
    const transport = { ...cap.transport }
    for (const ch of Object.keys(transport) as TransportChannel[]) {
        transport[ch] = {
            read: true,
            write: ch === 'iota' ? iotaUi : true,
        }
    }
    return {
        ...cap,
        roleId: effectiveRoleIdForCapabilities(cap.roleId, hierarchyRole),
        transport,
        product: {
            ...cap.product,
            canInviteMembers: true,
            canExportData: hierarchyRole?.trim().toLowerCase() === 'boss' ? true : cap.product.canExportData,
            canManageEinsatzTemplates:
                hierarchyRole?.trim().toLowerCase() === 'boss' ? true : cap.product.canManageEinsatzTemplates,
        },
    }
}

export function resolveMessengerCapabilities(input: ResolveMessengerCapabilitiesInput): MessengerCapabilitiesMatrix {
    const roleId = effectiveRoleIdForCapabilities(input.roleId, input.hierarchyRole)
    const base = defaultCapabilitiesFromRoleId({ ...input, roleId })
    const merged = mergeCapabilitiesOverride(base, input.override)
    return enforceWerkstattLeadTransportMinimum(merged, input.hierarchyRole, input.transportProfile)
}

/** Handoff-Datei-Inhalt für `.morgendrot-runtime-config.json` (öffentlich, keine Secrets). */
export function buildHandoffRuntimeConfigPayload(input: ResolveMessengerCapabilitiesInput): Record<string, unknown> {
    const capabilities = resolveMessengerCapabilities(input)
    return {
        messengerCapabilities: capabilities,
        handoff: {
            schemaVersion: MESSENGER_CAPABILITIES_SCHEMA_VERSION,
            roleId: capabilities.roleId,
            simpleMode: capabilities.simpleMode,
            generatedAt: new Date().toISOString(),
        },
    }
}

export function parseMessengerCapabilitiesOverride(raw: unknown): MessengerCapabilitiesOverride | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
    return raw as MessengerCapabilitiesOverride
}

/** Runtime-Datei: `messengerCapabilities` oder verschachtelt unter `capabilities`. */
export function readCapabilitiesOverrideFromRuntimeRaw(
    runtimeRaw: Record<string, unknown>
): MessengerCapabilitiesOverride | null {
    const direct = runtimeRaw.messengerCapabilities
    if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
        const m = direct as MessengerCapabilitiesMatrix & MessengerCapabilitiesOverride
        return {
            roleId: m.roleId,
            simpleMode: m.simpleMode,
            product: m.product,
            transport: m.transport,
            security: m.security,
        }
    }
    const nested = runtimeRaw.capabilities
    return parseMessengerCapabilitiesOverride(nested)
}
