/**
 * M4d (ohne Move): eigene private Mailbox-Object-ID manuell nach Deploy eintragen + für Profil-QR.
 */

const LS_MY_PRIVATE_MB = 'morgendrot.myPrivateMailboxObjectId.v1'

export function readMyPrivateMailboxObjectId(): string {
  if (typeof window === 'undefined') return ''
  return (window.localStorage.getItem(LS_MY_PRIVATE_MB) ?? '').trim()
}

export function writeMyPrivateMailboxObjectId(id: string): void {
  if (typeof window === 'undefined') return
  const t = id.trim()
  if (!t) window.localStorage.removeItem(LS_MY_PRIVATE_MB)
  else window.localStorage.setItem(LS_MY_PRIVATE_MB, t)
}
