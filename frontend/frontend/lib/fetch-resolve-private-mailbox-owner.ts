'use client'

import { fetchApiText } from '@/frontend/lib/api-fetch-text'
import { API_BASE } from '@/frontend/lib/api/api-base'

export async function fetchResolvePrivateMailboxOwner(
  mailboxObjectId: string
): Promise<{ ok: true; owner: string } | { ok: false; error: string }> {
  const id = mailboxObjectId.trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(id)) {
    return { ok: false, error: 'Mailbox-Object-ID: 0x + 64 Hex.' }
  }
  const q = new URLSearchParams({ mailboxObjectId: id })
  const fr = await fetchApiText(API_BASE, `/api/resolve-private-mailbox-owner?${q}`, { method: 'GET' })
  if (!fr.ok) return { ok: false, error: fr.error }
  try {
    const j = JSON.parse(fr.text) as { ok?: boolean; owner?: string; error?: string }
    if (j.ok === true && typeof j.owner === 'string' && /^0x[a-fA-F0-9]{64}$/i.test(j.owner.trim())) {
      return { ok: true, owner: j.owner.trim().toLowerCase() }
    }
    return { ok: false, error: j.error || 'Owner konnte nicht aufgelöst werden.' }
  } catch {
    return { ok: false, error: 'Ungültige API-Antwort.' }
  }
}
