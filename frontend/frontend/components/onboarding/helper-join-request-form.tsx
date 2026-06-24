'use client'

import { useCallback, useEffect, useState } from 'react'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { readTelegramAlarmGroupMembership } from '@/frontend/lib/telegram-alarm-group-prefs'
import { publishTeamJoinRequestWire } from '@/frontend/lib/team-sync-wire'
import { saveHelperSentJoinRequest } from '@/frontend/lib/team-join-request-store'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function HelperJoinRequestForm(p: {
  defaultBossAddress?: string
  defaultName?: string
  defaultMeshNodeId?: string
  defaultTelegramChatId?: string
  onSent?: () => void
}) {
  const handoff = readLocalHandoffAppliedSnapshot()
  const [boss, setBoss] = useState(p.defaultBossAddress?.trim() || handoff?.bossAddress?.trim() || '')
  const [name, setName] = useState(p.defaultName?.trim() || handoff?.handoffLabel?.trim() || '')
  const [meshNodeId, setMeshNodeId] = useState(p.defaultMeshNodeId?.trim() || '')
  const [telegramChatId, setTelegramChatId] = useState(
    p.defaultTelegramChatId?.trim() || readTelegramAlarmGroupMembership()?.groupChatId?.trim() || ''
  )
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (p.defaultBossAddress?.trim()) setBoss(p.defaultBossAddress.trim())
  }, [p.defaultBossAddress])

  const send = useCallback(async () => {
    const bossAddr = boss.trim()
    const applicantName = name.trim()
    const myAddr = getDirectIotaSessionSignerAddress()?.trim() || ''
    if (!/^0x[a-fA-F0-9]{64}$/i.test(bossAddr)) {
      setFeedback('Boss-Adresse (0x+64 Hex) eintragen.')
      return
    }
    if (!applicantName) {
      setFeedback('Anzeigename / Callsign fehlt.')
      return
    }
    if (!/^0x[a-fA-F0-9]{64}$/i.test(myAddr)) {
      setFeedback('Zuerst Wallet einrichten — deine Kontakt-ID wird für die Anfrage benötigt.')
      return
    }
    setBusy(true)
    setFeedback('Sende Beitrittsanfrage…')
    const applicant: {
      address: string
      name: string
      meshNodeId?: string
      telegramChatId?: string
    } = { address: myAddr, name: applicantName }
    const mesh = meshNodeId.trim()
    const tg = telegramChatId.trim()
    if (mesh) applicant.meshNodeId = mesh
    if (tg) applicant.telegramChatId = tg

    const r = await publishTeamJoinRequestWire({
      bossAddress: bossAddr,
      applicant,
      note: note.trim() || undefined,
    })
    if (r.ok && r.requestId) {
      saveHelperSentJoinRequest(r.requestId)
      setFeedback('Anfrage gesendet — warte auf Freigabe durch die Einsatzleitung.')
      p.onSent?.()
    } else {
      setFeedback(r.error || 'Senden fehlgeschlagen')
    }
    setBusy(false)
  }, [boss, name, meshNodeId, telegramChatId, note, p])

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/10 p-3 text-sm">
      <p className="text-muted-foreground">
        <UserPlus className="mr-1.5 inline h-4 w-4" aria-hidden />
        Noch kein Handoff-ZIP? Beitritt beim Boss anfragen (Funk- & Telegram-ID optional).
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="jr-boss" className="text-xs text-muted-foreground">
            Boss-Adresse
          </Label>
          <Input
            id="jr-boss"
            value={boss}
            onChange={(e) => setBoss(e.target.value)}
            placeholder="0x…"
            className="mt-0.5 font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <div>
          <Label htmlFor="jr-name" className="text-xs text-muted-foreground">
            Name / Callsign
          </Label>
          <Input id="jr-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-0.5" />
        </div>
        <div>
          <Label htmlFor="jr-mesh" className="text-xs text-muted-foreground">
            Funk Node-ID (!…)
          </Label>
          <Input
            id="jr-mesh"
            value={meshNodeId}
            onChange={(e) => setMeshNodeId(e.target.value)}
            placeholder="!a1b2c3d4"
            className="mt-0.5 font-mono text-xs"
          />
        </div>
        <div>
          <Label htmlFor="jr-tg" className="text-xs text-muted-foreground">
            Telegram Chat-ID
          </Label>
          <Input
            id="jr-tg"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="-100…"
            className="mt-0.5 font-mono text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="jr-note" className="text-xs text-muted-foreground">
            Kurznotiz (optional)
          </Label>
          <Input id="jr-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="mt-0.5" />
        </div>
      </div>
      <Button type="button" size="sm" disabled={busy} onClick={() => void send()}>
        {busy ? 'Sende…' : 'Beitritt anfragen'}
      </Button>
      {feedback ? (
        <p className="text-xs text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  )
}
