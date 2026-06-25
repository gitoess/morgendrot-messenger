'use client'

import { ArrowUp, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EINSATZLEITUNG_JOIN_REQUESTS_SECTION_ID } from '@/frontend/components/einsatzleitung-join-requests-panel'

export function EinsatzleitungHelferJoinHintPanel() {
  const scrollToRequests = () => {
    document.getElementById(EINSATZLEITUNG_JOIN_REQUESTS_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-500/35 bg-amber-500/10 p-4 text-sm">
      <h4 className="flex items-center gap-2 font-semibold text-foreground">
        <UserPlus className="h-4 w-4 text-amber-400" aria-hidden />
        Spontan beitreten — Ablauf
      </h4>
      <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>Helfer öffnet <strong className="text-foreground">Einstellungen → Import</strong> und sendet eine Beitrittsanfrage (Boss-Adresse + Name).</li>
        <li>Die Anfrage erscheint oben unter <strong className="text-foreground">Beitrittsanfragen &amp; Roster-Vorschläge</strong>.</li>
        <li>Du prüfst den Diff und klickst <strong className="text-foreground">Freigeben &amp; Roster übernehmen</strong> — dann Team-Update (IOTA, ggf. LAN).</li>
      </ol>
      <Button type="button" size="sm" variant="secondary" onClick={scrollToRequests}>
        <ArrowUp className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        Zu offenen Anfragen
      </Button>
    </div>
  )
}
