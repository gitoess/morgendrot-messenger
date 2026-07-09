/**
 * Server: Transport-/Produkt-Gates aus Handoff-Runtime + ROLE_ID.
 * Phase 4 — send-commands & Integrations (Fallback über resolveMessengerCapabilities).
 */
import {
    CFG,
    readRuntimeConfigRaw,
    resolveSimpleMode,
    resolveTransportProfile,
} from './config.js';
import {
    readCapabilitiesOverrideFromRuntimeRaw,
    resolveMessengerCapabilities,
    type MessengerCapabilitiesMatrix,
    type TransportChannel,
} from './shared/messenger-capabilities-matrix.js';
import type { CommandHandlerResult } from './messenger-nest/commands/command-types.js';

export function resolveActiveMessengerCapabilities(): MessengerCapabilitiesMatrix {
    return resolveMessengerCapabilities({
        roleId: CFG.ROLE_ID,
        simpleMode: CFG.SIMPLE_MODE ?? resolveSimpleMode(CFG.ROLE),
        transportProfile: CFG.TRANSPORT_PROFILE ?? resolveTransportProfile(CFG.ROLE),
        hierarchyRole: CFG.ROLE,
        override: readCapabilitiesOverrideFromRuntimeRaw(readRuntimeConfigRaw()),
    });
}

export function canTransportWriteActive(channel: TransportChannel): boolean {
    return resolveActiveMessengerCapabilities().transport[channel].write;
}

export function canTransportReadActive(channel: TransportChannel): boolean {
    return resolveActiveMessengerCapabilities().transport[channel].read;
}

export function transportWriteDeniedMessage(channel: TransportChannel): string {
    const cap = resolveActiveMessengerCapabilities().transport[channel];
    if (cap.read && !cap.write) {
        return `Nur Lese-Berechtigung für ${channel} (Handoff-Rechte).`;
    }
    return `Keine Schreibberechtigung für ${channel} (Handoff-Rechte).`;
}

export function denyTransportWrite(channel: TransportChannel): CommandHandlerResult | null {
    if (canTransportWriteActive(channel)) return null;
    return { ok: false, message: transportWriteDeniedMessage(channel) };
}

export function denyTransportRead(channel: TransportChannel): CommandHandlerResult | null {
    if (canTransportReadActive(channel)) return null;
    return { ok: false, message: `Keine Lese-Berechtigung für ${channel} (Handoff-Rechte).` };
}

const SEND_COMMAND_TRANSPORT: Partial<Record<string, TransportChannel>> = {
    '/send-plain': 'iota',
    '/send-team-broadcast': 'iota',
    '/send': 'iota',
    '/send-encrypted': 'iota',
    '/mesh-build-v2': 'lora',
    '/morg-pkg-export': 'iota',
    '/boss-command': 'iota',
};

const READ_COMMAND_TRANSPORT: Partial<Record<string, TransportChannel>> = {
    '/mesh-decrypt-v2': 'lora',
    '/morg-pkg-import': 'iota',
};

export function denyMessengerSendCommand(cmd: string): CommandHandlerResult | null {
    const channel = SEND_COMMAND_TRANSPORT[cmd];
    if (!channel) return null;
    return denyTransportWrite(channel);
}

export function denyMessengerReadCommand(cmd: string): CommandHandlerResult | null {
    const channel = READ_COMMAND_TRANSPORT[cmd];
    if (!channel) return null;
    return denyTransportRead(channel);
}
