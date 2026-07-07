'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings, Copy, Check, KeyRound, Radio, Send, Globe, Shield } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  getStatus,
  fetchStatus,
  revealVaultSignerImport,
  type ApiStatus,
} from '@/frontend/lib/api'
import { LazyHandoffImportPanel } from '@/frontend/components/lazy/messenger-scope-b'
import { EinsatzEndPanel } from '@/frontend/components/einsatz-end-panel'
import { ActiveProfilePanel } from '@/frontend/components/active-profile-panel'
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
import { SettingsHandbookLink } from '@/frontend/components/settings-handbook-link'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

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
  const [copied, setCopied] = useState<string | null>(null)
  const [recoveryPw, setRecoveryPw] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)
  const [recoveryErr, setRecoveryErr] = useState('')
  const [revealedSigner, setRevealedSigner] = useState<string | null>(null)
  const [advancedIotaStatus, setAdvancedIotaStatus] = useState<ApiStatus | null>(null)

  const isBossRole =
    (advancedIotaStatus?.role || status?.role || '').trim().toLowerCase() === 'boss'
  const isKommandant =
    (advancedIotaStatus?.role || status?.role || '').trim().toLowerCase() === 'kommandant'
  const managedNetwork = isBossRole || isKommandant

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

  const handleRevealSignerImport = async () => {
    setRecoveryErr('')
    if (!recoveryPw.trim()) {
      setRecoveryErr('Vault-Passwort eingeben.')
      return
    }
    setRecoveryBusy(true)
    try {
      const res = await revealVaultSignerImport(recoveryPw.trim())
      if (res.ok && res.signerImport) {
        setRevealedSigner(res.signerImport)
        setRecoveryPw('')
      } else {
        setRecoveryErr(res.error || res.message || 'Anzeige fehlgeschlagen.')
      }
    } finally {
      setRecoveryBusy(false)
    }
  }

  const categories = [
    { id: 'general' as const, label: 'Allgemein', icon: <Globe className="h-4 w-4" /> },
    { id: 'iota' as const, label: 'IOTA', icon: <Send className="h-4 w-4" /> },
    { id: 'funk' as const, label: 'Funk', icon: <Radio className="h-4 w-4" /> },
    { id: 'telegram' as const, label: 'Telegram', icon: <Send className="h-4 w-4" /> },
    { id: 'security' as const, label: 'Sicherheit', icon: <Shield className="h-4 w-4" /> },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('views.settings')}</h2>
          </div>
        </div>
        <SettingsHandbookLink label="Handbuch" />
      </div>

      <SettingsCategoryNav active={activeCategory} onSelect={selectCategory} categories={categories} />

      <SettingsCollapsiblePanel open={activeCategory === 'general'} title="Allgemein" icon={<Globe className="h-5 w-5" />}>
        <SettingsLanguageSection />
        <SettingsOnboardingSection apiStatus={advancedIotaStatus} />
        <SettingsAppearanceSection />
        <SettingsExpertModeSection apiStatus={advancedIotaStatus} />
        <ActiveProfilePanel status={advancedIotaStatus} />
        <CapacitorApiBaseCard />
        <div id="settings-handoff-import">
          <LazyHandoffImportPanel
            backendOnline={backendOnline}
            bossEinsatzViewer={slimMessengerEinsatz && isBossRole}
          />
        </div>
        <EinsatzEndPanel apiStatus={advancedIotaStatus} backendOnline={backendOnline} />
        {canToggleFullTiles && onShowAllTilesChange ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <h4 className="font-semibold text-foreground">Volle Oberfläche</h4>
              <Switch checked={showAllTiles} onCheckedChange={onShowAllTilesChange} aria-label="Alle Kacheln anzeigen" />
            </div>
          </div>
        ) : null}
      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel open={activeCategory === 'iota'} title="IOTA (Online / Chain)" icon={<Send className="h-5 w-5" />}>
        {managedNetwork ? (
          <SettingsNetworkProfilesSection
            apiStatus={advancedIotaStatus}
            backendOnline={backendOnline}
            onApplied={() => void loadStatus()}
          />
        ) : null}
        <SettingsSystemIdentitySection
          apiStatus={advancedIotaStatus}
          managedNetwork={managedNetwork}
          vaultLocked={vaultLocked}
          onRequestVaultUnlock={onRequestVaultUnlock}
          onApplied={() => void loadStatus()}
        />
        <SettingsVaultPasswordSection vaultLocked={vaultLocked} />
        <SettingsVaultBackupSection vaultLocked={vaultLocked} onRequestVaultUnlock={onRequestVaultUnlock} />
        <SettingsMyMailboxesSection
          apiStatus={advancedIotaStatus}
          backendOnline={backendOnline}
          onReload={() => void loadStatus()}
          myAddress={
            (advancedIotaStatus?.myAddressFull || advancedIotaStatus?.myAddress || status?.address || '').trim()
          }
        />
        {backendOnline ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <ChatViewShadowSweep />
          </div>
        ) : null}
        {!slimMessengerEinsatz && status?.backendOnline && status.signer === 'sdk' ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-primary" aria-hidden />
              <h4 className="font-semibold text-foreground">Wallet-Recovery (SIGNER=sdk)</h4>
            </div>
            {!status.vaultHasLocal ? (
              <p className="mb-3 text-sm text-muted-foreground">Keine lokale Vault-Datei.</p>
            ) : null}
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">Vault-Passwort</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={recoveryPw}
                  onChange={(e) => setRecoveryPw(e.target.value)}
                  className="mt-1 w-full max-w-md rounded-lg border border-border bg-input px-3 py-2"
                />
              </label>
              {recoveryErr ? <p className="text-sm text-destructive">{recoveryErr}</p> : null}
              <button
                type="button"
                disabled={recoveryBusy || !status.vaultHasLocal}
                onClick={() => void handleRevealSignerImport()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {recoveryBusy ? 'Lade…' : 'Signer-Import anzeigen'}
              </button>
              {revealedSigner ? (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/50 p-3 font-mono text-xs">
                  {revealedSigner}
                </pre>
              ) : null}
              {revealedSigner ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(revealedSigner)
                    setCopied('signerImport')
                    setTimeout(() => setCopied(null), 2000)
                  }}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  {copied === 'signerImport' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Kopieren
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel open={activeCategory === 'funk'} title="Funk (Meshtastic)" icon={<Radio className="h-5 w-5" />}>
        <SettingsFunkSection apiStatus={advancedIotaStatus} />
      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel open={activeCategory === 'telegram'} title="Telegram" icon={<Send className="h-5 w-5" />}>
        {managedNetwork ? (
          <>
            <SettingsTelegramIntegration backendOnline={backendOnline} />
            <SettingsTelegramEinsatzGroup
              backendOnline={backendOnline}
              apiStatus={advancedIotaStatus}
              isBossRole={isBossRole || isKommandant}
            />
            <SettingsTelegramNotifyOnSend />
          </>
        ) : (
          <>
            <SettingsTelegramAlarmGroupJoin backendOnline={backendOnline} />
            <SettingsTelegramIntegration backendOnline={backendOnline} />
            <SettingsTelegramNotifyOnSend />
          </>
        )}
      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel open={activeCategory === 'security'} title="Sicherheit & Notfall" icon={<Shield className="h-5 w-5" />}>
        <SettingsEmergencyPurgeSection />
      </SettingsCollapsiblePanel>

      {onOpenConfig ? (
        <p className="text-xs text-muted-foreground">
          Erweiterte .env:{' '}
          <button type="button" className="text-primary underline" onClick={onOpenConfig}>
            Konfiguration öffnen
          </button>
        </p>
      ) : null}
    </div>
  )
}
