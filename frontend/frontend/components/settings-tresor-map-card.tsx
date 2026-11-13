'use client'

import { Lock, StickyNote, KeyRound, HardDrive, Cloud, Smartphone, BookOpen } from 'lucide-react'

/**
 * Kurzübersicht in Sicherheit (neben Notfall-Löschung).
 * Ausführlich: Handbuch → Tresor-Landkarte.
 */
export function SettingsTresorMapCard() {
  return (
    <div
      id="settings-tresor-landkarte"
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" aria-hidden />
          <h4 className="text-base font-semibold text-foreground">Tresor-Landkarte</h4>
        </div>
        <a
          href="/handbook?file=EINSTELLUNGEN-NUTZER-HANDBUCH.md#sicherheit-ist"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary underline hover:no-underline"
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden />
          Handbuch
        </a>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        Orientierung vor Notfall-Löschung: <strong className="text-foreground">Tresor</strong> = Datei{' '}
        <span className="font-mono text-[11px]">.morgendrot-vault</span>. Chat liegt{' '}
        <strong className="text-foreground">nicht</strong> darin (Posteingang/Cache).
      </p>
      <ul className="space-y-3 text-sm">
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">1. Tresor-Datei (lokal)</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Keys, Notizen, Passwörter. Sichern/Laden: Einstellungen →{' '}
              <strong className="text-foreground">Sicherheit</strong> → Tresor-Bereich.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">2. Tresor on-chain (Backup)</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Optional dieselbe Datei als Backup auf der Chain — kein zweiter Tresor (ebenfalls unter Sicherheit).
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">3. Notizen &amp; Passwörter ansehen</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Posteingang → Button <strong className="text-foreground">Notizen</strong>. Inhalt in der Tresor-Datei.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">4. Nur-Browser-Speicher (kein Menüpunkt)</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Encrypted Merker nur hier (Passphrasen, NFT-Liste, Team-Keys) — nicht in der Tresor-Datei. Löschen:
              Notfall → „Nur Browser-Geheimnisse“.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">5. NFT / Schlüsselkarte</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Objekt on-chain + Merkliste im Browser. Posteingang → On-Chain / NFT.
            </span>
          </span>
        </li>
      </ul>
    </div>
  )
}
