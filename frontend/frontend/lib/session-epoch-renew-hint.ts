import { getSendKeyEpochForRecipient } from '@/frontend/lib/direct-session-keys-archive'

const SS_HINT_PREFIX = 'morg.sessionEpoch.renewHintShown.'

/**
 * Sanfter Hinweis nach verschlüsseltem 1:1-Send, wenn Session noch auf Epoch 1
 * (noch nie bewusst rotiert). Pro Peer höchstens einmal pro Browser-Tab-Session.
 */
export function takeEncryptedSendKeyEpochRenewHint(peerAddr: string): string | null {
  const addr = peerAddr.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(addr)) return null
  const epoch = getSendKeyEpochForRecipient(addr)
  if (epoch > 1) return null
  if (typeof window !== 'undefined') {
    try {
      const k = SS_HINT_PREFIX + addr
      if (window.sessionStorage.getItem(k) === '1') return null
      window.sessionStorage.setItem(k, '1')
    } catch {
      /* ignore */
    }
  }
  return (
    ` · Tipp: ⋮ → Schlüssel erneuern (aktuell Epoch ${epoch || 1}; ` +
    'Forward Secrecy gilt ab Rotation, nicht pro Nachricht).'
  )
}
