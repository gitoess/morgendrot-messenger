'use client'

/**
 * Schreibtisch-Vorbereitung Standalone-Smoke (§ H.15, Checkliste 4b–4f).
 * Kein Gerät — nur strukturierte Readiness-Hinweise für UI/Dashboard.
 */
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'
import { getStandaloneHelperReadiness } from '@/frontend/lib/handoff-standalone-ready'
import { readHandoffExtras } from '@/frontend/lib/handoff-extras'
import { getActiveMessengerGroup } from '@/frontend/lib/messenger-group-store'
import { resolveGroupTeamMailboxObjectId } from '@/frontend/lib/group-team-broadcast'
import { hasTeamBroadcastKey } from '@/frontend/lib/team-broadcast-key-store'

export type StandaloneSmokeDeskItem = {
  id: string
  label: string
  ok: boolean
  hint?: string
}

export function getStandaloneSmokeDeskChecklist(): StandaloneSmokeDeskItem[] {
  const r = getStandaloneHelperReadiness()
  const group = getActiveMessengerGroup()
  const teamMb = resolveGroupTeamMailboxObjectId(group)
  const extrasKeys = readHandoffExtras()?.teamBroadcastKeys?.length ?? 0
  const localTeamKey = teamMb ? hasTeamBroadcastKey(teamMb) : false

  return [
    {
      id: 'desk-h15-tests',
      label: 'Schreibtisch: npm run smoke:standalone-desk (H.15 Vitest)',
      ok: false,
      hint: 'Manuell im Repo ausführen — Skript setzt diesen Punkt nicht automatisch.',
    },
    {
      id: 'standalone-mode',
      label: 'Standalone-Modus (keine Basis-URL / APK)',
      ok: r.standaloneMode,
    },
    {
      id: 'handoff',
      label: 'Handoff lokal vorgemerkt',
      ok: r.hasHandoff,
      hint: r.handoffLabel ? `„${r.handoffLabel}"` : undefined,
    },
    {
      id: 'chain-ids',
      label: 'Package + Mailbox + RPC aus Handoff',
      ok: r.configuredFromHandoff.packageId && r.configuredFromHandoff.mailboxId && r.configuredFromHandoff.rpcUrl,
    },
    {
      id: 'wallet',
      label: 'Wallet / Mnemonic (4b)',
      ok: !r.needsMnemonic,
      hint: r.needsMnemonic ? 'Seed-Dialog auf Gerät A ausführen' : undefined,
    },
    {
      id: 'direct-drain',
      label: 'Direct-IOTA Send/Inbox aktiv',
      ok: r.configuredFromHandoff.drain && r.configuredFromHandoff.directMode,
    },
    {
      id: 'team-broadcast-key',
      label: 'Team-Broadcast-Key (verschl. Gruppe, optional)',
      ok: !teamMb || localTeamKey || extrasKeys > 0,
      hint:
        teamMb && !localTeamKey
          ? 'Boss-Handoff mit teamBroadcastKeys — Passwort-ZIP empfohlen'
          : teamMb
            ? 'Key lokal oder in Handoff-Extras'
            : 'Kein Team-Postfach verknüpft — N/A für Klartext-only',
    },
    {
      id: 'ready-chat',
      label: 'Bereit für 4b Klartext-Send (Code-Pfad)',
      ok: r.readyForChat,
    },
  ]
}

export function standaloneSmokeDeskSummaryLine(): string {
  const items = getStandaloneSmokeDeskChecklist().filter((i) => i.id !== 'desk-h15-tests')
  const ok = items.filter((i) => i.ok).length
  return `${ok}/${items.length} Standalone-Vorbereitungspunkte (ohne Handy-Feldtest)`
}

export function isStandaloneSmokeDeskReadyForDevice(): boolean {
  if (!isStandaloneMessengerWithoutBasis()) return false
  const r = getStandaloneHelperReadiness()
  return (
    r.hasHandoff &&
    r.configuredFromHandoff.packageId &&
    r.configuredFromHandoff.mailboxId &&
    r.configuredFromHandoff.rpcUrl &&
    r.configuredFromHandoff.drain
  )
}
