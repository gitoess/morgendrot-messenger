'use client'

import { API_BASE } from '@/frontend/lib/api/api-base'

/** Server-MAILBOX_ID (Morgendrot/Einsatz-Shared) — Status, sonst /api/current-ids. */
export async function fetchDeploymentMailboxId(): Promise<string> {
  const valid = (id: unknown) =>
    typeof id === 'string' && /^0x[a-fA-F0-9]{64}$/i.test(id.trim()) ? id.trim() : ''

  try {
    const st = await fetch(`${API_BASE}/api/status`, { cache: 'no-store' })
    if (st.ok) {
      const j = (await st.json()) as { mailboxId?: string }
      const id = valid(j.mailboxId)
      if (id) return id
    }
  } catch {
    /* fallback */
  }
  try {
    const cr = await fetch(`${API_BASE}/api/current-ids`, { cache: 'no-store' })
    if (cr.ok) {
      const j = (await cr.json()) as { ok?: boolean; mailboxId?: string }
      if (j.ok !== false) return valid(j.mailboxId)
    }
  } catch {
    /* ignore */
  }
  return ''
}
