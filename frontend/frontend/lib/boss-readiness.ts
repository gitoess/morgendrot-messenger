'use client'

import type { ApiStatus } from '@/frontend/lib/api/status'
import { buildBossWizardMailboxesContext } from '@/frontend/lib/boss-wizard-mailboxes-context'
import {
  isBossChainStepSatisfied,
  isBossNetworkPlanStepChosen,
  readBossWizardNetworkSetupPlan,
} from '@/frontend/lib/boss-wizard-network-plan'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'
import { buildBossOnboardingRuntime } from '@/frontend/lib/onboarding-boss-runtime'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BossReadinessItemStatus = 'ok' | 'warn' | 'fail'

export type BossReadinessItem = {
  id: string
  label: string
  status: BossReadinessItemStatus
  detail: string
  /** Pflicht für isBossReady — Team/Telegram/Funk nicht. */
  required?: boolean
}

export type BossReadinessReport = {
  /** Alle Pflicht-Checks ok (kein fail). */
  ready: boolean
  /** Wallet + Package + Server-Postfach ohne fail. */
  minimalReady: boolean
  items: BossReadinessItem[]
  summary: string
}

export type BossReadinessInput = {
  api?: ApiStatus | null
  sessionLocked?: boolean
  fallbackMyAddress?: string | null
}

function readinessItem(
  id: string,
  label: string,
  status: BossReadinessItemStatus,
  detail: string,
  required = false
): BossReadinessItem {
  return { id, label, status, detail, required }
}

