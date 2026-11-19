'use client'

import { Lock, StickyNote, KeyRound, HardDrive, Cloud, Smartphone, BookOpen, Network } from 'lucide-react'

/**
 * Kurzübersicht in Tresor/Sicherheit.
 * Modell: ein Passwort · Header = Sitzung · Inhalt hier · Netz unter IOTA.
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
          href="/handbook?file=VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary underline hover:no-underline"
        >
          <BookOpen className="h-3.5 w-3.5" aria-hidden />
          Begriffe
        </a>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Ein</strong> Passwort öffnet{' '}
        <span className="font-mono text-[11px]">.morgendrot-vault</span> (bzw. Solo-Signer-Ablage). Chatverlauf liegt{' '}
        <strong className="text-foreground">nicht</strong> im Tresor.
      </p>
      <ul className="space-y-3 text-sm">
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">1. Tresor-Datei / Blob</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Keys, optional Seed, Notizen, Passwort-Einträge. Sichern: Lokal / On-Chain weiter unten.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">2. On-Chain-Backup</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Optional derselbe Blob auf der Chain — kein zweiter Tresor, gleiches Passwort.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">3. Notizen &amp; Passwörter</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Hier unter „Inhalt öffnen“ oder Nachrichten → Notizen — beides derselbe Vault-Safe.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <Network className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">4. Package / Mailbox / RPC</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Betrieb unter Einstellungen → <strong className="text-foreground">IOTA</strong> — nicht Geheimnis des
              Tresors (Chat braucht sie auch bei gesperrtem Badge).
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">5. Header-Badge</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Sitzung scharf/weich — Secrets im RAM an/aus. Kein separates Passwort-Produkt.
            </span>
          </span>
        </li>
        <li className="flex gap-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">6. Browser-Sidecars / NFT</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Passphrasen-Merker, NFT-Index: mit Vault-Passwort-Session; Notfall → Browser-Geheimnisse. NFT-Objekte:
              Posteingang → On-Chain / NFT.
            </span>
          </span>
        </li>
      </ul>
    </div>
  )
}
