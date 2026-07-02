'use client'

import { useMemo } from 'react'
import { Radio } from 'lucide-react'
import { readMessengerGroups } from '@/frontend/lib/messenger-group-store'
import {
  HANDOFF_MESHTASTIC_PSK_BOSS_NOTE,
  HANDOFF_MESHTASTIC_PSK_SHORT,
} from '@/frontend/lib/handoff-lora-psk-copy'

/** Meshtastic: Kanal, PSK, Gruppen-Metadaten — was Morgendrot steuert vs. Meshtastic-App. */
export function EinsatzleitungMeshtasticHintPanel() {
  const groups = useMemo(() => readMessengerGroups(), [])
  const withChannel = groups.filter((g) => g.secondaryChannel?.channelIndex != null)

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 text-sm">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <Radio className="h-4 w-4 text-sky-400" aria-hidden />
        Funk (Meshtastic)
      </h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
        <li>{HANDOFF_MESHTASTIC_PSK_SHORT}</li>
        <li>Kanal-PSK in der Meshtastic-App für alle Geräte identisch setzen (nicht im Handoff-ZIP).</li>
        <li>Node-ID (`!…`) pro Helfer — unter Kontakte / Team-Update an alle verteilen.</li>
        <li>Morgendrot: Kanalindex 0–7, Routing, optional Pfad-4-Archiv auf IOTA.</li>
      </ul>
      {withChannel.length > 0 ? (
        <p className="mt-2 text-xs text-foreground">
          Gruppen mit Funk-Kanal: {withChannel.map((g) => g.name || g.id).join(', ')}
        </p>
      ) : null}
      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">{HANDOFF_MESHTASTIC_PSK_BOSS_NOTE}</p>
    </div>
  )
}