/** Live-Bewertung Boss-Setup — unabhängig vom Wizard-finishedAtMs-Flag. */
export function evaluateBossReadiness(input: BossReadinessInput): BossReadinessReport {
  const api = input.api
  const runtime = buildBossOnboardingRuntime(
    api,
    input.sessionLocked ?? false,
    input.fallbackMyAddress
  )
  const mailboxes = buildBossWizardMailboxesContext(api)
  const packageId = (api?.packageId ?? '').trim()
  const hasPackage = HEX64.test(packageId)
  const chainOk = isBossChainStepSatisfied({ hasPackageId: hasPackage, apiStatus: api })
  const backendReachable = api?.backendOnline !== false && api?.backendRunning !== false
  const fromCache = api?.fromCache === true
  const items: BossReadinessItem[] = []

  if (!backendReachable) {
    items.push(
      readinessItem(
        'boss-online',
        'Boss-Server',
        fromCache ? 'warn' : 'fail',
        fromCache
          ? 'Status aus Cache — Server gerade nicht erreichbar. „Neu laden“, wenn npm run dm läuft.'
          : 'Server offline — npm run dm starten und „Neu laden“.',
        true
      )
    )
  } else {
    items.push(
      readinessItem(
        'boss-online',
        'Boss-Server',
        'ok',
        'Erreichbar — Konfiguration wird vom Server gelesen.',
        true
      )
    )
  }

  if (runtime.browserWalletReady && runtime.displayAddress) {
    items.push(
      readinessItem(
        'wallet',
        'Wallet / Signer',
        'ok',
        `Browser-Signer aktiv — ${maskWalletAddress(runtime.displayAddress)}.`,
        true
      )
    )
  } else if (runtime.serverWalletUnlocked && runtime.displayAddress) {
    items.push(
      readinessItem(
        'wallet',
        'Wallet / Signer',
        'warn',
        `Server-Tresor offen, Browser-Signer fehlt — für Senden „Session-Signer laden“ (${maskWalletAddress(runtime.displayAddress)}).`,
        true
      )
    )
  } else if (runtime.displayAddress) {
    items.push(
      readinessItem(
        'wallet',
        'Wallet / Signer',
        'warn',
        `Adresse ${maskWalletAddress(runtime.displayAddress)} — Tresor/Signer im Messenger prüfen.`,
        true
      )
    )
  } else {
    items.push(
      readinessItem(
        'wallet',
        'Wallet / Signer',
        'fail',
        'Keine Wallet-Adresse — Wizard Schritt Wallet oder Tresor entsperren.',
        true
      )
    )
  }

  if (chainOk && hasPackage) {
    const plan = readBossWizardNetworkSetupPlan()
    items.push(
      readinessItem(
        'package',
        'Move-Package (Chain)',
        'ok',
        `Package deployed (${plan}) — ${maskWalletAddress(packageId)}.`,
        true
      )
    )
  } else if (hasPackage) {
    items.push(
      readinessItem(
        'package',
        'Move-Package (Chain)',
        'warn',
        'Package-ID vorhanden — prüfe Netzwerk-Wahl (Testnet/Mainnet) im Wizard Schritt „Wo senden?“.',
        true
      )
    )
  } else {
    items.push(
      readinessItem(
        'package',
        'Move-Package (Chain)',
        'fail',
        'Kein Package — Wizard „Chain anbinden“ / Deploy ausführen.',
        true
      )
    )
  }

  if (mailboxes.hasServerPrivate) {
    items.push(
      readinessItem(
        'mailbox-server',
        'Server-Postfach',
        'ok',
        `MAILBOX_ID gesetzt — ${maskWalletAddress(mailboxes.serverPrivateId)}.`,
        true
      )
    )
  } else {
    items.push(
      readinessItem(
        'mailbox-server',
        'Server-Postfach',
        'fail',
        'Kein privates Server-Postfach — Wizard Schritt Postfächer oder Chain mit Postfach-Anlage.',
        true
      )
    )
  }

  if (mailboxes.hasTeamMailbox) {
    items.push(
      readinessItem(
        'mailbox-team',
        'Team-Postfach',
        'ok',
        'Team-Postfach vorhanden (optional).',
        false
      )
    )
  } else {
    items.push(
      readinessItem(
        'mailbox-team',
        'Team-Postfach',
        'warn',
        'Optional — kein Team-Postfach; für Helfer-Team später anlegen.',
        false
      )
    )
  }

  if (isBossNetworkPlanStepChosen()) {
    items.push(
      readinessItem(
        'network-plan',
        'Netzwerk-Wahl',
        'ok',
        `Gewählt: ${readBossWizardNetworkSetupPlan()}.`,
        false
      )
    )
  } else {
    items.push(
      readinessItem(
        'network-plan',
        'Netzwerk-Wahl',
        'warn',
        'Nicht explizit gespeichert — ggf. aus bestehender Server-Config übernommen.',
        false
      )
    )
  }

  const ttl = api?.einsatzConfig?.defaultTtlDays
  if (ttl != null && Number.isFinite(ttl)) {
    const purge = api?.einsatzConfig?.enablePurge !== false
    items.push(
      readinessItem(
        'einsatz-rules',
        'Einsatz-Regeln',
        'ok',
        `Aufbewahrung ${ttl} Tage, Purge ${purge ? 'an' : 'aus'}.`,
        false
      )
    )
  } else if (!backendReachable) {
    items.push(
      readinessItem(
        'einsatz-rules',
        'Einsatz-Regeln',
        'warn',
        'Server offline — Regeln nicht verifizierbar (Server-Standard gilt).',
        false
      )
    )
  } else {
    items.push(
      readinessItem(
        'einsatz-rules',
        'Einsatz-Regeln',
        'warn',
        'Keine Bestätigung vom Server — Wizard Schritt „Einsatz-Regeln“ speichern.',
        false
      )
    )
  }

  const required = items.filter((i) => i.required && i.id !== 'core')
  const requiredFail = required.some((i) => i.status === 'fail')
  const requiredWarn = required.some((i) => i.status === 'warn')
  const minimalReady = !requiredFail
  const ready = minimalReady

  let summary: string
  if (ready && !requiredWarn) {
    summary = 'Grundkonfiguration vollständig — Einsatzleitung nutzbar.'
  } else if (minimalReady) {
    summary = 'Basis steht — gelbe Hinweise prüfen (Wallet/Server/Regeln).'
  } else {
    summary = 'Pflichtteile fehlen — rot markierte Punkte im Wizard oder Einstellungen nachholen.'
  }

  items.push(
    readinessItem(
      'core',
      'Grundkonfiguration',
      requiredFail ? 'fail' : requiredWarn ? 'warn' : 'ok',
      summary,
      true
    )
  )

  return { ready, minimalReady, items, summary }
}

export function isBossReady(input: BossReadinessInput): boolean {
  return evaluateBossReadiness(input).ready
}
