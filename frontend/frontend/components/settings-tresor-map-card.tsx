'use client'

import { Lock, StickyNote, KeyRound, HardDrive, Cloud, Smartphone } from 'lucide-react'

/**
 * Eine Karte: wo liegen welche Geheimnisse — kein zweites „Vault“-Produkt.
 */
export function SettingsTresorMapCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-5 w-5 text-primary" aria-hidden />
        <h4 className="font-semibold text-foreground">Tresor — was wo liegt</h4>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        In der UI heißt es <strong className="text-foreground">Tresor</strong>. „Vault“ ist nur der
        technische Dateiname (<span className="font-mono">.morgendrot-vault</span>). Es gibt{' '}
        <strong className="text-foreground">keinen zweiten Tresor</strong> für Chat — Chat liegt im
        Posteingang / Cache.
      </p>
      <ul className="space-y-2.5 text-sm">
        <li className="flex gap-2">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">Lokale Tresor-Datei</span>
            <span className="block text-[11px] text-muted-foreground">
              Messaging-Keys, Notizen, Passwortmanager („Mein Safe“) — eine Datei, lokal sichern unter
              IOTA → Tresor.
            </span>
          </span>
        </li>
        <li className="flex gap-2">
          <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">Tresor on-chain (Backup)</span>
            <span className="block text-[11px] text-muted-foreground">
              Derselbe Blob auf der Chain-Registry — anderer Speicherort, nicht ein zweites Produkt.
            </span>
          </span>
        </li>
        <li className="flex gap-2">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">Rein schauen</span>
            <span className="block text-[11px] text-muted-foreground">
              Notizen + Passwörter: Posteingang → Button „Notizen“ (neben Optionen). Beides im Vault-Blob;
              dauerhaft mit „In Vault-Datei schreiben“.
            </span>
          </span>
        </li>
        <li className="flex gap-2">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">Browser-Sidecar</span>
            <span className="block text-[11px] text-muted-foreground">
              Passphrasen-Merker, NFT-Schlüsselkarten-Index, Team-Keys — verschlüsselt im Browser, nicht die
              Tresor-Datei.
            </span>
          </span>
        </li>
        <li className="flex gap-2">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium text-foreground">NFT / Schlüsselkarte</span>
            <span className="block text-[11px] text-muted-foreground">
              On-Chain-Objekte + lokaler Index — parallel zum Messaging-Tresor, nicht dasselbe.
            </span>
          </span>
        </li>
      </ul>
    </div>
  )
}
