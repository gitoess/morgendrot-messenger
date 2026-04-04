/**
 * Mesh Emergency Binary v2: ein Wire ≤240 B → Klartext vor AES-GCM max. 175 UTF-8 Byte
 * (inner = 12 IV + (UTF-8 + 16 Tag)).
 * Längere Texte (z. B. MORG_LUMA/CHROMA-Wires) werden in mehrere PRIVATE_APP-Pakete gesplittet.
 * Empfänger: siehe `frontend/frontend/lib/mesh-v2-fragment.ts` (Reassembly).
 */
import { randomBytes } from 'node:crypto';

/** Muss mit `frontend/frontend/lib/mesh-v2-fragment.ts` übereinstimmen. */
export const MESH_V2_MAX_PLAINTEXT_UTF8 = 175;

const HEADER_TEMPLATE = (mid: string, i: number, t: number) =>
    `[[MF1:mid=${mid}:i=${i.toString().padStart(6, '0')}:t=${t.toString().padStart(6, '0')}:]]`;

function headerLen(): number {
    return HEADER_TEMPLATE('abcdef12', 0, 1).length;
}

const HEADER_UTF8_LEN = headerLen();
const MAX_PAYLOAD_UTF8 = MESH_V2_MAX_PLAINTEXT_UTF8 - HEADER_UTF8_LEN;

/** Splittet UTF-8 an Zeichengrenzen in Stücke ≤ maxBytes. */
export function splitUtf8ByMaxBytes(s: string, maxBytes: number): string[] {
    if (maxBytes < 1) throw new Error('maxBytes muss ≥ 1 sein');
    const u8 = new TextEncoder().encode(s);
    if (u8.length <= maxBytes) return [s];
    const out: string[] = [];
    let off = 0;
    while (off < u8.length) {
        let end = Math.min(off + maxBytes, u8.length);
        while (end > off && (u8[end]! & 0xc0) === 0x80) end--;
        if (end === off) {
            end = off + 1;
        }
        out.push(new TextDecoder('utf-8', { fatal: false }).decode(u8.subarray(off, end)));
        off = end;
    }
    return out;
}

/**
 * Zerlegt Klartext in ein oder mehrere Fragmente (jeweils ≤175 UTF-8 Byte nach Header).
 */
export function splitMeshPlaintextForV2(message: string): string[] {
    const n0 = new TextEncoder().encode(message).length;
    if (n0 <= MESH_V2_MAX_PLAINTEXT_UTF8) {
        return [message];
    }
    const mid = randomBytes(4).toString('hex');
    const payloads = splitUtf8ByMaxBytes(message, MAX_PAYLOAD_UTF8);
    const total = payloads.length;
    const frags: string[] = [];
    for (let i = 0; i < total; i++) {
        frags.push(HEADER_TEMPLATE(mid, i, total) + payloads[i]);
    }
    for (const f of frags) {
        if (new TextEncoder().encode(f).length > MESH_V2_MAX_PLAINTEXT_UTF8) {
            throw new Error(
                `Mesh-v2-Fragment zu groß (${new TextEncoder().encode(f).length} B, max ${MESH_V2_MAX_PLAINTEXT_UTF8}) – Header/Payload-Logik prüfen.`
            );
        }
    }
    return frags;
}
