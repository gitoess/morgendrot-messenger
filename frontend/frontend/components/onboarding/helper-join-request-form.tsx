'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { publishTeamJoinRequestWire } from '@/frontend/lib/team-sync-wire'
import { saveHelperSentJoinRequest } from '@/frontend/lib/team-join-request-store'

export function HelperJoinRequestForm(p: {
  defaultBossAddress?: string
  defaultName?: string
  onSent?: () => void
}) {
  const [boss, setBoss] = useState(p.defaultBossAddress?.trim() || '')
  const [name, setName] = useState(p.defaultName?.trim() || '')
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
    const r = await publishTeamJoinRequestWire({
      bossAddress: bossAddr,
      applicant: { address: myAddr, name: applicantName },
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
  }, [boss, name, note, p])

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-muted/10 p-3 text-sm">
      <p className="text-muted-foreground">
        <UserPlus className="mr-1.5 inline h-4 w-4" aria-hidden />
        Noch kein Handoff-ZIP? Beitritt beim Boss anfragen.
      </p>
      <div className="space-y-2">
        <Label htmlFor="jr-boss" className="text-xs text-muted-foreground">
          Boss-Adresse
        </Label>
        <Input
          id="jr-boss"
          value={boss}
          onChange={(e) => setBoss(e.target.value)}
          placeholder="0x…"
          className="font-mono text-xs"
          spellCheck={false}
        />
        <Label htmlFor="jr-name" className="text-xs text-muted-foreground">
          Dein Name / Callsign
        </Label>
        <Input id="jr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Medic Süd" />
        <Label htmlFor="jr-note" className="text-xs text-muted-foreground">
          Kurznotiz (optional)
        </Label>
        <Input
          id="jr-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Rolle, Sektor …"
          maxLength={500}
        />
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
