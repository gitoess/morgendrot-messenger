/** Parst `/send`-Argumente: Empfänger (0x…) + Nachricht; Legacy nur bei genau einem Peer. */
const ADDR_64 = /^0x[a-fA-F0-9]{64}$/;

export type ResolvedSendRecipientText =
    | { ok: true; recipient: string; text: string }
    | { ok: false; message: string };

export function resolveSendRecipientAndText(
    args: string[],
    peerAddresses: string[]
): ResolvedSendRecipientText {
    const trimmed = (args ?? []).map((s) => String(s ?? '').trim()).filter((s, i, a) => s.length > 0 || i < a.length);
    const first = trimmed[0] ?? '';
    if (ADDR_64.test(first)) {
        const text = trimmed.slice(1).join(' ').trim();
        if (!text) {
            return { ok: false, message: 'Verwendung: /send <0xEmpfänger> <Text> (Nachricht eingeben).' };
        }
        return { ok: true, recipient: first, text };
    }
    const text = trimmed.join(' ').trim();
    if (!text) {
        return { ok: false, message: 'Verwendung: /send <0xEmpfänger> <Text> (Nachricht eingeben).' };
    }
    if (peerAddresses.length === 0) {
        return { ok: false, message: 'Nicht verbunden. Zuerst /connect ausführen.' };
    }
    if (peerAddresses.length === 1) {
        return { ok: true, recipient: peerAddresses[0]!, text };
    }
    return {
        ok: false,
        message:
            'Mehrere Partner verbunden: Empfänger angeben. Beispiel: /send 0x… dein Text',
    };
}
