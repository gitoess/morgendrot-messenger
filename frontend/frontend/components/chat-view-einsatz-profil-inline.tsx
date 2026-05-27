'use client'

/**
 * Einsatz-Profil / Kontakte (`initialProfile`) — Steuerungs-Workflow (typisch **Boss**): im Posteingang
 * unter „Boss: …“ ausklappbar; optional mit eigenem Collapsible, wenn nicht eingebettet.
 */

import { useState, useEffect, type ChangeEvent } from 'react'
import { ChevronDown, ChevronUp, Users, FileJson } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { getStatus, applyInitialProfileProvisioning } from '@/frontend/lib/api'
import {
  extractInitialProfileFromPaste,
  persistOfflineBriefingFromProfile,
  LS_OFFLINE_BRIEFING_DISPLAY,
  summarizeInitialProfile,
  type InitialProfileSummary,
} from '@/frontend/lib/initial-profile-import'

export type ChatViewEinsatzProfilInlineProps = {
  /** Kein inneres Auf/Zu — äußeres `<details>` o. Ä. übernimmt die Ein-/Ausblendung. */
  hideOuterCollapsible?: boolean
  /** Dialog-Modus: weniger Randtext, fokussiert auf Datei + Übernehmen. */
  compact?: boolean
  /** Nach erfolgreichem Import (Telefonbuch neu laden). */
  onContactsApplied?: () => void
}

