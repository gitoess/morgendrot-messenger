'use client'

import type { ApiStatus } from '@/frontend/lib/api'
import { LazyChatViewPulseSettings } from '@/frontend/components/lazy/messenger-scope-b'

type SettingsFunkSectionProps = {
  apiStatus?: ApiStatus | null
  managedNetwork?: boolean
}

/** Funk (Meshtastic): Puls, Heartbeat, Geräte. */
export function SettingsFunkSection({ apiStatus }: SettingsFunkSectionProps) {
  if (!apiStatus) return null
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
