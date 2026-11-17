'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  fetchTelegramIntegration,
  postTelegramGroupAlarm,
  saveTelegramIntegration,
  type TelegramIntegrationPublic,
} from '@/frontend/lib/api/telegram-integrations'
import {
  drainTeamSyncOfflineQueue,
  publishTelegramAlarmGroupWire,
} from '@/frontend/lib/team-sync-wire'
import {
  listTeamSyncQueueItems,
  TEAM_SYNC_QUEUE_CHANGED_EVENT,
} from '@/frontend/lib/team-sync-offline-queue'
import type { ApiStatus } from '@/frontend/lib/api/status'

type SettingsTelegramEinsatzGroupProps = {
  backendOnline: boolean
  apiStatus?: ApiStatus | null
  isBossRole: boolean
}

type FeedbackKind = 'ok' | 'err' | 'info'

export function SettingsTelegramEinsatzGroup(p: SettingsTelegramEinsatzGroupProps) {
  const [pub, setPub] = useState<TelegramIntegrationPublic | null>(null)
  const [label, setLabel] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [chatId, setChatId] = useState('')
  const [alarmEnabled, setAlarmEnabled] = useState(false)
  const [busy, setBusy] = useState<'load' | 'save' | 'publish' | 'alarm' | 'test' | 'drain' | null>(null)
  const [feedback, setFeedback] = useState<{ kind: FeedbackKind; text: string } | null>(null)
  const [queueCount, setQueueCount] = useState(0)

  const refreshQueueCount = useCallback(() => {
    setQueueCount(listTeamSyncQueueItems().length)
  }, [])

  useEffect(() => {
    refreshQueueCount()
    const sync = () => refreshQueueCount()
    window.addEventListener(TEAM_SYNC_QUEUE_CHANGED_EVENT, sync)
    return () => window.removeEventListener(TEAM_SYNC_QUEUE_CHANGED_EVENT, sync)
  }, [refreshQueueCount])

  const applyPublic = useCallback((data: TelegramIntegrationPublic) => {
    setPub(data)
    setLabel(data.einsatzGroupLabel || '')
    setInviteLink(data.einsatzGroupInviteLink || '')
    setChatId(data.einsatzGroupChatId || '')
    setAlarmEnabled(data.einsatzGroupAlarmEnabled === true)
  }, [])

  const load = useCallback(async () => {
    if (!p.backendOnline) return
    setBusy('load')
    const res = await fetchTelegramIntegration()
    if (res.ok) applyPublic(res)
    else setFeedback({ kind: 'err', text: res.error || 'Laden fehlgeschlagen' })
    setBusy(null)
  }, [applyPublic, p.backendOnline])

  useEffect(() => {
    void load()
  }, [load])

  const savedEnabled = pub?.einsatzGroupAlarmEnabled === true
  const savedChatId = (pub?.einsatzGroupChatId || '').trim()
  const dirty =
    alarmEnabled !== savedEnabled ||
    label.trim() !== (pub?.einsatzGroupLabel || '').trim() ||
    inviteLink.trim() !== (pub?.einsatzGroupInviteLink || '').trim() ||
    chatId.trim() !== savedChatId

  const statusChip = useMemo(() => {
    if (!pub) return { tone: 'muted' as const, text: 'Noch nicht geladen' }
    if (!savedEnabled) return { tone: 'muted' as const, text: 'Inaktiv — Alarme aus' }
    if (!savedChatId) return { tone: 'warn' as const, text: 'Aktiv — Gruppen-Chat-ID fehlt' }
    return { tone: 'ok' as const, text: 'Aktiv — Bot kann die Gruppe anschreiben' }
  }, [pub, savedEnabled, savedChatId])

  const alarmBlockedReason = useMemo(() => {
    if (!alarmEnabled) {
      return 'Zuerst „Alarmgruppe aktiv“ einschalten und Speichern.'
    }
    if (dirty) {
      return 'Änderungen noch nicht gespeichert — zuerst Speichern.'
    }
    if (!savedEnabled) {
      return 'Auf dem Server noch inaktiv — Speichern mit „Alarmgruppe aktiv“.'
    }
    if (!chatId.trim()) {
      return 'Gruppen-Chat-ID (-100…) eintragen und Speichern. Ohne ID kann der Bot die Gruppe nicht erreichen.'
    }
    if (!savedChatId) {
      return 'Gruppen-Chat-ID speichern, sonst schlägt der Server mit „fehlt/ungültig“ fehl.'
    }
    return null
  }, [alarmEnabled, dirty, savedEnabled, chatId, savedChatId])

  if (!p.isBossRole) return null

  const handleSave = async () => {
    setBusy('save')
    setFeedback({ kind: 'info', text: 'Speichere Alarmgruppe…' })
    const res = await saveTelegramIntegration({
      einsatzGroupLabel: label.trim(),
      einsatzGroupInviteLink: inviteLink.trim(),
      einsatzGroupChatId: chatId.trim(),
      einsatzGroupAlarmEnabled: alarmEnabled,
    })
    if (res.ok) {
      applyPublic(res)
      setFeedback({
        kind: 'ok',
        text: alarmEnabled
          ? chatId.trim()
            ? 'Gespeichert — Alarmgruppe aktiv, Bot kann senden.'
            : 'Gespeichert — aktiv, aber ohne Gruppen-Chat-ID sendet der Bot nichts.'
          : 'Gespeichert — Alarmgruppe deaktiviert (kein SOS-/Team-Hinweis in die TG-Gruppe).',
      })
    } else {
      setFeedback({ kind: 'err', text: res.error || 'Speichern fehlgeschlagen' })
    }
    setBusy(null)
  }

  const handlePublish = async () => {
    const teamMb = (p.apiStatus?.inboxUnionMailboxIds?.[0] || p.apiStatus?.mailboxId || '').trim()
    const boss = (p.apiStatus?.myAddressFull || p.apiStatus?.myAddress || '').trim()
    const teamId = (p.apiStatus?.handoffLabel || 'default').trim()
    if (!inviteLink.trim()) {
      setFeedback({ kind: 'err', text: 'Einladungslink eintragen und speichern — damit Helfer der TG-Gruppe beitreten.' })
      return
    }
    setBusy('publish')
    setFeedback({ kind: 'info', text: 'Sende Beitritts-Hinweis an Team-Mailbox…' })
    const r = await publishTelegramAlarmGroupWire({
      teamMailboxAddress: teamMb,
      teamId,
      bossAddress: boss,
      label: label.trim() || undefined,
      inviteLink: inviteLink.trim(),
      telegramGroupHint: true,
    })
    setFeedback({
      kind: r.ok ? 'ok' : 'err',
      text: r.ok
        ? `Wire gesendet${r.channels?.iota ? ' (IOTA)' : ''}${r.channels?.meshPing ? ' · Funk-Ping' : ''}. Helfer sehen eine Beitritts-Karte.`
        : r.error || 'Senden fehlgeschlagen — ggf. in Offline-Queue.',
    })
    refreshQueueCount()
    setBusy(null)
  }

  const handleTeamAlarm = async () => {
    if (alarmBlockedReason) {
      setFeedback({ kind: 'info', text: alarmBlockedReason })
      return
    }
    setBusy('alarm')
    setFeedback({ kind: 'info', text: 'Sende Team-Hinweis an Alarmgruppe…' })
    const r = await postTelegramGroupAlarm({ eventType: 'boss_alarm' })
    setFeedback({
      kind: r.delivered ? 'ok' : r.skipped ? 'info' : 'err',
      text: r.delivered
        ? '„Team alarmieren“: Kurz-Hinweis in die Telegram-Gruppe (nicht der IOTA-Chat).'
        : r.skipped || r.error || 'Hinweis nicht gesendet.',
    })
    setBusy(null)
  }

  const handleTestGroup = async () => {
    if (alarmBlockedReason) {
      setFeedback({ kind: 'info', text: alarmBlockedReason })
      return
    }
    setBusy('test')
    setFeedback({ kind: 'info', text: 'Test-Hinweis an Alarmgruppe…' })
    const r = await postTelegramGroupAlarm({ eventType: 'boss_alarm', teamLabel: label.trim() || undefined })
    setFeedback({
      kind: r.delivered ? 'ok' : r.skipped ? 'info' : 'err',
      text: r.delivered
        ? 'Test in der Telegram-Gruppe prüfen.'
        : r.skipped || r.error || 'Test fehlgeschlagen.',
    })
    setBusy(null)
  }

  const handleDrainQueue = async () => {
    setBusy('drain')
    setFeedback({ kind: 'info', text: 'Offline-Queue wird geleert…' })
    const r = await drainTeamSyncOfflineQueue()
    refreshQueueCount()
    setFeedback({
      kind: r.failed ? 'err' : 'ok',
      text:
        r.drained || r.failed
          ? `${r.drained} gesendet, ${r.failed} fehlgeschlagen.`
          : 'Keine ausstehenden Team-Updates in der Queue.',
    })
    setBusy(null)
  }

  const formDisabled = !p.backendOnline || busy !== null
  const alarmActionsDisabled = formDisabled || Boolean(alarmBlockedReason)

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <MessageCircle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <h4 className="font-semibold text-foreground">Einsatz-Alarmgruppe</h4>
              <p className="text-sm text-muted-foreground">
                Eine Telegram-<strong className="font-medium text-foreground">Gruppe</strong> als Klingel für SOS und
                Boss-Hinweise an alle Helfer mit Telegram — kein Ersatz für den Morgendrot-Chat, kein E2EE.
              </p>
              <p
                className={cn(
                  'inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium',
                  statusChip.tone === 'ok' && 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100',
                  statusChip.tone === 'warn' && 'bg-amber-500/15 text-amber-950 dark:text-amber-100',
                  statusChip.tone === 'muted' && 'bg-muted text-muted-foreground'
                )}
              >
                {statusChip.text}
              </p>
            </div>
            <button
              type="button"
              disabled={!p.backendOnline || busy === 'load'}
              onClick={() => void load()}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Alarmgruppe aktualisieren"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', busy === 'load' && 'animate-spin')} />
              Aktualisieren
            </button>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2 text-xs text-muted-foreground space-y-1.5">
            <p>
              <strong className="text-foreground">Warum aus?</strong> Default aus — damit der Bot nicht versehentlich
              in eine Gruppe schreibt, bevor Chat-ID und Einladung stehen. Einschalten nur, wenn die Gruppe eingerichtet
              ist.
            </p>
            <p>
              <strong className="text-foreground">Aktivieren:</strong> Schalter an → Felder ausfüllen →{' '}
              <strong className="text-foreground">Speichern</strong>. Danach „Test an Gruppe“ / „Team alarmieren“.
            </p>
            <p>
              <strong className="text-foreground">Deaktivieren:</strong> Schalter aus → Speichern. SOS und manuelle
              Team-Alarme gehen dann nicht mehr in die TG-Gruppe (IOTA/Funk bleiben).
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="tg-einsatz-enabled" className="text-sm">
                Alarmgruppe aktiv
              </Label>
              <p className="text-[11px] text-muted-foreground">Server speichert den Schalter erst nach „Speichern“.</p>
            </div>
            <Switch
              id="tg-einsatz-enabled"
              checked={alarmEnabled}
              onCheckedChange={setAlarmEnabled}
              disabled={formDisabled}
            />
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="tg-einsatz-label" className="text-xs text-muted-foreground">
                Bezeichnung (steht im Hinweistext)
              </Label>
              <Input
                id="tg-einsatz-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z. B. Einsatz Team Alpha"
                disabled={formDisabled}
                className="mt-1"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Wann: beim Einrichten. Wozu: erscheint als „Team Alpha: Hilferuf…“ in der Gruppe.
              </p>
            </div>
            <div>
              <Label htmlFor="tg-einsatz-link" className="text-xs text-muted-foreground">
                Permanenter Einladungslink (https://t.me/+…)
              </Label>
              <Input
                id="tg-einsatz-link"
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
                placeholder="https://t.me/+AbCdEfGh"
                disabled={formDisabled}
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Wann: nach Anlegen der TG-Gruppe. Wozu: Helfer-Beitritt (Handoff / „An Team senden“) — nicht die Bot-Ziel-ID.
              </p>
            </div>
            <div>
              <Label htmlFor="tg-einsatz-chat" className="text-xs text-muted-foreground">
                Gruppen-Chat-ID (erforderlich für Alarme, z. B. -100…)
              </Label>
              <Input
                id="tg-einsatz-chat"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-100…"
                disabled={formDisabled}
                className="mt-1 font-mono text-xs"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Wann: Bot als Admin in die Gruppe, dann ID ermitteln (z. B. @userinfobot / Gruppeninfo). Wozu: Ziel für
                SOS, „Team alarmieren“, „Test an Gruppe“. Ohne ID: Server meldet „Gruppen-Chat-ID fehlt“.
              </p>
            </div>
          </div>

          {pub?.botUserId ? (
            <p className="text-xs text-muted-foreground">
              Bot-ID: <span className="font-mono">{pub.botUserId}</span> — muss in der Gruppe Admin sein.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={formDisabled} onClick={() => void handleSave()}>
              {busy === 'save' ? 'Speichere…' : dirty ? 'Speichern *' : 'Speichern'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={formDisabled || !inviteLink.trim()}
              title={
                !inviteLink.trim()
                  ? 'Zuerst Einladungslink eintragen — sendet Beitritts-Karte an die Team-Mailbox.'
                  : 'Beitritts-Hinweis (Link) an Team-Mailbox / Helfer'
              }
              onClick={() => void handlePublish()}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {busy === 'publish' ? 'Sende…' : 'An Team senden'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={alarmActionsDisabled}
              title={alarmBlockedReason || 'Kurz-Hinweis in die Telegram-Gruppe (Boss-Alarm)'}
              onClick={() => void handleTeamAlarm()}
            >
              {busy === 'alarm' ? 'Sende…' : 'Team alarmieren'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={alarmActionsDisabled}
              title={alarmBlockedReason || 'Gleicher Kanal wie Team alarmieren — zum Prüfen'}
              onClick={() => void handleTestGroup()}
            >
              {busy === 'test' ? 'Test…' : 'Test an Gruppe'}
            </Button>
            {queueCount > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={formDisabled}
                onClick={() => void handleDrainQueue()}
              >
                {busy === 'drain' ? 'Queue…' : `Queue senden (${queueCount})`}
              </Button>
            ) : null}
          </div>

          {alarmBlockedReason && alarmEnabled ? (
            <p className="text-[11px] text-amber-800 dark:text-amber-200">{alarmBlockedReason}</p>
          ) : null}

          {feedback ? (
            <p
              role="status"
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                feedback.kind === 'ok' &&
                  'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100',
                feedback.kind === 'err' && 'border-red-500/40 bg-red-500/10 text-red-950 dark:text-red-100',
                feedback.kind === 'info' && 'border-border bg-muted/30 text-foreground'
              )}
            >
              {feedback.kind === 'ok' ? <Check className="mr-1 inline h-4 w-4" /> : null}
              {feedback.text}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
