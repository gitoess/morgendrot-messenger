import fs from 'fs'

const path = 'frontend/components/projekt-dashboard.tsx'
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/)
const tail = lines.slice(833).join('\n')
const imports = fs.readFileSync(
  'frontend/components/projekt-dashboard-imports.ts',
  'utf8',
)
const head = fs.readFileSync('scripts/refactor-projekt-dashboard-head.txt', 'utf8')

let body = tail.replace(
  /\{sharedDialogs\}/,
  `<DashboardSharedDialogs locked={s.locked} helpOpen={s.helpOpen} onHelpOpenChange={s.setHelpOpen} helpLoading={s.helpLoading} helpText={s.helpText} unlock={{ ...s.unlock, apiSnapshot: s.apiSnapshot }} />`,
)

body = body.replace(
  /features\.find\(\(f\) => f\.id === s\.activeView\.type\)\?\.title/g,
  'featureTitle(s.activeView.type, projektFeatures)',
)

const ids = [
  'activeView',
  'handleBack',
  'openConfigView',
  'openSettingsView',
  'openEinsatzleitungView',
  'openMessengerChatView',
  'openHelp',
  'checkStatus',
  'initialProfileBanner',
  'setInitialProfileBanner',
  'showAllTiles',
  'setShowAllTilesPersist',
  'chatVaultBannerActions',
  'pendingHandshakes',
  'contactDirectory',
  'refreshContactDirectory',
  'phonebookNavRequest',
  'einsatzKontakteScrollRequest',
  'showMessengerBottomNav',
  'messengerBottomNavActive',
  'setMessengerNavHighlight',
  'setPhonebookNavRequest',
  'setEinsatzKontakteScrollRequest',
  'offlineStatus',
  'hasValidMyAddressForBalance',
  'dashboardTransferAddressSuggestions',
  'firstStepsVisible',
  'dismissFirstStepsBar',
  'pendingHandshakeCount',
  'handleSelectFeature',
  'meshPathMode',
  'rpcProxyActive',
  'networkInfo',
  'backendReachable',
  'connected',
  'locked',
  'apiSnapshot',
  'myAddress',
  'role',
]

for (const id of ids.sort((a, b) => b.length - a.length)) {
  const re = new RegExp(`\\b${id}\\b`, 'g')
  body = body.replace(re, `s.${id}`)
}

body = body.replace(/s\.s\./g, 's.')
body = body.replace(/\bfeatures\.map/g, 'projektFeatures.map')
body = body.replace(/\bvisibleFeatures\b/g, 'visibleFeatures')
body = body.replace(/canAccessEinsatzleitung\(s\.role\)/g, 'canAccessEinsatzleitung(s.role)')

fs.writeFileSync(path, `${imports}\n\n${head}\n${body}`)
console.log('wrote', path, 'lines', fs.readFileSync(path, 'utf8').split(/\r?\n/).length)
