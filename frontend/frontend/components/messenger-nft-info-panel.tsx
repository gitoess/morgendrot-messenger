'use client'

import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessengerEntityInfoDialog } from '@/frontend/components/messenger-entity-info-dialog'
import { TechnicalIdRow, TechnicalIdSection } from '@/frontend/components/technical-id-row'
import { buildNftInfoSections } from '@/frontend/lib/messenger-entity-info-model'
import { findNftGuardedPurseByNft } from '@/frontend/lib/nft-guarded-purse-local-store'
import { findNftBearerTreasuryByNft } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { findNftTimeLeaseByNft } from '@/frontend/lib/nft-time-lease-local-store'
import { getNftKeycard } from '@/frontend/lib/nft-keycard-local-store'
import { listNftActivity } from '@/frontend/lib/nft-activity-local-log'
import {
  explorerObjectUrlFromId,
  explorerTxUrlFromDigest,
} from '@/frontend/lib/iota-tx-explorer-hint'
import { MESSAGING_MODULES_PACKAGE_ID } from '@/frontend/lib/messaging-modules-package'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'

function resolveNftDigest(objectId: string, explicit?: string): string | undefined {
  const d = (explicit || '').trim()
  if (d) return d
  const oid = objectId.trim().toLowerCase()
  if (!oid) return undefined
  for (const e of listNftActivity(80)) {
    if (e.objectId === oid && e.digest?.trim()) return e.digest.trim()
  }
  return undefined
}

export type MessengerNftInfoPanelProps = {
  objectId?: string
  digest?: string
  packageId?: string
  name?: string
  className?: string
  /**
   * compact (default bei showInfoButton): Object-ID-Zeile + Info-Dialog.
   * full: alle Felder inline.
   */
  variant?: 'compact' | 'full'
  showInfoButton?: boolean
}

function buildSectionsForNft(p: {
  objectId?: string
  digest?: string
  packageId?: string
  name?: string
}) {
  const oid = (p.objectId || '').trim()
  const purse = oid ? findNftGuardedPurseByNft(oid) : null
  const treasury = oid ? findNftBearerTreasuryByNft(oid) : null
  const lease = oid ? findNftTimeLeaseByNft(oid) : null
  const keycard = oid ? getNftKeycard(oid) : null
  const vault = purse
    ? { id: purse.purseObjectId, kind: 'guarded' as const, digest: purse.createDigest }
    : treasury
      ? { id: treasury.treasuryObjectId, kind: 'bearer' as const, digest: treasury.createDigest }
      : null
  const pkg =
    (p.packageId || '').trim() ||
    getDirectMailboxChainSnapshot()?.packageId ||
    MESSAGING_MODULES_PACKAGE_ID
  const digest = resolveNftDigest(oid, p.digest)

  return buildNftInfoSections({
    objectId: oid || undefined,
    digest: digest || undefined,
    packageId: pkg || undefined,
    name: p.name || keycard?.label,
    keycardBound: keycard ? true : undefined,
    vaultObjectId: vault?.id,
    vaultKind: vault?.kind,
    vaultCreateDigest: vault?.digest,
    leaseObjectId: lease?.leaseObjectId,
    leaseCreateDigest: lease?.createDigest,
    leaseUnlockMs: lease?.unlockMs,
    objectExplorerHref: oid ? explorerObjectUrlFromId(oid) : undefined,
    digestExplorerHref: digest ? explorerTxUrlFromDigest(digest) : undefined,
    vaultExplorerHref: vault?.id ? explorerObjectUrlFromId(vault.id) : undefined,
    vaultCreateDigestExplorerHref: vault?.digest
      ? explorerTxUrlFromDigest(vault.digest)
      : undefined,
    leaseExplorerHref: lease?.leaseObjectId
      ? explorerObjectUrlFromId(lease.leaseObjectId)
      : undefined,
    leaseCreateDigestExplorerHref: lease?.createDigest
      ? explorerTxUrlFromDigest(lease.createDigest)
      : undefined,
  })
}

/** Technische IDs im NFT-Kontext — Info wie bei Kontakten. */
export function MessengerNftInfoPanel(p: MessengerNftInfoPanelProps) {
  const [infoOpen, setInfoOpen] = useState(false)
  const showBtn = p.showInfoButton === true
  const variant = p.variant ?? (showBtn ? 'compact' : 'full')

  const sections = useMemo(
    () =>
      buildSectionsForNft({
        objectId: p.objectId,
        digest: p.digest,
        packageId: p.packageId,
        name: p.name,
      }),
    [p.objectId, p.digest, p.packageId, p.name, infoOpen]
  )
  const section = sections[0]
  const hasFields = Boolean(section && section.fields.length > 0)
  if (!hasFields) return null

  const inlineFields =
    variant === 'compact'
      ? section!.fields.filter((f) => f.id === 'oid' || f.id === 'vault' || f.id === 'lease')
      : section!.fields

  return (
    <div className={p.className}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-foreground">Technische IDs</p>
        {showBtn && (p.objectId || '').trim() ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => setInfoOpen(true)}
          >
            <Info className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Info
          </Button>
        ) : null}
      </div>

      <TechnicalIdSection title={variant === 'full' ? section!.title : 'Kurz'}>
        {inlineFields.map((f) => (
          <TechnicalIdRow
            key={f.id}
            label={f.label}
            value={f.value}
            copyable={f.copyable}
            hint={f.hint}
            href={f.href}
            hrefLabel={f.hrefLabel}
          />
        ))}
      </TechnicalIdSection>

      {infoOpen ? (
        <MessengerEntityInfoDialog
          open={infoOpen}
          onOpenChange={setInfoOpen}
          title={p.name?.trim() ? `Info · ${p.name.trim()}` : 'NFT-Info'}
          description="Object-ID, Vault, Lease, Package — kopierbar; Explorer öffnet die Chain-Ansicht."
          sections={sections}
        />
      ) : null}
    </div>
  )
}
