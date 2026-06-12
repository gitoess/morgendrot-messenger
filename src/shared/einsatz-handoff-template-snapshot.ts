/**
 * Phase 4 — voller Handoff-Export-Snapshot in Einsatz-Vorlagen (Boss-PC, keine Secrets).
 */
import {
    parseMessengerCapabilitiesOverride,
    type MessengerCapabilitiesOverride,
} from './messenger-capabilities-matrix'

export const EINSATZ_HANDOFF_TEMPLATE_SNAPSHOT_VERSION = 1 as const

export type HandoffTemplatePresetId = 'helfer' | 'fuehrer' | 'spezial'

export type HandoffTemplateHelperRole = 'messenger' | 'arbeiter' | 'kommandant'

export type EinsatzHandoffTemplateSnapshot = {
    schemaVersion: typeof EINSATZ_HANDOFF_TEMPLATE_SNAPSHOT_VERSION
    presetId: HandoffTemplatePresetId
    /** Standard-Bezeichnung ohne Tagesdatum (Boss ergänzt beim Export). */
    bezeichnungHint?: string
    tuning?: {
        roleId?: number
        helperRole?: HandoffTemplateHelperRole
        simpleMode?: boolean
        omitTeamMailboxes?: boolean
    }
    capabilitiesOverride?: MessengerCapabilitiesOverride | null
    export?: {
        teamMailboxIds?: string[]
        partnerAddresses?: string[]
        includeIotaArchivReadme?: boolean
        handoffRpc?: string
        packageSource?: 'boss' | 'custom'
        customPackageId?: string
        bossAddress?: string
        mailboxId?: string
        commandRegistryId?: string
        vaultRegistryId?: string
        directIotaRpcUrl?: string
    }
}

const PRESET_IDS = new Set<HandoffTemplatePresetId>(['helfer', 'fuehrer', 'spezial'])
const HELPER_ROLES = new Set<HandoffTemplateHelperRole>(['messenger', 'arbeiter', 'kommandant'])
const ADDR = /^0x[a-fA-F0-9]{64}$/

function parseStringArray(raw: unknown, max: number, field: string): string[] | { error: string } {
    if (raw === undefined || raw === null) return []
    if (!Array.isArray(raw)) return { error: `${field} muss ein Array sein.` }
    if (raw.length > max) return { error: `${field}: maximal ${max} Einträge.` }
    const out: string[] = []
    for (let i = 0; i < raw.length; i++) {
        const s = String(raw[i] ?? '').trim()
        if (!s) return { error: `${field}[${i}] leer.` }
        out.push(s)
    }
    return out
}

