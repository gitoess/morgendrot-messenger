/**
 * Optional: Mesh-SOS-Empfangsbestätigung (Sender kann darauf warten, siehe `morgendrot.sosWaitMeshAckMs`).
 * Browser-Kopie: `frontend/frontend/lib/morg-sos-ack-wire.ts`.
 */
import { MorgTextWireMarker } from './opcodes';

const CLOSE = ']]' as const;

export type MorgSosAckV1Envelope = { v: 1; d: string; ts: number };

export function buildMorgSosAckV1Wire(digestSha256Hex64: string): string {
    const env: MorgSosAckV1Envelope = { v: 1, d: digestSha256Hex64.toLowerCase(), ts: Date.now() };
    return `${MorgTextWireMarker.SOS_ACK_V1}${JSON.stringify(env)}${CLOSE}`;
}

/** `d` = 64 Zeichen hex (SHA-256 über UTF-8 des SOS-Klartexts inkl. MORG_EMERGENCY_V1-Kopf). */
export function tryParseMorgSosAckV1Plaintext(plaintext: string): string | null {
    const prefix = MorgTextWireMarker.SOS_ACK_V1;
    if (!plaintext.startsWith(prefix)) return null;
    const closeIdx = plaintext.indexOf(CLOSE, prefix.length);
    if (closeIdx < 0) return null;
    const jsonStr = plaintext.slice(prefix.length, closeIdx);
    try {
        const o = JSON.parse(jsonStr) as MorgSosAckV1Envelope;
        if (o?.v !== 1 || typeof o.d !== 'string') return null;
        const d = o.d.toLowerCase().trim();
        if (!/^[a-f0-9]{64}$/.test(d)) return null;
        return d;
    } catch {
        return null;
    }
}

export function plaintextStartsWithMorgSosAckV1(plaintext: string): boolean {
    return plaintext.startsWith(MorgTextWireMarker.SOS_ACK_V1);
}
