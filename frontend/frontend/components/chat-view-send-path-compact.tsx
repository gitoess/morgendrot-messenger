'use client'

/**
 * Kompakte Sendepfad-Auswahl (online / funk / ad-hoc) — z. B. neben „Wald“ in der Chat-Kopfzeile.
 */

import { cn } from '@/lib/utils'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

export type ChatViewSendPathCompactProps = {
  /** Pinnwand: nur wenn Klartext; privater Chat: immer. */
  visible: boolean
  encrypted: boolean
  forcedTransport: ForcedTransport
  onForcedTransportChange: (t: ForcedTransport) => void
  /** Funk/Ad-hoc sind Klartext-Pfade: bei aktiver Verschlüsselung nach Bestätigung ausschalten. */
  onEncryptedChange?: (encrypted: boolean) => void
}

const ONLINE = {
  id: 'internet' as const,
  icon: '🌍',
  short: 'online',
  title: 'Online',
}

const FUNK = {
  id: 'mesh' as const,
  icon: '📡',
  short: 'funk',
  title: 'Funk',
}

const ADHOC = {
  id: 'adhoc' as const,
  icon: '📱',
  short: 'adhoc',
  title: 'Ad-hoc',
}

function selectCleartextTransport(
  encrypted: boolean,
  target: ForcedTransport,
  onEncryptedChange: ((v: boolean) => void) | undefined,
  onForcedTransportChange: (t: ForcedTransport) => void
) {
  if (target === 'internet') {
    onForcedTransportChange('internet')
    return
  }
  if (target === 'mesh') {
    if (encrypted) {
      const ok = window.confirm(
        '„funk“ = Meshtastic-Klartext (LongFast), nicht Ende-zu-Ende verschlüsselt.\n\nFortfahren? (Verschlüsselung wird ausgeschaltet.)'
      )
      if (!ok) return
    }
    onForcedTransportChange('mesh')
    return
  }
  if (target === 'adhoc') {
    if (encrypted) {
      const ok = window.confirm(
        '„adhoc“ ist für Klartext nahe BLE vorgesehen — nicht verschlüsselt.\n\nVerschlüsselung ausschalten und „adhoc“ wählen?'
      )
      if (!ok) return
      if (!onEncryptedChange) {
        window.alert('Bitte zuerst „Verschlüsselung“ unten auf Klartext stellen, dann „adhoc“ wählen.')
        return
      }
      onEncryptedChange(false)
    }
    onForcedTransportChange('adhoc')
  }
}

export function ChatViewSendPathCompact(p: ChatViewSendPathCompactProps) {
  const { visible, encrypted, forcedTransport, onForcedTransportChange, onEncryptedChange } = p
  if (!visible) return null

  return (
    <div className="flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/25 px-2 py-1">
      <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
        Sendepfad
      </span>
      <span className="hidden h-4 w-px bg-border sm:inline" aria-hidden />
      <button
        type="button"
        title={ONLINE.title}
        onClick={() => onForcedTransportChange(ONLINE.id)}
        className={cn(
          'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
          forcedTransport === ONLINE.id
            ? 'border-emerald-600/50 bg-emerald-500/15 text-foreground'
            : 'border-transparent bg-background/80 text-muted-foreground hover:bg-muted'
        )}
      >
        <span className="mr-0.5" aria-hidden>
          {ONLINE.icon}
        </span>
        {ONLINE.short}
      </button>
      <button
        type="button"
        title={FUNK.title}
        onClick={() => selectCleartextTransport(encrypted, FUNK.id, onEncryptedChange, onForcedTransportChange)}
        className={cn(
          'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
          forcedTransport === FUNK.id
            ? 'border-sky-600/50 bg-sky-500/15 text-foreground'
            : 'border-transparent bg-background/80 text-muted-foreground hover:bg-muted'
        )}
      >
        <span className="mr-0.5" aria-hidden>
          {FUNK.icon}
        </span>
        {FUNK.short}
      </button>
      <span className="hidden h-4 w-px bg-border/80 sm:inline" aria-hidden />
      <button
        type="button"
        title={ADHOC.title}
        onClick={() => selectCleartextTransport(encrypted, ADHOC.id, onEncryptedChange, onForcedTransportChange)}
        className={cn(
          'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
          forcedTransport === ADHOC.id
            ? 'border-amber-600/45 bg-amber-500/12 text-foreground'
            : 'border-transparent bg-background/80 text-muted-foreground hover:bg-muted'
        )}
      >
        <span className="mr-0.5" aria-hidden>
          {ADHOC.icon}
        </span>
        {ADHOC.short}
      </button>
    </div>
  )
}
