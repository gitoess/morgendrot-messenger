'use client'

import Link from 'next/link'
import { KeyRound } from 'lucide-react'

/** § H.0 / § H.1b: Onboarding- und Session-Orientierung (aus `settings-view` extrahiert). */
export function SettingsWalletSessionCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
          <KeyRound className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h4 className="font-semibold text-foreground">Wallet &amp; Session</h4>
          <p className="text-sm text-muted-foreground">
            Entsperren, Vault, Credits vs. Gas (MIST) und optional{' '}
            <strong className="text-foreground">Direkt-IOTA</strong> aus der PWA hängen zusammen, sind aber nicht
            dasselbe. Kurzüberblick und Backlog:{' '}
            <Link href="/handbook/ONBOARDING-WALLET-UX-SPEC.md" className="text-primary underline hover:no-underline">
              Onboarding &amp; Wallet (UX)
            </Link>
            . Recovery / Signer nur bewusst anzeigen:{' '}
            <Link href="/handbook/RECOVERY-PHRASE-BACKUP.md" className="text-primary underline hover:no-underline">
              Recovery Phrase / Backup
            </Link>
            . Ports und zwei Web-Oberflächen:{' '}
            <span className="font-mono text-xs">docs/DEV-START.md</span> im Repo — Handbuch-Auszug ggf. über{' '}
            <Link href="/handbook/BOSS-ORIENTIERUNG.md" className="text-primary underline hover:no-underline">
              Boss-Orientierung
            </Link>
            . Sendeweg Direkt vs. <span className="font-mono">/api</span>:{' '}
            <Link href="/handbook/PWA-HANDBUCH-OFFLINE.md" className="text-primary underline hover:no-underline">
              PWA &amp; Offline
            </Link>{' '}
            (§ 5) und Chat → <strong className="text-foreground">Puls</strong>.
          </p>
        </div>
      </div>
    </div>
  )
}
