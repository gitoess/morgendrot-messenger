/**
 * Phase-1-Patches für IOTA Messenger (nach Kopie aus Morgendrot).
 * Wird beim Bootstrap und bei manuellem Re-Sync ausgeführt.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = process.argv[2] || path.resolve(__dirname, '..')

function patchFile(rel, patches) {
  const file = path.join(ROOT, rel)
  if (!fs.existsSync(file)) {
    console.warn('skip (fehlt):', rel)
    return false
  }
  let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  let changed = false
  for (const [from, to] of patches) {
    const needle = from.replace(/\r\n/g, '\n')
    const repl = to.replace(/\r\n/g, '\n')
    if (!text.includes(needle)) {
      console.warn('patch miss:', rel, JSON.stringify(needle.slice(0, 60)))
      continue
    }
    text = text.replace(needle, repl)
    changed = true
  }
  if (changed) fs.writeFileSync(file, text, 'utf8')
  return changed
}

function writeIfMissing(rel, content) {
  const file = path.join(ROOT, rel)
  if (fs.existsSync(file)) return false
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
  return true
}

// --- product-identity (SSOT) ---
const overlayDir = fs.existsSync(path.join(ROOT, 'product', 'overlays'))
  ? path.join(ROOT, 'product', 'overlays')
  : path.join(__dirname, '..', 'overlays')
const identitySrc = fs.readFileSync(path.join(overlayDir, 'product-identity.ts'), 'utf8')
fs.mkdirSync(path.join(ROOT, 'frontend', 'frontend', 'lib'), { recursive: true })
fs.writeFileSync(path.join(ROOT, 'frontend', 'frontend', 'lib', 'product-identity.ts'), identitySrc, 'utf8')

// --- dashboard-workspace-tile-visibility ---
patchFile('frontend/frontend/lib/dashboard-workspace-tile-visibility.ts', [
  [
    `import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'`,
    `import { canAccessEinsatzleitung } from '@/frontend/lib/messenger-role-capabilities'\nimport { isIotaMessengerProduct } from '@/frontend/lib/product-identity'`,
  ],
  [
    `): boolean {
  if (id === 'einsatzleitung') {
    return canAccessEinsatzleitung(p.role)
  }`,
    `): boolean {
  if (isIotaMessengerProduct()) {
    return id === 'chat'
  }

  if (id === 'einsatzleitung') {
    return canAccessEinsatzleitung(p.role)
  }`,
  ],
])

// --- settings-view ---
patchFile('frontend/frontend/components/views/settings-view.tsx', [
  [
    `import { useAppTranslation } from '@/frontend/lib/i18n/hooks'`,
    `import { useAppTranslation } from '@/frontend/lib/i18n/hooks'\nimport { IOTA_MESSENGER_UI, isIotaMessengerProduct } from '@/frontend/lib/product-identity'`,
  ],
  [
    `  const categories = [
    { id: 'general' as const, label: 'Allgemein', icon: <Globe className="h-4 w-4" /> },
    { id: 'iota' as const, label: 'IOTA', icon: <Send className="h-4 w-4" /> },
    { id: 'funk' as const, label: 'Funk', icon: <Radio className="h-4 w-4" /> },
    { id: 'telegram' as const, label: 'Telegram', icon: <Send className="h-4 w-4" /> },
    { id: 'security' as const, label: 'Sicherheit', icon: <Shield className="h-4 w-4" /> },
  ]`,
    `  const categories = [
    { id: 'general' as const, label: 'Allgemein', icon: <Globe className="h-4 w-4" /> },
    { id: 'iota' as const, label: 'IOTA', icon: <Send className="h-4 w-4" /> },
    ...(isIotaMessengerProduct()
      ? []
      : [
          { id: 'funk' as const, label: 'Funk', icon: <Radio className="h-4 w-4" /> },
          { id: 'telegram' as const, label: 'Telegram', icon: <Send className="h-4 w-4" /> },
        ]),
    { id: 'security' as const, label: 'Sicherheit', icon: <Shield className="h-4 w-4" /> },
  ]`,
  ],
  [
    `        <ActiveProfilePanel status={advancedIotaStatus} />
        <CapacitorApiBaseCard />
        <div id="settings-handoff-import">
          <LazyHandoffImportPanel
            backendOnline={backendOnline}
            bossEinsatzViewer={slimMessengerEinsatz && isBossRole}
          />
        </div>
        <EinsatzEndPanel apiStatus={advancedIotaStatus} backendOnline={backendOnline} />`,
    `        {!IOTA_MESSENGER_UI.hideActiveProfile ? (
          <ActiveProfilePanel status={advancedIotaStatus} />
        ) : null}
        <CapacitorApiBaseCard />
        {!IOTA_MESSENGER_UI.hideBossHandoff ? (
          <div id="settings-handoff-import">
            <LazyHandoffImportPanel
              backendOnline={backendOnline}
              bossEinsatzViewer={slimMessengerEinsatz && isBossRole}
            />
          </div>
        ) : null}
        {!IOTA_MESSENGER_UI.hideEinsatzleitung ? (
          <EinsatzEndPanel apiStatus={advancedIotaStatus} backendOnline={backendOnline} />
        ) : null}`,
  ],
  [
    `        {backendOnline ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <ChatViewShadowSweep />
          </div>
        ) : null}`,
    `        {backendOnline && !IOTA_MESSENGER_UI.hideShadowSweep ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <ChatViewShadowSweep />
          </div>
        ) : null}`,
  ],
  [
    `      <SettingsCollapsiblePanel open={activeCategory === 'funk'} title="Funk (Meshtastic)" icon={<Radio className="h-5 w-5" />}>`,
    `      {!IOTA_MESSENGER_UI.hideFunk ? (
      <SettingsCollapsiblePanel open={activeCategory === 'funk'} title="Funk (Meshtastic)" icon={<Radio className="h-5 w-5" />}>`,
  ],
  [
    `      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel open={activeCategory === 'telegram'} title="Telegram" icon={<Send className="h-5 w-5" />}>`,
    `      </SettingsCollapsiblePanel>
      ) : null}

      {!IOTA_MESSENGER_UI.hideTelegram ? (
      <SettingsCollapsiblePanel open={activeCategory === 'telegram'} title="Telegram" icon={<Send className="h-5 w-5" />}>`,
  ],
  [
    `      </SettingsCollapsiblePanel>

      <SettingsCollapsiblePanel open={activeCategory === 'security'} title="Sicherheit & Notfall" icon={<Shield className="h-5 w-5" />}>`,
    `        </SettingsCollapsiblePanel>
      ) : null}

      <SettingsCollapsiblePanel open={activeCategory === 'security'} title="Sicherheit & Notfall" icon={<Shield className="h-5 w-5" />}>`,
  ],
])

// --- messenger-dashboard ---
patchFile('frontend/frontend/components/messenger-dashboard.tsx', [
  [
    `import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'`,
    `import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'\nimport { IOTA_MESSENGER_UI, isIotaMessengerProduct, PRODUCT_DISPLAY_NAME } from '@/frontend/lib/product-identity'`,
  ],
  [
    `  const isEinsatzLeadHome = canAccessEinsatzleitung(effectiveRole)`,
    `  const isEinsatzLeadHome =
    !isIotaMessengerProduct() && canAccessEinsatzleitung(effectiveRole)`,
  ],
  [
    `        <StandaloneFirstStartCard apiRole={s.role} />
        <OnboardingResumeCard apiSnapshot={s.apiSnapshot} />
        <StandaloneHandoffActivateCard
          apiRole={s.role}
          onOpenHandoffImport={() => s.openSettingsCategory('general')}
          onActivateWallet={() => {
            setOnboardingWizardOpen(false)
            setVaultOverWizard(false)
            s.requestStandaloneWalletUnlock()
          }}
        />
        <StandaloneSoloWizardCard apiSnapshot={s.apiSnapshot} />
        {!s.locked && !isEinsatzLeadHome && liteMessengerFromApi ? (
          <div className="mb-6 flex justify-center">
            <DashboardSosEmergencyButton onOpenMessages={s.openMessengerChatView} />
          </div>
        ) : null}`,
    `        {!IOTA_MESSENGER_UI.hideBossOnboardingChoices ? (
          <StandaloneFirstStartCard apiRole={s.role} />
        ) : null}
        <OnboardingResumeCard apiSnapshot={s.apiSnapshot} />
        {!IOTA_MESSENGER_UI.hideBossHandoff ? (
          <StandaloneHandoffActivateCard
            apiRole={s.role}
            onOpenHandoffImport={() => s.openSettingsCategory('general')}
            onActivateWallet={() => {
              setOnboardingWizardOpen(false)
              setVaultOverWizard(false)
              s.requestStandaloneWalletUnlock()
            }}
          />
        ) : null}
        <StandaloneSoloWizardCard apiSnapshot={s.apiSnapshot} />
        {!s.locked && !isEinsatzLeadHome && liteMessengerFromApi && !IOTA_MESSENGER_UI.hideSos ? (
          <div className="mb-6 flex justify-center">
            <DashboardSosEmergencyButton onOpenMessages={s.openMessengerChatView} />
          </div>
        ) : null}`,
  ],
  [
    `                <h1 className="text-lg font-bold text-foreground">{t('brand.messenger')}</h1>`,
    `                <h1 className="text-lg font-bold text-foreground">{isIotaMessengerProduct() ? PRODUCT_DISPLAY_NAME : t('brand.messenger')}</h1>`,
  ],
  [
    `              <div className="mt-1">
                <MeshStatus
                  mode={s.meshPathMode}
                  subtitle={
                    s.rpcProxyActive
                      ? t('network.meshProxySubtitle')
                      : t('network.meshDefaultSubtitle')
                  }
                />
              </div>`,
    `              {!IOTA_MESSENGER_UI.hideMeshStatus ? (
              <div className="mt-1">
                <MeshStatus
                  mode={s.meshPathMode}
                  subtitle={
                    s.rpcProxyActive
                      ? t('network.meshProxySubtitle')
                      : t('network.meshDefaultSubtitle')
                  }
                />
              </div>
              ) : null}`,
  ],
])

// --- config.ts: iota-messenger edition ---
patchFile('src/config.ts', [
  [
    `     * Env: MESSENGER_EDITION=standalone | sales
     */
    MESSENGER_EDITION: ((): 'standalone' | 'sales' => {
        const e = (process.env.MESSENGER_EDITION || 'standalone').trim().toLowerCase();
        return e === 'sales' ? 'sales' : 'standalone';
    })(),`,
    `     * Env: MESSENGER_EDITION=standalone | sales | iota-messenger
     */
    MESSENGER_EDITION: ((): 'standalone' | 'sales' | 'iota-messenger' => {
        const e = (process.env.MESSENGER_EDITION || 'standalone').trim().toLowerCase();
        if (e === 'iota-messenger') return 'iota-messenger';
        return e === 'sales' ? 'sales' : 'standalone';
    })(),`,
  ],
  [
    `    UI_VARIANT: (() => {
        const edition = (process.env.MESSENGER_EDITION || 'standalone').trim().toLowerCase();
        if (edition === 'sales') return 'messenger';
        const v = (process.env.UI_VARIANT || 'full').trim().toLowerCase();
        return v === 'messenger' ? 'messenger' : 'full';
    })(),`,
    `    UI_VARIANT: (() => {
        const edition = (process.env.MESSENGER_EDITION || 'standalone').trim().toLowerCase();
        if (edition === 'sales' || edition === 'iota-messenger') return 'messenger';
        const v = (process.env.UI_VARIANT || 'full').trim().toLowerCase();
        return v === 'messenger' ? 'messenger' : 'full';
    })(),`,
  ],
  [
    `        const edition = (process.env.MESSENGER_EDITION || 'standalone').trim().toLowerCase();
        if (edition === 'sales') return 'consumer';
        const v = (process.env.UI_VARIANT || 'full').trim().toLowerCase();
        if (v === 'messenger') return 'consumer';
        return 'einsatz';
    })(),
    /** mesh-first`,
    `        const edition = (process.env.MESSENGER_EDITION || 'standalone').trim().toLowerCase();
        if (edition === 'sales' || edition === 'iota-messenger') return 'consumer';
        const v = (process.env.UI_VARIANT || 'full').trim().toLowerCase();
        if (v === 'messenger') return 'consumer';
        return 'einsatz';
    })(),
    /** mesh-first`,
  ],
])

// --- api status type ---
patchFile('frontend/frontend/lib/api/api-status-types.ts', [
  [
    `  messengerEdition?: 'standalone' | 'sales'`,
    `  messengerEdition?: 'standalone' | 'sales' | 'iota-messenger'`,
  ],
])

console.log('UI patches applied under', ROOT)
