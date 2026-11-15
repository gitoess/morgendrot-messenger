'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  clearTelegramAlarmGroupMembershipChatId,
  readTelegramAlarmGroupMembership,
  saveTelegramAlarmGroupMembershipChatId,
  TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT,
} from '@/frontend/lib/telegram-alarm-group-prefs'

export function TelegramAlarmGroupChatIdCapture(p: {
  compact?: boolean
  onSaved?: () => void
  onSkip?: () => void
  showSkip?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [savedId, setSavedId] = useState('')

  const sync = useCallback(() => {
    const m = readTelegramAlarmGroupMembership()
    const id = m?.groupChatId?.trim() || ''
    setSavedId(id)
    setDraft(id)
  }, [])

  useEffect(() => {
    sync()
    const onChanged = () => sync()
    window.addEventListener(TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(TELEGRAM_ALARM_GROUP_JOIN_CHANGED_EVENT, onChanged)
  }, [sync])

  const handleSave = () => {
    const res = saveTelegramAlarmGroupMembershipChatId(draft)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Gruppen-Chat-ID gespeichert — Thread und Sendepfad können die Gruppe ansprechen.')
    sync()
    p.onSaved?.()
  }

  const handleClear = () => {
    const res = clearTelegramAlarmGroupMembershipChatId()
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.message('Chat-ID entfernt — Senden an die Gruppe erst nach neuer ID.')
    setDraft('')
    sync()
    p.onSaved?.()
  }

  return (
    <div className={p.compact ? 'mt-3 space-y-2' : 'mt-4 space-y-3'}>
      <div>
        <Label htmlFor="tg-alarm-group-chat-id" className="text-xs text-muted-foreground">
          Gruppen-Chat-ID (Supergruppe, typisch -100…)
        </Label>
        <Input
          id="tg-alarm-group-chat-id"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="-100123456789"
          className="mt-1 font-mono text-xs"
          inputMode="text"
          autoComplete="off"
        />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Nur die Telegram-Gruppen-ID für Alarme/Hinweise (typisch <span className="font-mono">-100…</span>) — kein
        Chat-Verlauf. Andere ID speichern ersetzt die lokale. Boss-Einstellung hat Vorrang, sobald der Server eine
        liefert; lokal entfernen: Button „Chat-ID entfernen“.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={handleSave}>
          Chat-ID speichern
        </Button>
        {savedId ? (
          <Button type="button" size="sm" variant="outline" onClick={handleClear}>
            Chat-ID entfernen
          </Button>
        ) : null}
        {p.showSkip && p.onSkip ? (
          <Button type="button" size="sm" variant="ghost" onClick={p.onSkip}>
            Später
          </Button>
        ) : null}
      </div>
      {savedId ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          Aktiv: <span className="font-mono">{savedId}</span>
        </p>
      ) : (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Ohne Chat-ID: in der Sidebar sichtbar, Senden an „Alle“ eingeschränkt.
        </p>
      )}
    </div>
  )
}
