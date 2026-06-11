'use client'

import Link from 'next/link'
import { Crown } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

export type EinsatzleitungHubProps = {
  apiStatus?: ApiStatus | null
}

export function EinsatzleitungHub(p: EinsatzleitungHubProps) {
  const { t } = useAppTranslation('dashboard')
  const isBoss = (p.apiStatus?.role || '').trim().toLowerCase() === 'boss'

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Crown className="h-4 w-4 text-amber-600" aria-hidden />
        {t('einsatzHub.title')}
      </p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        {isBoss ? (
          <>
            Zuerst <strong className="text-foreground">Einsatz-Konfiguration</strong> prüfen, dann{' '}
            <strong className="text-foreground">Gerät provisionieren</strong> (Seed + ZIP + QR), danach
            Export-Assistent für Feineinstellung und WLAN-QR. Was wo liegt:{' '}
            <Link
              href="/handbook?file=MESSENGER-CHAT-HANDBUCH.md#einsatzleitung-orientierung"
              className="text-primary underline hover:no-underline"
            >
              Handbuch → Einsatzleitung
            </Link>
            .
          </>
        ) : (
          <>
            Handoff nur für Rolle Boss.{' '}
            <Link
              href="/handbook?file=MESSENGER-CHAT-HANDBUCH.md#einsatzleitung-orientierung"
              className="text-primary underline hover:no-underline"
            >
              Handbuch
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
