import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { canAccessEinsatzleitung, isSimpleUiMode } from '@/frontend/lib/messenger-role-capabilities'
import type { ApiStatus } from '@/frontend/lib/api/status'

/** Helfer/Simple: keine 0x-Adressen — nur „Einsatzleitung“. */
export function shouldMaskPinnwandSender(
  role: string | null | undefined,
  status: ApiStatus | null | undefined
): boolean {
  if (isSimpleUiMode(status)) return true
  const r = (role ?? '').trim().toLowerCase()
  return r === 'arbeiter' || r === 'lock' || r === 'messenger'
}

export function pinnwandSenderDisplayLabel(
  role: string | null | undefined,
  status: ApiStatus | null | undefined,
  fromAddress: string,
  contactDirectory?: Record<string, ContactMeshEntryClient>
): string {
  const from = fromAddress.trim()
  if (!from) return 'Einsatzleitung'
  if (shouldMaskPinnwandSender(role, status)) {
    return canAccessEinsatzleitung(role) ? contactDisplayLabel(contactDirectory ?? {}, from) || 'Einsatzleitung' : 'Einsatzleitung'
  }
  return contactDisplayLabel(contactDirectory ?? {}, from) || `${from.slice(0, 10)}…${from.slice(-4)}`
}

export function formatPinnwandMessageTime(timestamp: number): string {
  const t = Number(timestamp)
  if (!Number.isFinite(t) || t <= 0) return ''
  const d = new Date(t)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function pinnwandChannelTabLabel(
  role: string | null | undefined,
  status: ApiStatus | null | undefined
): string {
  return pinnwandSidebarLabel(role, status)
}

/** Sidebar-Zeile: Helfer/Simple „Lagebild“, Führung „Pinnwand“. */
export function pinnwandSidebarLabel(
  role: string | null | undefined,
  status: ApiStatus | null | undefined
): string {
  if (shouldMaskPinnwandSender(role, status) || isSimpleUiMode(status)) return 'Lagebild'
  return 'Pinnwand'
}