export function ChatViewEinsatzProfilInline(p?: ChatViewEinsatzProfilInlineProps) {
  const hideOuterCollapsible = p?.hideOuterCollapsible === true
  const compact = p?.compact === true
  const bossSimple = hideOuterCollapsible
  const [sectionOpen, setSectionOpen] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)
  const [loadedProfile, setLoadedProfile] = useState<Record<string, unknown> | null>(null)
  const [loadedFileName, setLoadedFileName] = useState('')
  const [summary, setSummary] = useState<InitialProfileSummary | null>(null)
  const [pasteJson, setPasteJson] = useState('')
  const [showPaste, setShowPaste] = useState(false)
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

  const resolveProfile = (): Record<string, unknown> | null => {
    if (loadedProfile) return loadedProfile
    if (pasteJson.trim()) return extractInitialProfileFromPaste(pasteJson)
    return null
  }

  const loadFromText = (text: string, fileName?: string) => {
    setEinsatzProfilMsg('')
    const extracted = extractInitialProfileFromPaste(text)
    if (!extracted) {
      setLoadedProfile(null)
      setSummary(null)
      setLoadedFileName('')
      setEinsatzProfilMsg('Keine gültige Kontaktliste — erwartet wird `initialProfile` oder JSON mit `contacts`.')
      return false
    }
    setLoadedProfile(extracted)
    setSummary(summarizeInitialProfile(extracted))
    setLoadedFileName(fileName?.trim() || '')
    setPasteJson('')
    const s = summarizeInitialProfile(extracted)
    setEinsatzProfilMsg(
      s.contactCount > 0
        ? `${s.contactCount} Kontakt(e) erkannt — «Kontakte übernehmen» klicken.`
        : 'Profil ohne Kontakte — «Kontakte übernehmen» trotzdem möglich (nur Metadaten).'
    )
    return true
  }

  const handleApply = async () => {
    setEinsatzProfilMsg('')
    const extracted = resolveProfile()
    if (!extracted) {
      setEinsatzProfilMsg('Zuerst eine JSON-Datei wählen (Boss-Export mit Kontaktliste).')
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
        setLoadedProfile(null)
        setSummary(null)
        setLoadedFileName('')
        setPasteJson('')
        p?.onContactsApplied?.()
        setEinsatzProfilMsg(
          res.message ||
            `${res.applied ?? summary?.contactCount ?? 0} Kontakt(e) übernommen — siehe Telefonbuch.`
        )
      } else {
        setEinsatzProfilMsg(res.error || 'Import fehlgeschlagen.')
      }
    } finally {
      setEinsatzProfilBusy(false)
    }
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      loadFromText(typeof r.result === 'string' ? r.result : '', f.name)
    }
    r.readAsText(f)
    e.target.value = ''
  }

  const clearLoaded = () => {
    setLoadedProfile(null)
    setSummary(null)
    setLoadedFileName('')
    setPasteJson('')
    setEinsatzProfilMsg('')
  }

  const summaryBlock =
    summary && loadedProfile ? (
      <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 text-sm">
        <p className="font-medium text-foreground">
          {loadedFileName ? (
            <>
              <FileJson className="mr-1.5 inline h-3.5 w-3.5 opacity-80" aria-hidden />
              {loadedFileName}
            </>
          ) : (
            'Kontaktliste'
          )}
        </p>
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          <li>
            <strong className="text-foreground">{summary.contactCount}</strong> Kontakt(e)
          </li>
          {summary.deploymentChannelTag ? (
            <li>
              Kanal: <span className="font-mono text-foreground">{summary.deploymentChannelTag}</span>
            </li>
          ) : null}
          {summary.hasOfflineBriefing ? <li>Einsatz-Notiz enthalten</li> : null}
          {summary.contactPreview.length > 0 ? (
            <li className="pt-1">
              {summary.contactPreview.join(' · ')}
              {summary.contactCount > summary.contactPreview.length
                ? ` · +${summary.contactCount - summary.contactPreview.length} weitere`
                : null}
            </li>
          ) : null}
        </ul>
        <button type="button" onClick={clearLoaded} className="mt-2 text-[10px] text-muted-foreground underline hover:text-foreground">
          Auswahl verwerfen
        </button>
      </div>
    ) : null

  const bossBody = (
    <div className={compact ? 'space-y-2' : 'space-y-3 px-1 pb-1 pt-0'}>
      {!compact ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          JSON vom Boss-Export (Handoff-ZIP oder Provisioning): enthält die{' '}
          <strong className="text-foreground">Kontaktliste</strong> für dieses Gerät. Datei wählen → Kurzübersicht →{' '}
          <strong className="text-foreground">Kontakte übernehmen</strong> → Einträge landen im{' '}
          <strong className="text-foreground">Telefonbuch</strong> (Name + Adresse + Tags — keine Mailbox-Slots).
        </p>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Erwartet <code className="text-[10px]">initialProfile</code> oder{' '}
          <code className="text-[10px]">{`{ version: 1, contacts: [...] }`}</code> — nicht die volle Telefonbuch-Struktur.
        </p>
      )}
      {!compact ? (
        <details className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">JSON-Beispiel</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-muted/40 p-2 font-mono text-[10px] text-foreground">{`{
  "version": 1,
  "deploymentChannelTag": "Sektor Nord",
  "contacts": [
    { "name": "Einsatzleitung", "address": "0x…64hex…", "roleTags": ["Medic"] }
  ]
}`}</pre>
        </details>
      ) : null}
      {offlineBriefingDisplay ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Einsatz-Notiz</p>
          <p className="mt-1 whitespace-pre-wrap text-amber-50/95">{offlineBriefingDisplay}</p>
        </div>
      ) : null}
      {summaryBlock}
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/15">
          JSON-Datei wählen
          <input type="file" accept=".json,application/json" className="sr-only" onChange={handleFile} />
        </label>
        <button
          type="button"
          disabled={einsatzProfilBusy || !backendOnline || !loadedProfile}
          onClick={() => void handleApply()}
          className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {einsatzProfilBusy ? 'Übernehmen…' : 'Kontakte übernehmen'}
        </button>
        {!compact ? (
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            className="rounded-md border border-border px-2.5 py-1.5 text-[11px] text-muted-foreground hover:bg-accent"
          >
            {showPaste ? 'JSON-Einfügen ausblenden' : 'JSON einfügen (Experte)'}
          </button>
        ) : null}
      </div>
      {showPaste ? (
        <Textarea
          value={pasteJson}
          onChange={(e) => setPasteJson(e.target.value)}
          onBlur={() => {
            if (pasteJson.trim()) loadFromText(pasteJson)
          }}
          placeholder='{"version":1,"contacts":[…]}'
          className="min-h-[72px] font-mono text-xs"
          spellCheck={false}
        />
      ) : null}
      {einsatzProfilMsg ? (
        <p className="text-xs text-muted-foreground" role="status">
          {einsatzProfilMsg}
        </p>
      ) : null}
    </div>
  )

  const fullBody = (
    <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-2">
      <p className="text-sm text-muted-foreground">
        JSON aus dem Boss-Export mit <span className="font-mono text-xs">initialProfile</span> oder{' '}
        <span className="font-mono text-xs">contacts</span> — landet in{' '}
        <span className="font-mono text-xs">.morgendrot-contact-labels.json</span> am Backend.
      </p>
      {offlineBriefingDisplay ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Einsatz-Notiz</p>
          <p className="mt-1 whitespace-pre-wrap text-amber-50/95">{offlineBriefingDisplay}</p>
        </div>
      ) : null}
      {summaryBlock}
      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-medium hover:bg-muted">
          JSON-Datei wählen
          <input type="file" accept=".json,application/json" className="sr-only" onChange={handleFile} />
        </label>
        <button
          type="button"
          disabled={einsatzProfilBusy || !backendOnline || !resolveProfile()}
          onClick={() => void handleApply()}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {einsatzProfilBusy ? 'Übernehmen…' : 'Kontakte übernehmen'}
        </button>
      </div>
      <Textarea
        value={pasteJson}
        onChange={(e) => setPasteJson(e.target.value)}
        onBlur={() => {
          if (pasteJson.trim()) loadFromText(pasteJson)
        }}
        placeholder='Optional: JSON hier einfügen statt Datei'
        className="min-h-[80px] font-mono text-xs"
        spellCheck={false}
      />
      {einsatzProfilMsg ? (
        <p className="text-xs text-muted-foreground" role="status">
          {einsatzProfilMsg}
        </p>
      ) : null}
    </div>
  )

  if (bossSimple) {
    return <div className={compact ? '' : 'rounded-lg border border-border/70 bg-card/80'}>{bossBody}</div>
  }

  return (
    <Collapsible open={sectionOpen} onOpenChange={setSectionOpen} className="rounded-xl border border-border bg-card">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left hover:bg-muted/30"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
              <Users className="h-4 w-4" aria-hidden />
            </span>
            Einsatz-Profil / Kontakte
          </span>
          {sectionOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{fullBody}</CollapsibleContent>
    </Collapsible>
  )
}
