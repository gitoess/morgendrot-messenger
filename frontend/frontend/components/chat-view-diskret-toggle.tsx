'use client'

import { useEffect, useState } from 'react'
import { EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DISKRET_SEND_CHANGED_EVENT,
  readDiskretSendEnabled,
  writeDiskretSendEnabled,
} from '@/frontend/lib/diskret-send-pref'
import {
  writePassphraseProtectEnabled,
  writePassphraseZeitkapselModeEnabled,
} from '@/frontend/lib/passphrase-message-local-store'

/**
 * Composer Opt-in „Diskret“ — Empfänger hinter slot_tag in der Haupt-Mailbox.
 * Default aus. Braucht Verschlüsselung/ECDH. Gas-Zahler bleibt sichtbar (Spec §5.1).
 */
export function ChatViewDiskretToggle(p: {
  encrypted: boolean
  onEncryptedChange?: (encrypted: boolean) => void
  className?: string
}) {
  const [on, setOn] = useState(false)

  useEffect(() => {
    const sync = () => setOn(readDiskretSendEnabled())
    sync()
    window.addEventListener(DISKRET_SEND_CHANGED_EVENT, sync)
    return () => window.removeEventListener(DISKRET_SEND_CHANGED_EVENT, sync)
  }, [])

  return (
    <div className={cn('space-y-1.5', p.className)}>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={on}
          data-testid="composer-diskret-toggle"
          onChange={(e) => {
            const next = e.target.checked
            if (next) {
              writePassphraseProtectEnabled(false)
              writePassphraseZeitkapselModeEnabled(false)
              if (!p.encrypted) p.onEncryptedChange?.(true)
            }
            writeDiskretSendEnabled(next)
            setOn(next)
          }}
        />
        <span className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            Diskret senden
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            Opt-in · Senden + Empfang-Lookahead (slot_tag, Epoch±2). Immer Haupt-Mailbox.
            Gas-Zahler bleibt im Explorer sichtbar — Diskret ≠ unsichtbar wer sendet.
          </span>
        </span>
      </label>
    </div>
  )
}
