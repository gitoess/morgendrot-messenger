/**
 * MORG_EMERGENCY_V1: kompakter JSON-Marker in Klartext **vor** Verschlüsselung (Mesh v2 / Mailbox).
 * B1: einfaches, erweiterbares Layout — kein Binär-Freeze; Basis/Logs können `plaintextStartsWithMorgEmergencyV1` nutzen.
 *
 * **Next.js:** identische Präfix-/JSON-Logik im Messenger unter `frontend/frontend/lib/morg-emergency-v1-text.ts` (Turbopack-Pfad).
 */
import { MorgTextWireMarker } from './opcodes';

const CLOSE = ']]' as const;

export type MorgEmergencyV1KindCode = 't' | 'v';

export type MorgEmergencyV1Envelope = { v: 1; k: MorgEmergencyV1KindCode; ts: number };

export function buildMorgEmergencyV1MarkerJson(kind: 'text' | 'voice'): string {
    const env: MorgEmergencyV1Envelope = {
        v: 1,
        k: kind === 'text' ? 't' : 'v',
        ts: Date.now(),
    };
    return `${MorgTextWireMarker.EMERGENCY_V1}${JSON.stringify(env)}${CLOSE}`;
}

/** `body` = Nutzlast (Text, MORG_AUDIO_V1-Wire, …); leer = nur Marker. */
export function prependMorgEmergencyV1Marker(body: string, kind: 'text' | 'voice'): string {
    const head = buildMorgEmergencyV1MarkerJson(kind);
    const b = body ?? '';
    if (!b) return head;
    return `${head}\n${b}`;
}

export function stripLeadingMorgEmergencyV1Marker(plaintext: string): {
    emergency: boolean;
    kind?: 'text' | 'voice';
    body: string;
} {
    const prefix = MorgTextWireMarker.EMERGENCY_V1;
    if (!plaintext.startsWith(prefix)) {
        return { emergency: false, body: plaintext };
    }
    const closeIdx = plaintext.indexOf(CLOSE, prefix.length);
    if (closeIdx < 0) {
        return { emergency: false, body: plaintext };
    }
    const jsonStr = plaintext.slice(prefix.length, closeIdx);
    let kind: 'text' | 'voice' | undefined;
    try {
        const o = JSON.parse(jsonStr) as MorgEmergencyV1Envelope;
        if (o?.v === 1 && o.k === 't') kind = 'text';
        else if (o?.v === 1 && o.k === 'v') kind = 'voice';
    } catch {
        /* ungültige Hülle */
    }
    let rest = plaintext.slice(closeIdx + CLOSE.length);
    if (rest.startsWith('\n')) rest = rest.slice(1);
    return { emergency: true, kind, body: rest };
}

export function plaintextStartsWithMorgEmergencyV1(plaintext: string): boolean {
    return plaintext.startsWith(MorgTextWireMarker.EMERGENCY_V1);
}
