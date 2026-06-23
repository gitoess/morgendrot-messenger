'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ExternalLink, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fetchTelegramIntegration } from '@/frontend/lib/api/telegram-integrations'
import { openTelegramAlarmGroupInvite } from '@/frontend/lib/telegram-alarm-group-invite'
import { resolveTelegramInviteLinkForHelper } from '@/frontend/lib/telegram-einsatz-group-target'
import {
  confirmTelegramAlarmGroupJoined,
  isTelegramAlarmGroupJoinInitiatedForLink,
  isTelegramAlarmGroupJoinedForLink,
  readTelegramAlarmGroupMembership,
  saveTelegramAlarmGroupPending,
  TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT,
} from '@/frontend/lib/telegram-alarm-group-prefs'
import { TelegramAlarmGroupChatIdCapture } from '@/frontend/components/telegram-alarm-group-chat-id-capture'

export function TelegramAlarmGroupJoinCard(p: {
  variant?: 'settings' | 'inline'
  backendOnline?: boolean
}) {
  const panel = p.variant !== 'inline'
  const [inviteLink, setInviteLink] = useState('')
  const [label, setLabel] = useState('')
  const [joinOpened, setJoinOpened] = useState(false)
  const [joined, setJoined] = useState(false)

  const refresh = useCallback(async () => {
    let integration = null
    if (p.backendOnline !== false) {
      const res = await fetchTelegramIntegration()
      if (res.ok) integration = res
    }
    const resolved = resolveTelegramInviteLinkForHelper(integration)
    setInviteLink(resolved.inviteLink)
    setLabel(resolved.label)
    setJoinOpened(
      resolved.inviteLink ? isTelegramAlarmGroupJoinInitiatedForLink(resolved.inviteLink) : false
    )
    setJoined(
      resolved.inviteLink ? isTelegramAlarmGroupJoinedForLink(resolved.inviteLink) : false
    )
  }, [p.backendOnline])

  useEffect(() => {
    void refresh()
    const onChanged = () => {
      void refresh()
    }
    window.addEventListener(TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT, onChanged)
  }, [refresh])

  if (!inviteLink) {
    return (
      <p className="text-sm text-muted-foreground">
        Kein Einladungslink bekannt — kommt mit Handoff-ZIP, Team-Update im Posteingang oder Boss-Konfiguration.
      </p>
    )
  }

  const handleJoin = () => {
    saveTelegramAlarmGroupPending({ inviteLink, label: label || undefined })
    openTelegramAlarmGroupInvite(inviteLink)
    setJoinOpened(true)
    toast.message('Telegram geöffnet — der Gruppe beitreten, dann hier „Beigetreten“ tippen.')
  }

  const handleConfirm = async () => {
    let integration = null
    if (p.backendOnline !== false) {
      const res = await fetchTelegramIntegration()
      if (res.ok) integration = res
    }
    confirmTelegramAlarmGroupJoined({
      label: label || integration?.einsatzGroupLabel,
      inviteLink,
      groupChatId: integration?.einsatzGroupChatId,
    })
    setJoinOpened(false)
    setJoined(true)
    toast.success('Beigetreten bestätigt — optional Gruppen-Chat-ID (-100…) eintragen.')
  }

  if (joined) {
    const hasChatId = Boolean(readTelegramAlarmGroupMembership()?.groupChatId?.trim())
    return (
      <div
        className={
          panel
            ? 'rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4'
            : 'rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2'
        }
        role="status"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Check className="h-4 w-4 text-emerald-500" aria-hidden />
          {label || 'Einsatz-Alarmgruppe'} — beigetreten
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          In der Chat-Sidebar unter „Gruppen“ sichtbar. Kein Morgendrot-Gruppenchat.
        </p>
        <TelegramAlarmGroupChatIdCapture compact={!panel} />
        {hasChatId ? null : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Chat-ID kann jederzeit hier oder unter Einstellungen → Telegram ergänzt werden.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={panel ? 'rounded-xl border border-border bg-card p-4' : 'space-y-2'}>
      {panel ? (
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
            <MessageCircle className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Einsatz-Alarmgruppe beitreten</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional — Kurz-Hinweise bei SOS und Team-Updates. Inhalte bleiben in Morgendrot.
            </p>
          </div>
        </div>
      ) : null}
      {label ? <p className="text-sm font-medium text-foreground">{label}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size={panel ? 'sm' : 'default'} onClick={handleJoin}>
          <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden />
          Gruppe beitreten
        </Button>
        {joinOpened ? (
          <Button type="button" size={panel ? 'sm' : 'default'} variant="secondary" onClick={handleConfirm}>
            <Check className="mr-1.5 h-4 w-4" aria-hidden />
            Beigetreten
          </Button>
        ) : null}
      </div>
      {joinOpened ? (
        <p
          className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100"
          role="status"
        >
          Telegram wurde geöffnet. Nach dem Beitritt in der Telegram-App auf <strong>Beigetreten</strong> tippen.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Morgendrot erkennt den Beitritt nicht automatisch — nach Telegram kurz zurück und bestätigen.
        </p>
      )}
    </div>
  )
}
