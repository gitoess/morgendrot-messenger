'use client'

import { AlertTriangle } from 'lucide-react'

/** Kurz-Disclaimer für Einstellungen — vollständiger Text in DISCLAIMER.md (Repo). */
export function SettingsProjectDisclaimerSection() {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="mb-2 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
        <h4 className="font-semibold text-foreground">Experimentelles Hobby-Projekt</h4>
      </div>
      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
        <li>Kein fertiges Produkt — keine Sicherheitsgarantien, kein Support.</li>
        <li>Nicht für lebenskritische oder behördliche Einsätze geeignet.</li>
        <li>
          EU-Nutzer: nicht auf EU-„Chat Control“/Scanning-Anforderungen ausgelegt — Nutzung auf eigene
          Gefahr.
        </li>
        <li>Kommerzielle Nutzung nur mit schriftlicher Erlaubnis (AGPL-3.0 für Hobby/Forschung).</li>
        <li>Binär-Downloads: unsigned debug APK — nur Sideload, nicht aus App Stores.</li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Vollständiger Disclaimer und Lizenz: Repository{' '}
        <span className="font-mono">DISCLAIMER.md</span>, <span className="font-mono">LICENSE</span> (AGPL-3.0).
      </p>
    </div>
  )
}
