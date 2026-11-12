'use client'

import { Lock, StickyNote, KeyRound, HardDrive, Cloud, Smartphone } from 'lucide-react'

/**
 * Eine Karte: wo liegen welche Geheimnisse — kein zweites „Vault“-Produkt.
 */
export function SettingsTresorMapCard() {
  return (
    <div
      id="settings-tresor-landkarte"
      className="rounded-xl border-2 border-primary/35 bg-card p-4 shadow-sm"
    >
      <div className="mb-2 flex items-center gap-2">
        <Lock className="h-5 w-5 text-primary" aria-hidden />
        <h4 className="text-base font-semibold text-foreground">Tresor-Landkarte</h4>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Tresor</strong> = die verschlüsselte Datei auf dem Gerät (
        <span className="font-mono text-[11px]">.morgendrot-vault</span>
        ). „Vault“ ist nur der Technik-Name. Chat-Nachrichten liegen{' '}
        <strong className="text-foreground">nicht</strong> darin (Posteingang/Cache).
      </p>
      <ul className="space-y-3 text-sm">
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">1. Tresor-Datei (lokal)</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Keys, Notizen, Passwörter. Sichern/Laden: Einstellungen → <strong className="text-foreground">IOTA</strong>{' '}
              → Tresor-Bereich.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">2. Tresor on-chain (Backup)</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Optional dieselbe Datei als Backup auf der Chain — kein zweiter Tresor, nur anderer Speicherort
              (ebenfalls unter IOTA).
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">3. Notizen &amp; Passwörter ansehen</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Nachrichten → Posteingang → Button <strong className="text-foreground">Notizen</strong> (neben
              Optionen). Inhalt liegt in der Tresor-Datei.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <span>
            <span className="font-medium text-foreground">4. Nur-Browser-Speicher (kein eigener Menüpunkt)</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Früher „Sidecar“: verschlüsselte Merker <strong className="text-foreground">nur in diesem Browser</strong>{' '}
              (localStorage), <em>nicht</em> in der Tresor-Datei — Passphrasen, NFT-Schlüsselkarten-Liste, Team-Keys.
              Löschen: Sicherheit → Notfall → „Nur Browser-Geheimnisse“. Anderer PC/Browser = neu merken.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">5. NFT / Schlüsselkarte</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Objekt on-chain + Merkliste im Browser. Parallel zum Messaging-Tresor — öffnen unter Posteingang →
              On-Chain / NFT.
            </span>
          </span>
        </li>
      </ul>
    </div>
  )
}
