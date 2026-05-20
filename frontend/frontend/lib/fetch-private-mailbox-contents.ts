'use client'

import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

export type PrivateMailboxContents = {
  handshakeCount: number
  messageCount: number
  handshakes?: unknown[]
  messages?: unknown[]
}

export async function fetchPrivateMailboxContents(
  mailboxObjectId: string,
  owner?: string
): Promise<{ ok: boolean; contents?: PrivateMailboxContents; error?: string }> {
  const id = mailboxObjectId.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(id)) {
    return { ok: false, error: 'Ungültige Mailbox-Object-ID.' }
  }
  const q = new URLSearchParams({ mailboxObjectId: id })
  if (owner?.trim()) q.set('owner', owner.trim())
  try {
    const fr = await fetchApiText(API_BASE, `/api/private-mailbox-contents?${q}`, { method: 'GET' })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Inhalt konnte nicht geladen werden.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    const handshakeCount = typeof b.handshakeCount === 'number' ? b.handshakeCount : 0
    const messageCount = typeof b.messageCount === 'number' ? b.messageCount : 0
    return {
      ok: true,
      contents: {
        handshakeCount,
        messageCount,
        handshakes: Array.isArray(b.handshakes) ? b.handshakes : undefined,
        messages: Array.isArray(b.messages) ? b.messages : undefined,
      },
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
