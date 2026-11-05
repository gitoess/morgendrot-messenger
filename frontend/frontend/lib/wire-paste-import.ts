/**
 * Lokaler Wire-Paste: Passphrase-Nachrichten ohne Chain-Scan entschlüsseln.
 * ECDH-Wires brauchen Handshake — hier nur Hinweis, kein Import in die Inbox.
 */

import {
  decryptPassphraseMessageWire,
  isPassphraseMessageWire,
} from '@/frontend/lib/passphrase-message-crypto'
import {
  getDefaultPassphraseMessagePassphrase,
  lookupPassphraseMessagePassphrase,
  rememberPassphraseMessagePassphrase,
} from '@/frontend/lib/passphrase-message-local-store'

export type PastedWireKind = 'passphrase-msg' | 'unknown'

export function classifyPastedWire(raw: string): PastedWireKind {
  const t = raw.trim()
  if (!t) return 'unknown'
  if (isPassphraseMessageWire(t)) return 'passphrase-msg'
  return 'unknown'
}

export function suggestPassphraseForPastedWire(wire: string): string {
  return (
    lookupPassphraseMessagePassphrase(wire) ||
    getDefaultPassphraseMessagePassphrase() ||
    ''
  )
}

export async function decryptPastedPassphraseWire(
  wire: string,
  passphrase: string
): Promise<{ ok: true; plain: string } | { ok: false; error: string }> {
  const t = wire.trim()
  const pass = passphrase.trim()
  if (!isPassphraseMessageWire(t)) {
    return { ok: false, error: 'Kein MORG_PWMSG_V1-Wire. „Wire kopieren“ aus einer Passphrase-Nachricht einfügen.' }
  }
  if (pass.length < 8) {
    return { ok: false, error: 'Passphrase mindestens 8 Zeichen.' }
  }
  try {
    const plain = await decryptPassphraseMessageWire(t, pass)
    rememberPassphraseMessagePassphrase(t, pass)
    return { ok: true, plain }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Entschlüsselung fehlgeschlagen.' }
  }
}
