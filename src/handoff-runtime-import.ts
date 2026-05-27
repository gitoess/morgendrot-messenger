/**
 * Handoff: messengerCapabilities in `.morgendrot-runtime-config.json` mergen.
 */
import {
    buildHandoffRuntimeConfigPayload,
    parseMessengerCapabilitiesOverride,
    readCapabilitiesOverrideFromRuntimeRaw,
    type MessengerCapabilitiesOverride,
    type ResolveMessengerCapabilitiesInput,
} from './shared/messenger-capabilities-matrix.js';
import { readRuntimeConfigRaw, writeRuntimeConfigRaw } from './config.js';

export const HANDOFF_RUNTIME_CONFIG_FILENAME = '.morgendrot-runtime-config.json';

export function parseHandoffRuntimeConfigJson(text: string): {
    ok: boolean
    error?: string
    payload?: Record<string, unknown>
} {
    try {
        const parsed = JSON.parse(text) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return { ok: false, error: 'Runtime-JSON muss ein Objekt sein.' }
        }
        return { ok: true, payload: parsed as Record<string, unknown> }
    } catch {
        return { ok: false, error: 'Kein gültiges JSON.' }
    }
}

export function applyHandoffRuntimeConfigJson(
    runtimeJson: string,
    ctx: Omit<ResolveMessengerCapabilitiesInput, 'override'>
): { ok: boolean; error?: string } {
    const parsed = parseHandoffRuntimeConfigJson(runtimeJson)
    if (!parsed.ok || !parsed.payload) return { ok: false, error: parsed.error }

    const override =
        readCapabilitiesOverrideFromRuntimeRaw(parsed.payload) ??
        parseMessengerCapabilitiesOverride(parsed.payload.messengerCapabilities)

    const handoffBlock = parsed.payload.handoff as Record<string, unknown> | undefined
    const roleId =
        typeof handoffBlock?.roleId === 'number'
            ? handoffBlock.roleId
            : typeof parsed.payload.roleId === 'number'
              ? (parsed.payload.roleId as number)
              : ctx.roleId

    const built = buildHandoffRuntimeConfigPayload({
        ...ctx,
        roleId,
        simpleMode:
            typeof handoffBlock?.simpleMode === 'boolean'
                ? handoffBlock.simpleMode
                : ctx.simpleMode,
        override: override ?? undefined,
    })

    const merged = { ...readRuntimeConfigRaw(), ...built }
    const wr = writeRuntimeConfigRaw(merged)
    if (!wr.ok) return { ok: false, error: wr.error }
    return { ok: true }
}
