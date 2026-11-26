'use client'

import type { ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'
import type { ApiStatus } from '@/frontend/lib/api'
import { SettingsInboxPackageContractPanel } from '@/frontend/components/settings-inbox-package-contract-panel'
import { DashboardEinsatzChainPanel } from '@/frontend/components/dashboard-einsatz-konfiguration'
import { canUseMessengerExpertTools, isSimpleUiMode } from '@/frontend/lib/messenger-role-capabilities'
import { useMessengerClientExpertMode } from '@/frontend/hooks/use-messenger-client-expert-mode'

type SettingsExpertModeSectionProps = {
  apiStatus: ApiStatus | null | undefined
  /** Boss/Kommandant: Move-Upgrade im Expertenblock. */
  showMoveUpgrade?: boolean
  onRefreshStatus?: () => void | Promise<void>
  /** Mainnet-Setup (Deploy/IDs) — nur sichtbar wenn Expertenmodus an. */
  mainnetSetup?: ReactNode
}

/**
 * Client-opt-in (Default aus): Mainnet-Setup, Vertrags-Filter, optional Move-Upgrade.
 * Direkt unter „Wo senden?“ (Netz-Tabs).
 */
export function SettingsExpertModeSection({
  apiStatus,
  showMoveUpgrade = false,
  onRefreshStatus,
  mainnetSetup,
}: SettingsExpertModeSectionProps) {
  const { enabled, setExpertMode } = useMessengerClientExpertMode()
  const serverSimple = isSimpleUiMode(apiStatus)
  const iotaExpertEligible = canUseMessengerExpertTools(apiStatus)

  if (serverSimple) {
    return (
      <div id="settings-expert-mode" className="rounded-xl border border-border bg-card p-4">
        <h4 className="font-semibold text-foreground">Expertenmodus</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Für diese Rolle gesperrt (Simple Mode serverseitig).
        </p>
      </div>
    )
  }

  return (
    <div id="settings-expert-mode" className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="font-semibold text-foreground">Expertenmodus</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            {iotaExpertEligible
              ? `Aus = Alltag. An = Mainnet-Setup / Vertrag${showMoveUpgrade ? ' / Move-Upgrade' : ''}.`
              : 'IOTA-Transport derzeit ausgeblendet — Schalter ohne Wirkung.'}
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={!iotaExpertEligible}
          onCheckedChange={setExpertMode}
          aria-label="Expertenmodus aktivieren"
        />
      </div>
      {enabled && iotaExpertEligible ? (
        <div className="mt-4 space-y-4 border-t border-border/60 pt-4">
          {mainnetSetup ? (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold text-foreground">Mainnet-Setup</h5>
              {mainnetSetup}
            </div>
          ) : null}
          <SettingsInboxPackageContractPanel apiStatus={apiStatus} />
          {showMoveUpgrade ? (
            <DashboardEinsatzChainPanel
              compact
              apiStatus={apiStatus ?? null}
              onRefreshStatus={onRefreshStatus}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
