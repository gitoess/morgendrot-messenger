'use client'

import { Radio, ExternalLink } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { MESHTASTIC_OWNERSHIP_HINT } from '@/frontend/lib/meshtastic-transport-ownership'
import { MESHTASTIC_WEB_DEVICE_SETTINGS_URL } from '@/frontend/lib/chat-view-messenger-transport'
import { SettingsHandbookLink } from '@/frontend/components/settings-handbook-link'

type SettingsFunkSectionProps = {
  apiStatus?: ApiStatus | null
  managedNetwork?: boolean
}

/**
 * Funk-Einstellungen: Kurzhinweis + Link (§ H.3o.3 Phase 1).
 * Details → Handbuch. Kein zweites USB/BT-Hook (Port-Kampf). Keine Modem/PSK-UI jetzt.
 */
export function SettingsFunkSection(_p: SettingsFunkSectionProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-[var(--path-mesh)]" aria-hidden />
          <h4 className="font-semibold text-foreground">Funk (Meshtastic / Heltec)</h4>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-foreground">1. Gerät konfigurieren</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{MESHTASTIC_OWNERSHIP_HINT}</p>
          <a
            href={MESHTASTIC_WEB_DEVICE_SETTINGS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Meshtastic einrichten
            <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </a>
        </div>

        <div className="space-y-1.5 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-foreground">2. Im Chat verbinden & senden</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sendepfad <strong className="font-medium text-foreground">Funk</strong> → Funk & Geräte: USB/BT, Nodes,
            Kanalindex, Klartext, Bilder über Funk.
          </p>
        </div>

        <div className="space-y-1.5 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-foreground">3. Mehr Details</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Region, Modem, hop_limit, PSK, Verschlüsselung App vs. Composer-Schloss: Handbuch → Funk.
          </p>
          <SettingsHandbookLink label="Handbuch → Funk" />
        </div>
      </div>
    </div>
  )
}
