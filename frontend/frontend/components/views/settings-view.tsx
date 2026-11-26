'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Radio, Send, Globe, Shield, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { Switch } from '@/components/ui/switch'
import { getStatus, fetchStatus, type ApiStatus } from '@/frontend/lib/api'
import { LazyHandoffImportPanel } from '@/frontend/components/lazy/messenger-scope-b'
import { SettingsTelegramIntegration } from '@/frontend/components/views/settings-telegram-integration'
import { SettingsTelegramEinsatzGroup } from '@/frontend/components/views/settings-telegram-einsatz-group'
import { SettingsTelegramAlarmGroupJoin } from '@/frontend/components/views/settings-telegram-alarm-group-join'
import { SettingsTelegramNotifyOnSend } from '@/frontend/components/views/settings-telegram-notify-on-send'
import { SettingsSystemIdentitySection } from '@/frontend/components/views/settings-system-identity-section'
import { SettingsNetworkProfilesSection } from '@/frontend/components/settings-network-profiles-section'
import { SettingsMyMailboxesSection } from '@/frontend/components/views/settings-my-mailboxes-section'
import { SettingsVaultBackupSection } from '@/frontend/components/views/settings-vault-backup-section'
import { SettingsVaultPasswordSection } from '@/frontend/components/views/settings-vault-password-section'
import { SettingsEmergencyPurgeSection } from '@/frontend/components/views/settings-emergency-purge-section'
import { SettingsTresorHubSection } from '@/frontend/components/views/settings-tresor-hub-section'
import { SettingsFunkSection } from '@/frontend/components/views/settings-funk-section'
import { ChatViewShadowSweep } from '@/frontend/components/chat-view-shadow-sweep'
import { SettingsOnboardingSection } from '@/frontend/components/views/settings-onboarding-section'
import { SettingsLanguageSection } from '@/frontend/components/settings-language-section'
import { SettingsAppearanceSection } from '@/frontend/components/settings-appearance-section'
import { SettingsExpertModeSection } from '@/frontend/components/settings-expert-mode-section'
import { CapacitorApiBaseCard } from '@/frontend/components/capacitor-api-base-card'
import {
  SettingsCategoryNav,
  SettingsCollapsiblePanel,
} from '@/frontend/components/settings-collapsible-section'
import { SETTINGS_ACTIVE_CATEGORY_KEY, type SettingsCategoryId } from '@/frontend/lib/settings-navigation'
import { SettingsProjectDisclaimerSection } from '@/frontend/components/views/settings-project-disclaimer-section'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/standalone-device-mode'
import { isStandaloneSoloPath } from '@/frontend/lib/standalone-onboarding'
import { IOTA_MESSENGER_UI } from '@/frontend/lib/product-identity'

interface SettingsViewProps {
  onOpenConfig?: () => void
  showAllTiles?: boolean
  onShowAllTilesChange?: (value: boolean) => void
  canToggleFullTiles?: boolean
  slimMessengerEinsatz?: boolean
  vaultLocked?: boolean
  onRequestVaultUnlock?: () => void
}

const LS_ACTIVE_CATEGORY = SETTINGS_ACTIVE_CATEGORY_KEY

