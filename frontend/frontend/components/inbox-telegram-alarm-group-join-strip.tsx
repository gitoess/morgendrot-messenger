'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, ExternalLink, MessageCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fetchTelegramIntegration } from '@/frontend/lib/api/telegram-integrations'
import { openTelegramAlarmGroupInvite } from '@/frontend/lib/telegram-alarm-group-invite'
import { resolveTelegramInviteLinkForHelper } from '@/frontend/lib/telegram-einsatz-group-target'
import {
  confirmTelegramAlarmGroupJoined,
  isTelegramAlarmGroupJoinInitiatedForLink,
  isTelegramAlarmGroupJoinedForLink,
  saveTelegramAlarmGroupPending,
  TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT,
} from '@/frontend/lib/telegram-alarm-group-prefs'
import { TelegramAlarmGroupChatIdCapture } from '@/frontend/components/telegram-alarm-group-chat-id-capture'

const LS_DISMISS = 'morgendrot.inboxTelegramJoinStripDismissed'

export function InboxTelegramAlarmGroupJoinStrip() {
  const [inviteLink, setInviteLink] = useState('')
  const [label, setLabel] = useState('')
  const [joinOpened, setJoinOpened] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [postJoinChatId, setPostJoinChatId] = useState(false)

  const refresh = useCallback(async () => {
    if (typeof window !== 'undefined') {
      try {
        setDismissed(window.localStorage.getItem(LS_DISMISS) === '1')
      } catch {
        setDismissed(false)
      }
    }
    let integration = null
    const res = await fetchTelegramIntegration()
    if (res.ok) integration = res
    const resolved = resolveTelegramInviteLinkForHelper(integration)
    setInviteLink(resolved.inviteLink)
    setLabel(resolved.label)
    setJoinOpened(
      resolved.inviteLink ? isTelegramAlarmGroupJoinInitiatedForLink(resolved.inviteLink) : false
    )
  }, [])

  useEffect(() => {
    void refresh()
    const onChanged = () => void refresh()
    window.addEventListener(TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT, onChanged)
  }, [refresh])

  if (!inviteLink || dismissed) return null
  if (isTelegramAlarmGroupJoinedForLink(inviteLink) && !postJoinChatId) return null

  const handleJoin = () => {
    saveTelegramAlarmGroupPending({ inviteLink, label: label || undefined })
    openTelegramAlarmGroupInvite(inviteLink)
    setJoinOpened(true)
    toast.message('Telegram geöffnet — beitreten, dann „Beigetreten“ tippen.')
  }

  const handleConfirm = async () => {
    const res = await fetchTelegramIntegration()
    const integration = res.ok ? res : null
    confirmTelegramAlarmGroupJoined({
      label: label || integration?.einsatzGroupLabel,
      inviteLink,
      groupChatId: integration?.einsatzGroupChatId,
    })
    setJoinOpened(false)
    setPostJoinChatId(true)
    toast.success('Beigetreten — Gruppen-Chat-ID (-100…) optional eintragen.')
  }

  const finishPostJoin = () => {
    setPostJoinChatId(false)
    setDismissed(true)
    try {
      window.localStorage.setItem(LS_DISMISS, '1')
    } catch {
      /* ignore */
    }
  }

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(LS_DISMISS, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  return (
    <div
      className="border-b border-sky-500/30 bg-sky-500/10 px-3 py-2.5 sm:px-4"
      role="region"
      aria-label="Telegram-Alarmgruppe"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MessageCircle className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
            Telegram-Alarmgruppe{label ? `: ${label}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Optional — SOS- und Team-Hinweise. Nach Telegram hier bestätigen.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label="Hinweis ausblenden"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {postJoinChatId ? (
        <div className="mt-2">
          <p className="mb-1 text-xs font-medium text-foreground">Schritt 2: Gruppen-Chat-ID</p>
          <TelegramAlarmGroupChatIdCapture
            compact
            showSkip
            onSkip={finishPostJoin}
            onSaved={finishPostJoin}
          />
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={handleJoin}>
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Gruppe beitreten
          </Button>
          {joinOpened ? (
            <Button type="button" size="sm" onClick={handleConfirm}>
              <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Beigetreten
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