export function parseEinsatzHandoffTemplateSnapshot(
    raw: unknown
): { ok: true; snapshot: EinsatzHandoffTemplateSnapshot } | { ok: false; error: string } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: 'muss ein Objekt sein.' }
    }
    const o = raw as Record<string, unknown>
    const version = o.schemaVersion
    if (version !== EINSATZ_HANDOFF_TEMPLATE_SNAPSHOT_VERSION) {
        return { ok: false, error: `schemaVersion muss ${EINSATZ_HANDOFF_TEMPLATE_SNAPSHOT_VERSION} sein.` }
    }
    const presetId = String(o.presetId ?? '').trim() as HandoffTemplatePresetId
    if (!PRESET_IDS.has(presetId)) {
        return { ok: false, error: 'presetId ungültig (helfer|fuehrer|spezial).' }
    }

    const bezeichnungHint =
        o.bezeichnungHint === undefined || o.bezeichnungHint === null
            ? undefined
            : String(o.bezeichnungHint).trim().slice(0, 120) || undefined

    let tuning: EinsatzHandoffTemplateSnapshot['tuning']
    if (o.tuning != null) {
        if (typeof o.tuning !== 'object' || Array.isArray(o.tuning)) {
            return { ok: false, error: 'tuning muss ein Objekt sein.' }
        }
        const t = o.tuning as Record<string, unknown>
        tuning = {}
        if (t.roleId != null) {
            const rid = parseInt(String(t.roleId), 10)
            if (!Number.isFinite(rid) || rid < 0 || rid > 63) {
                return { ok: false, error: 'tuning.roleId muss 0–63 sein.' }
            }
            tuning.roleId = rid
        }
        if (t.helperRole != null) {
            const hr = String(t.helperRole).trim() as HandoffTemplateHelperRole
            if (!HELPER_ROLES.has(hr)) return { ok: false, error: 'tuning.helperRole ungültig.' }
            tuning.helperRole = hr
        }
        if (t.simpleMode != null && typeof t.simpleMode !== 'boolean') {
            return { ok: false, error: 'tuning.simpleMode muss boolean sein.' }
        }
        if (typeof t.simpleMode === 'boolean') tuning.simpleMode = t.simpleMode
        if (t.omitTeamMailboxes != null && typeof t.omitTeamMailboxes !== 'boolean') {
            return { ok: false, error: 'tuning.omitTeamMailboxes muss boolean sein.' }
        }
        if (typeof t.omitTeamMailboxes === 'boolean') tuning.omitTeamMailboxes = t.omitTeamMailboxes
        if (Object.keys(tuning).length === 0) tuning = undefined
    }

    let capabilitiesOverride: MessengerCapabilitiesOverride | null | undefined
    if (o.capabilitiesOverride !== undefined) {
        if (o.capabilitiesOverride === null) {
            capabilitiesOverride = null
        } else {
            capabilitiesOverride = parseMessengerCapabilitiesOverride(o.capabilitiesOverride)
            if (!capabilitiesOverride) {
                return { ok: false, error: 'capabilitiesOverride ungültig.' }
            }
        }
    }

    let exportBlock: EinsatzHandoffTemplateSnapshot['export']
    if (o.export != null) {
        if (typeof o.export !== 'object' || Array.isArray(o.export)) {
            return { ok: false, error: 'export muss ein Objekt sein.' }
        }
        const e = o.export as Record<string, unknown>
        exportBlock = {}

        const teamRaw = parseStringArray(e.teamMailboxIds, 32, 'export.teamMailboxIds')
        if (!Array.isArray(teamRaw)) return { ok: false, error: teamRaw.error }
        for (const id of teamRaw) {
            if (!ADDR.test(id)) return { ok: false, error: 'export.teamMailboxIds: ungültige 0x-ID.' }
        }
        if (teamRaw.length) exportBlock.teamMailboxIds = teamRaw.map((x) => x.toLowerCase())

        const partnerRaw = parseStringArray(e.partnerAddresses, 64, 'export.partnerAddresses')
        if (!Array.isArray(partnerRaw)) return { ok: false, error: partnerRaw.error }
        for (const id of partnerRaw) {
            if (!ADDR.test(id)) return { ok: false, error: 'export.partnerAddresses: ungültige 0x-ID.' }
        }
        if (partnerRaw.length) exportBlock.partnerAddresses = partnerRaw.map((x) => x.toLowerCase())

        if (e.includeIotaArchivReadme != null) {
            if (typeof e.includeIotaArchivReadme !== 'boolean') {
                return { ok: false, error: 'export.includeIotaArchivReadme muss boolean sein.' }
            }
            exportBlock.includeIotaArchivReadme = e.includeIotaArchivReadme
        }

        const trimField = (key: keyof NonNullable<EinsatzHandoffTemplateSnapshot['export']>, max: number) => {
            const v = e[key as string]
            if (v === undefined || v === null) return
            const s = String(v).trim().slice(0, max)
            if (s) (exportBlock as Record<string, string>)[key as string] = s
        }
        trimField('handoffRpc', 512)
        if (e.packageSource != null) {
            const ps = String(e.packageSource).trim()
            if (ps !== 'boss' && ps !== 'custom') {
                return { ok: false, error: 'export.packageSource muss boss oder custom sein.' }
            }
            exportBlock.packageSource = ps
        }
        trimField('customPackageId', 70)
        if (exportBlock.customPackageId && !ADDR.test(exportBlock.customPackageId)) {
            return { ok: false, error: 'export.customPackageId ungültig.' }
        }
        trimField('bossAddress', 70)
        if (exportBlock.bossAddress && !ADDR.test(exportBlock.bossAddress)) {
            return { ok: false, error: 'export.bossAddress ungültig.' }
        }
        trimField('mailboxId', 70)
        if (exportBlock.mailboxId && !ADDR.test(exportBlock.mailboxId)) {
            return { ok: false, error: 'export.mailboxId ungültig.' }
        }
        trimField('commandRegistryId', 70)
        if (exportBlock.commandRegistryId && !ADDR.test(exportBlock.commandRegistryId)) {
            return { ok: false, error: 'export.commandRegistryId ungültig.' }
        }
        trimField('vaultRegistryId', 70)
        if (exportBlock.vaultRegistryId && !ADDR.test(exportBlock.vaultRegistryId)) {
            return { ok: false, error: 'export.vaultRegistryId ungültig.' }
        }
        trimField('directIotaRpcUrl', 512)

        if (Object.keys(exportBlock).length === 0) exportBlock = undefined
    }

    const snapshot: EinsatzHandoffTemplateSnapshot = {
        schemaVersion: EINSATZ_HANDOFF_TEMPLATE_SNAPSHOT_VERSION,
        presetId,
        ...(bezeichnungHint ? { bezeichnungHint } : {}),
        ...(tuning ? { tuning } : {}),
        ...(capabilitiesOverride !== undefined ? { capabilitiesOverride } : {}),
        ...(exportBlock ? { export: exportBlock } : {}),
    }
    return { ok: true, snapshot }
}
