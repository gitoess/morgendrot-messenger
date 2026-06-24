'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, MessageCircle, Send } from 'lucide-react'
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
      setFeedback({ kind: 'ok', text: 'Einsatz-Alarmgruppe gespeichert.' })
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
      setFeedback({ kind: 'err', text: 'Zuerst Einladungslink speichern.' })
      return
    }
    setBusy('publish')
    setFeedback({ kind: 'info', text: 'Sende an Team-Mailbox…' })
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
        ? `Wire gesendet${r.channels?.iota ? ' (IOTA)' : ''}${r.channels?.meshPing ? ' · Funk-Ping' : ''}.`
        : r.error || 'Senden fehlgeschlagen — ggf. in Offline-Queue.',
    })
    refreshQueueCount()
    setBusy(null)
  }

  const handleTeamAlarm = async () => {
    setBusy('alarm')
    setFeedback({ kind: 'info', text: 'Sende Team-Hinweis an Alarmgruppe…' })
    const r = await postTelegramGroupAlarm({ eventType: 'boss_alarm' })
    setFeedback({
      kind: r.delivered ? 'ok' : r.skipped ? 'info' : 'err',
      text: r.delivered
        ? 'Hinweis an Einsatz-Alarmgruppe gesendet.'
        : r.skipped || r.error || 'Hinweis nicht gesendet.',
    })
    setBusy(null)
  }

  const handleTestGroup = async () => {
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

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <MessageCircle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h4 className="font-semibold text-foreground">Einsatz-Alarmgruppe (B4b)</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Eine Telegram-Gruppe für SOS- und Team-Hinweise — optional im Handoff-Export und per Wire an das Team.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="tg-einsatz-enabled" className="text-sm">
              Alarmgruppe aktiv
            </Label>
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
                Bezeichnung
              </Label>
              <Input
                id="tg-einsatz-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="z. B. Einsatz Team Alpha"
                disabled={formDisabled}
                className="mt-1"
              />
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
            </div>
            <div>
              <Label htmlFor="tg-einsatz-chat" className="text-xs text-muted-foreground">
                Gruppen-Chat-ID (optional, für Tests)
              </Label>
              <Input
                id="tg-einsatz-chat"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-100…"
                disabled={formDisabled}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          {pub?.botUserId ? (
            <p className="text-xs text-muted-foreground">
              Bot-ID: <span className="font-mono">{pub.botUserId}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={formDisabled} onClick={() => void handleSave()}>
              {busy === 'save' ? 'Speichere…' : 'Speichern'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={formDisabled || !inviteLink.trim()}
              onClick={() => void handlePublish()}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {busy === 'publish' ? 'Sende…' : 'An Team senden'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={formDisabled || !alarmEnabled}
              onClick={() => void handleTeamAlarm()}
            >
              {busy === 'alarm' ? 'Sende…' : 'Team alarmieren'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={formDisabled || !alarmEnabled}
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
            <Button type="button" size="sm" variant="outline" disabled={!p.backendOnline} onClick={() => void load()}>
              Neu laden
            </Button>
          </div>

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
