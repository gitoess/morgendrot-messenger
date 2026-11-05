'use client'

import { useEffect, useState } from 'react'
import {
  readPassphraseProtectEnabled,
  writePassphraseProtectEnabled,
} from '@/frontend/lib/passphrase-message-local-store'

/** Composer: Passphrase-Nachricht ohne Handshake (Ciphertext on-chain, Key teilen). */
export function PassphraseProtectComposerToggle(p: {
  encrypted: boolean
  onEncryptedChange?: (encrypted: boolean) => void
}) {
  const [on, setOn] = useState(false)

  useEffect(() => {
    setOn(readPassphraseProtectEnabled())
  }, [])

  useEffect(() => {
    if (p.encrypted && on) {
      setOn(false)
      writePassphraseProtectEnabled(false)
    }
  }, [p.encrypted, on])

  return (
    <label className="flex flex-wrap items-start gap-2 text-xs text-muted-foreground">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={on}
        onChange={(e) => {
          const next = e.target.checked
          setOn(next)
          writePassphraseProtectEnabled(next)
          if (next && p.encrypted) p.onEncryptedChange?.(false)
        }}
      />
      <span>
        <span className="font-medium text-foreground">Passphrase-Schutz</span>
        {' — '}
        ohne Handshake; nach dem Senden Passphrase kopieren und separat teilen. Braucht Klartext-Transport
        (Ciphertext ist öffentlich). Lokal gemerkte Keys nur auf diesem Gerät.
      </span>
    </label>
  )
}
