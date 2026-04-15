'use client'

/**
 * Einsatz-Profil / Kontakte (initialProfile) — im **privaten Chat** unterhalb der Transport-Karte,
 * damit Import zum Messenger gehört (nicht nur „Setup“ in den Einstellungen).
 */

import { useState, useEffect, type ChangeEvent } from 'react'
import { Users } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { getStatus, applyInitialProfileProvisioning } from '@/frontend/lib/api'
import {
  extractInitialProfileFromPaste,
  queueInitialProfileForNextApply,
  clearPendingInitialProfile,
  persistOfflineBriefingFromProfile,
  LS_OFFLINE_BRIEFING_DISPLAY,
} from '@/frontend/lib/initial-profile-import'

export function ChatViewEinsatzProfilInline() {
  const [backendOnline, setBackendOnline] = useState(false)
  const [einsatzProfilJson, setEinsatzProfilJson] = useState('')
  const [einsatzProfilBusy, setEinsatzProfilBusy] = useState(false)
  const [einsatzProfilMsg, setEinsatzProfilMsg] = useState('')
  const [offlineBriefingDisplay, setOfflineBriefingDisplay] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await getStatus()
      if (res.ok && res.data) setBackendOnline(!!res.data.backendOnline)
    })()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const v = localStorage.getItem(LS_OFFLINE_BRIEFING_DISPLAY)
      setOfflineBriefingDisplay(v && v.trim() ? v : null)
    } catch {
      setOfflineBriefingDisplay(null)
    }
  }, [])

  const handleEinsatzProfilApplyNow = async () => {
    setEinsatzProfilMsg('')
    const extracted = extractInitialProfileFromPaste(einsatzProfilJson)
    if (!extracted) {
      setEinsatzProfilMsg('Kein gültiges initialProfile: vollständiges JSON oder jsonConfig mit Feld initialProfile.')
      return
    }
    if (!backendOnline) {
      setEinsatzProfilMsg('Backend offline — zuerst API erreichbar machen.')
      return
    }
    setEinsatzProfilBusy(true)
    try {
      const res = await applyInitialProfileProvisioning(extracted)
      if (res.ok) {
        persistOfflineBriefingFromProfile(extracted)
        if (typeof extracted.offlineBriefing === 'string' && extracted.offlineBriefing.trim()) {
          setOfflineBriefingDisplay(extracted.offlineBriefing.trim())
        }
        setEinsatzProfilMsg(res.message || `${res.applied ?? 0} Kontakt(e) übernommen.`)
      } else {
        setEinsatzProfilMsg(res.error || 'Import fehlgeschlagen.')
      }
    } finally {
      setEinsatzProfilBusy(false)
    }
  }

  const handleEinsatzProfilQueue = () => {
    setEinsatzProfilMsg('')
    const extracted = extractInitialProfileFromPaste(einsatzProfilJson)
    if (!extracted) {
      setEinsatzProfilMsg('Kein gültiges initialProfile — siehe Hilfetext.')
      return
    }
    queueInitialProfileForNextApply(extracted)
    persistOfflineBriefingFromProfile(extracted)
    if (typeof extracted.offlineBriefing === 'string' && extracted.offlineBriefing.trim()) {
      setOfflineBriefingDisplay(extracted.offlineBriefing.trim())
    }
    setEinsatzProfilMsg('Gespeichert. Wird beim nächsten erfolgreichen API-Kontakt automatisch ins Telefonbuch geschrieben.')
  }

  const handleEinsatzProfilClearQueue = () => {
    clearPendingInitialProfile()
    setEinsatzProfilMsg('Warteschlange geleert.')
  }

  const handleEinsatzProfilFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      setEinsatzProfilJson(typeof r.result === 'string' ? r.result : '')
      setEinsatzProfilMsg('Datei geladen.')
    }
    r.readAsText(f)
    e.target.value = ''
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
          <Users className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h4 className="font-semibold text-foreground">Einsatz-Profil / Kontakte</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              JSON aus dem Boss-Export: <span className="font-mono text-xs">initialProfile</span> oder gesamte{' '}
              <span className="font-mono text-xs">jsonConfig</span>. Wird ins Backend{' '}
              <span className="font-mono text-xs">.morgendrot-contact-labels.json</span> geschrieben —{' '}
              <span className="font-mono text-xs">docs/API-INITIAL-PROFILE.md</span>. Optional:{' '}
              <span className="font-mono text-xs">offlineBriefing</span>.
            </p>
          </div>
          {offlineBriefingDisplay ? (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Einsatz-Notiz</p>
              <p className="mt-1 whitespace-pre-wrap text-amber-50/95">{offlineBriefingDisplay}</p>
            </div>
          ) : null}
          <Textarea
            value={einsatzProfilJson}
            onChange={(e) => setEinsatzProfilJson(e.target.value)}
            placeholder='{"version":1,"contacts":[],"offlineBriefing":"…"}'
            className="min-h-[100px] font-mono text-xs"
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium hover:bg-muted">
              JSON-Datei wählen
              <input type="file" accept=".json,application/json" className="sr-only" onChange={handleEinsatzProfilFile} />
            </label>
            <button
              type="button"
              disabled={einsatzProfilBusy || !backendOnline}
              onClick={() => void handleEinsatzProfilApplyNow()}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {einsatzProfilBusy ? 'Import…' : 'Jetzt ins Telefonbuch'}
            </button>
            <button
              type="button"
              onClick={handleEinsatzProfilQueue}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
            >
              Für später merken
            </button>
            <button
              type="button"
              onClick={handleEinsatzProfilClearQueue}
              className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent"
            >
              Warteschlange leeren
            </button>
          </div>
          {einsatzProfilMsg ? (
            <p className="text-xs text-muted-foreground" role="status">
              {einsatzProfilMsg}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
