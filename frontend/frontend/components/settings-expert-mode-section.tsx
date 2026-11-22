'use client'

import { Switch } from '@/components/ui/switch'
import type { ApiStatus } from '@/frontend/lib/api'
import { SettingsInboxPackageContractPanel } from '@/frontend/components/settings-inbox-package-contract-panel'
import { canUseMessengerExpertTools, isSimpleUiMode } from '@/frontend/lib/messenger-role-capabilities'
import { useMessengerClientExpertMode } from '@/frontend/hooks/use-messenger-client-expert-mode'

type SettingsExpertModeSectionProps = {
  apiStatus: ApiStatus | null | undefined
}

export function SettingsExpertModeSection({ apiStatus }: SettingsExpertModeSectionProps) {
  const { enabled, setExpertMode } = useMessengerClientExpertMode()
  const serverSimple = isSimpleUiMode(apiStatus)
  const iotaExpertEligible = canUseMessengerExpertTools(apiStatus)

  if (!iotaExpertEligible && !serverSimple) return null

  if (serverSimple) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h4 className="font-semibold text-foreground">Expertenmodus</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Für diese Rolle ist der Simple Mode aktiv (serverseitig). Package-ID-/Vertrags-Steuerung ist deshalb
          nicht verfügbar.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h4 className="font-semibold text-foreground">Expertenmodus</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Schaltet die <strong className="font-medium text-foreground">Vertrags-</strong>Steuerung
            (Package-ID) hier frei — temporär nur Posteingang oder dauerhaft auf dem Server. Nur in diesem
            Browser gespeichert.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Nicht verwechseln mit <strong className="font-medium text-foreground">Pakete</strong> (.morg-pkg)
            unter Nachrichten → Optionen.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setExpertMode}
          aria-label="Expertenmodus aktivieren"
        />
      </div>
      {enabled ? <SettingsInboxPackageContractPanel apiStatus={apiStatus} /> : null}
    </div>
  )
}