export function SettingsView({
  onOpenConfig,
  showAllTiles = false,
  onShowAllTilesChange,
  canToggleFullTiles = false,
  slimMessengerEinsatz = false,
  vaultLocked = false,
  onRequestVaultUnlock,
}: SettingsViewProps) {
  const { t } = useAppTranslation('dashboard')
  const [activeCategory, setActiveCategory] = useState<SettingsCategoryId | null>(() => {
    if (typeof window === 'undefined') return 'general'
    const saved = sessionStorage.getItem(LS_ACTIVE_CATEGORY) as SettingsCategoryId | null
    return saved || 'general'
  })
  const [status, setStatus] = useState<{
    network: string
    address: string
    packageId: string
    backendOnline: boolean
    chatConnected: boolean
    signer?: string
    vaultHasLocal?: boolean
    role?: string
  } | null>(null)
  const [advancedIotaStatus, setAdvancedIotaStatus] = useState<ApiStatus | null>(null)

  const isBossRole =
    (advancedIotaStatus?.role || status?.role || '').trim().toLowerCase() === 'boss'
  const isKommandant =
    (advancedIotaStatus?.role || status?.role || '').trim().toLowerCase() === 'kommandant'
  /**
   * „Wo senden?“ + Gas-Panels: bisher nur Boss/Kommandant.
   * Solo/Standalone (Rolle messenger) braucht dasselbe für Testnet-Faucet + Netz-Wahl —
   * sonst fehlt genau der IOTA-Messenger-Pfad in den Einstellungen.
   */
  const managedNetwork =
    isBossRole ||
    isKommandant ||
    isStandaloneSoloPath() ||
    isStandaloneMessengerWithoutBasis()

  const backendOnline =
    status?.backendOnline === true ||
    advancedIotaStatus?.backendRunning === true ||
    advancedIotaStatus?.backendOnline === true

  const loadStatus = async () => {
    const res = await getStatus()
    if (res.ok && res.data) setStatus(res.data)
    const adv = await fetchStatus()
    if ('pollClockHint' in adv) setAdvancedIotaStatus(adv)
    else setAdvancedIotaStatus(null)
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  const selectCategory = useCallback((id: SettingsCategoryId) => {
    setActiveCategory((prev) => {
      const next = prev === id ? null : id
      try {
        if (next) sessionStorage.setItem(LS_ACTIVE_CATEGORY, next)
        else sessionStorage.removeItem(LS_ACTIVE_CATEGORY)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const categories = [
    { id: 'general' as const, label: 'Allgemein', icon: <Globe className="h-4 w-4" /> },
    { id: 'iota' as const, label: 'IOTA', icon: <Send className="h-4 w-4" /> },
    { id: 'funk' as const, label: 'Funk', icon: <Radio className="h-4 w-4" /> },
    { id: 'telegram' as const, label: 'Telegram', icon: <Send className="h-4 w-4" /> },
    { id: 'security' as const, label: 'Tresor', icon: <Shield className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('views.settings')}</h2>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-6">
      <SettingsCategoryNav active={activeCategory} onSelect={selectCategory} categories={categories} />
      <div className="min-w-0 space-y-4">

      <SettingsCollapsiblePanel open={activeCategory === 'general'} title="Allgemein" icon={<Globe className="h-5 w-5" />} onRefresh={() => void loadStatus()}>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h4 className="font-semibold text-foreground">Handbuch</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Anleitung zu Chat, Tresor und Einstellungen — nicht am Sendepfad.
              </p>
            </div>
            <Link
              href="/handbook?file=MESSENGER-CHAT-HANDBUCH.md"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
              Öffnen
            </Link>
          </div>
        </div>
        <SettingsLanguageSection />
        <SettingsOnboardingSection apiStatus={advancedIotaStatus} />
        <SettingsAppearanceSection />
        <CapacitorApiBaseCard />
        {!IOTA_MESSENGER_UI.hideHandoffImport ? (
          <div id="settings-handoff-import">
            <LazyHandoffImportPanel
              backendOnline={backendOnline}
              bossEinsatzViewer={slimMessengerEinsatz && isBossRole}
            />
          </div>
        ) : null}
        <SettingsProjectDisclaimerSection />
        {canToggleFullTiles && onShowAllTilesChange ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <h4 className="font-semibold text-foreground">Volle Oberfläche</h4>
              <Switch checked={showAllTiles} onCheckedChange={onShowAllTilesChange} aria-label="Alle Kacheln anzeigen" />
            </div>
          </div>
        ) : null}
      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel open={activeCategory === 'iota'} title="IOTA (Online / Chain)" icon={<Send className="h-5 w-5" />} onRefresh={() => void loadStatus()}>
        {managedNetwork ? (
          <SettingsNetworkProfilesSection
            apiStatus={advancedIotaStatus}
            backendOnline={backendOnline}
            onApplied={() => void loadStatus()}
            vaultLocked={vaultLocked}
            onRequestVaultUnlock={onRequestVaultUnlock}
            showMoveUpgrade={isBossRole || isKommandant}
          />
        ) : (
          <>
            <SettingsSystemIdentitySection
              apiStatus={advancedIotaStatus}
              managedNetwork={false}
              vaultLocked={vaultLocked}
              onRequestVaultUnlock={onRequestVaultUnlock}
              onApplied={() => void loadStatus()}
            />
            <SettingsExpertModeSection
              apiStatus={advancedIotaStatus}
              showMoveUpgrade={false}
              onRefreshStatus={() => void loadStatus()}
            />
          </>
        )}
        <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
          <span className="font-medium text-foreground">Seed, Notizen, Passwörter, Backup</span> → Tab{' '}
          <button
            type="button"
            className="font-semibold text-primary underline hover:no-underline"
            onClick={() => selectCategory('security')}
          >
            Tresor
          </button>
          .
        </p>
        <SettingsMyMailboxesSection
          apiStatus={advancedIotaStatus}
          backendOnline={backendOnline}
          onReload={() => void loadStatus()}
          myAddress={
            (advancedIotaStatus?.myAddressFull || advancedIotaStatus?.myAddress || status?.address || '').trim()
          }
        />
      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel open={activeCategory === 'funk'} title="Funk (Meshtastic)" icon={<Radio className="h-5 w-5" />} onRefresh={() => void loadStatus()}>
        <SettingsFunkSection apiStatus={advancedIotaStatus} />
      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel open={activeCategory === 'telegram'} title="Telegram" icon={<Send className="h-5 w-5" />} onRefresh={() => void loadStatus()}>
        <p className="text-[11px] text-muted-foreground">
          {IOTA_MESSENGER_UI.hideTelegramEinsatzAlarm
            ? 'Bot, Eingang, Klingel: Handbuch → Telegram.'
            : 'Bot, Klingel, Alarmgruppe: Handbuch → Telegram.'}
        </p>
        <div className="space-y-4">
          {/* 1 Chat-Bot → 2 Klingel → 3 Alarmgruppe (zusammen) */}
          <SettingsTelegramIntegration
            backendOnline={backendOnline}
            showMonitorControls={!IOTA_MESSENGER_UI.hideTelegramMonitor}
          />
          <SettingsTelegramNotifyOnSend />
          {!IOTA_MESSENGER_UI.hideTelegramEinsatzAlarm ? (
            managedNetwork ? (
              <SettingsTelegramEinsatzGroup
                backendOnline={backendOnline}
                apiStatus={advancedIotaStatus}
                isBossRole={isBossRole || isKommandant}
              />
            ) : (
              <SettingsTelegramAlarmGroupJoin backendOnline={backendOnline} />
            )
          ) : null}
        </div>
      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel
        open={activeCategory === 'security'}
        title="Tresor & Notfall"
        icon={<Shield className="h-5 w-5" />}
        onRefresh={() => void loadStatus()}
      >
        <SettingsTresorHubSection
          vaultLocked={vaultLocked}
          onRequestVaultUnlock={onRequestVaultUnlock}
          vaultHasLocal={status?.vaultHasLocal === true}
          backendOnline={backendOnline}
          onAfterReveal={() => void loadStatus()}
        />
        <SettingsVaultPasswordSection vaultLocked={vaultLocked} />
        <SettingsVaultBackupSection vaultLocked={vaultLocked} onRequestVaultUnlock={onRequestVaultUnlock} />
        {backendOnline ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <ChatViewShadowSweep
              sessionAddress={(
                advancedIotaStatus?.myAddressFull ||
                advancedIotaStatus?.myAddress ||
                status?.address ||
                ''
              ).trim()}
            />
          </div>
        ) : null}
        <SettingsEmergencyPurgeSection />
      </SettingsCollapsiblePanel>

      {onOpenConfig ? (
        <p className="text-xs text-muted-foreground">
          Erweiterte .env (einmal, ganz unten — nicht in Allgemein):{' '}
          <button type="button" className="text-primary underline" onClick={onOpenConfig}>
            Konfiguration öffnen
          </button>
        </p>
      ) : null}
      </div>
      </div>
    </div>
  )
}
