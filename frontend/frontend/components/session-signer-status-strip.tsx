'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDirectIotaSessionSignerAddress } from '@/frontend/lib/direct-iota-mnemonic-session'
import { tryAutoRestoreDirectIotaSessionSigner, tryAutoRestoreDirectIotaSessionSignerAsync } from '@/frontend/lib/direct-iota-vault-unlock-sync'
import { DIRECT_IOTA_UI_CHANGED } from '@/frontend/lib/direct-iota-ui-events'
import { addressMatchesIdentity } from '@/frontend/features/inbox/inbox-partner-filter'

export function SessionSignerStatusStrip(p: {
  locked?: boolean
  myAddress?: string
  signerMode?: string | null
  onRequestUnlock?: () => void
}) {
  const [addr, setAddr] = useState<string | null>(() => getDirectIotaSessionSignerAddress())

  const refresh = useCallback(() => {
    tryAutoRestoreDirectIotaSessionSigner()
    void tryAutoRestoreDirectIotaSessionSignerAsync().then(() => {
      setAddr(getDirectIotaSessionSignerAddress())
    })
  }, [])

  useEffect(() => {
    refresh()
    const onUi = () => refresh()
    window.addEventListener(DIRECT_IOTA_UI_CHANGED, onUi)
    return () => window.removeEventListener(DIRECT_IOTA_UI_CHANGED, onUi)
  }, [refresh])

  if (p.signerMode && p.signerMode !== 'sdk') {
    return (
      <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-xs">
        <p className="font-medium text-foreground">Direkt-Send (Mainnet)</p>
        <p className="mt-1 text-muted-foreground">
          Boss nutzt <span className="font-mono">SIGNER={p.signerMode}</span> — Browser-Signer nur bei{' '}
          <span className="font-mono">SIGNER=sdk</span>.
        </p>
      </div>
    )
  }

  const active = !!addr?.trim()
  const my = (p.myAddress ?? '').trim()
  const matchesMy = !my || !addr || addressMatchesIdentity(addr, my)

  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2.5 text-xs">
      <p className="font-medium text-foreground">Direkt-Send (Mainnet)</p>
      {p.locked ? (
        <p className="mt-1 text-muted-foreground">
          Session-Signer wird beim Entsperren automatisch aus dem Tresor geladen (gleiche Wallet wie MY_ADDRESS).
        </p>
      ) : active && matchesMy ? (
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
          Signer aktiv
          <span className="font-mono text-foreground">
            {addr!.slice(0, 10)}…{addr!.slice(-6)}
          </span>
        </p>
      ) : active && !matchesMy ? (
        <p className="mt-1 flex items-start gap-1.5 text-destructive">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Signer passt nicht zu MY_ADDRESS — Tresor sperren und erneut entsperren.
        </p>
      ) : (
        <div className="mt-1 space-y-2">
          <p className="text-muted-foreground">
            Signer fehlt in dieser Browser-Sitzung. Vault-Passwort eingeben — der Signer wird aus dem Tresor in den
            Browser geladen (Tresor muss nicht erneut entsperrt werden).
          </p>
          {p.onRequestUnlock ? (
            <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={p.onRequestUnlock}>
              Signer laden
            </Button>
          ) : null}
        </div>
      )}
      {!p.locked && active && matchesMy ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Beim Login gesetzt · über Reload im Tab erhalten · beim Sperren gelöscht.
        </p>
      ) : null}
    </div>
  )
}
