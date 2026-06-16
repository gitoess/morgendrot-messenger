'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { LazyChatViewPulseSettings } from '@/frontend/components/lazy/messenger-scope-b'

type SettingsFunkSectionProps = {
  apiStatus?: ApiStatus | null
  managedNetwork?: boolean
}

/** Funk (Meshtastic): Puls, Heartbeat, Geräte — getrennt von IOTA-Online-Einstellungen. */
export function SettingsFunkSection({ apiStatus, managedNetwork }: SettingsFunkSectionProps) {
  if (!apiStatus || managedNetwork) return null
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <LazyChatViewPulseSettings
        apiStatus={apiStatus}
        allowDevExpertTools={false}
        settingsEmbedded
        networkManaged={false}
      />
    </div>
  )
}
