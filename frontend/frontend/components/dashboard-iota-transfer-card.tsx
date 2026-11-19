'use client'

/**
 * IOTA-Überweisung über die Wallet-Session — Dashboard (voll oder kompakt für Boss-Start).
 * Frei | Gesichert: eine Form; NFT/Vault-Block dazwischen (Frei = ausgegraut).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, QrCode, RefreshCw, ScanLine, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { transferCoins } from '@/frontend/lib/api'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import QRCode from 'qrcode'
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'
import {
  ChatViewEvidenceImageViewerButton,
  NFT_WALLET_MODES,
} from '@/frontend/components/chat-view-evidence-image-viewer'
import {
  countSecuredNftObjects,
  DashboardNftSecuredBalanceAmount,
  requestNftVaultBalanceRefresh,
} from '@/frontend/components/dashboard-nft-secured-balances'
import {
  DashboardNftSecuredSpendPanel,
  type DashboardNftSecuredSpendHandle,
} from '@/frontend/components/dashboard-nft-secured-spend-panel'
import { QrCameraScanDialog } from '@/frontend/components/qr-camera-scan-dialog'
import { recordIotaActivity } from '@/frontend/lib/iota-activity-local-log'
import { nftVaultSessionHint } from '@/frontend/lib/nft-vault-session-gate'
import { VAULT_PASSWORD_SESSION_CHANGED } from '@/frontend/lib/vault-password-session'
import { listParkedNftVaults } from '@/frontend/lib/nft-vault-parked-store'
import { NFT_GUARDED_PURSE_CHANGED } from '@/frontend/lib/nft-guarded-purse-local-store'
import { NFT_BEARER_TREASURY_CHANGED } from '@/frontend/lib/nft-bearer-treasury-local-store'
import {
  listNftOwnedSnapshot,
  NFT_ACTIVITY_CHANGED_EVENT,
} from '@/frontend/lib/nft-activity-local-log'
import {
  buildReceiveSharePayload,
  defaultMailboxLabel,
  readMailboxLabelMap,
  writeMailboxLabel,
} from '@/frontend/lib/receive-share-payload'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import {
  CONTACT_PHONEBOOK_META_CHANGED_EVENT,
  readContactNotes,
  readContactPhones,
  writeContactNote,
  writeContactPhone,
} from '@/frontend/lib/contact-phonebook-meta-store'
import { saveContactEntry } from '@/frontend/lib/api'

function extractIotaAddressFromScan(raw: string): string | null {
  const m = raw.trim().match(/0x[a-fA-F0-9]{64}/)
  return m ? m[0] : null
}

export type DashboardIotaTransferCardProps = {
  compact?: boolean
  myAddressFull?: string | null
  walletNativeIotaBalance?: { mist: string; displayIota: string } | null
  walletNativeIotaBalanceFetchFailed?: boolean
  hasValidMyAddressForBalance?: boolean
  onRefreshStatus?: () => void | Promise<void>
  addressSuggestions?: string[]
  /** Telefonbuch + Favoriten für Empfängerwahl (T19). */
  recipientOptions?: { address: string; label: string; favorite?: boolean }[]
  /** Aktive Chat-Mailboxen (Server/Team/Privat) — Empfangen/Teilen. */
  mailboxIds?: string[]
  /** Primäre/Privat-Mailbox (für Default-Label). */
  primaryMailboxId?: string
}

export function DashboardIotaTransferCard({
  compact = false,
  myAddressFull,
  walletNativeIotaBalance,
  walletNativeIotaBalanceFetchFailed,
  hasValidMyAddressForBalance = false,
  onRefreshStatus,
  addressSuggestions = [],
  recipientOptions = [],
  mailboxIds = [],
  primaryMailboxId,
}: DashboardIotaTransferCardProps) {
  const [transferNote, setTransferNote] = useState('')
  const { t } = useAppTranslation('dashboard')
  const [transferOpen, setTransferOpen] = useState(!compact)
  const [securedSpendOpen, setSecuredSpendOpen] = useState(false)
  const [securedPreferOid, setSecuredPreferOid] = useState<string | undefined>()
  const securedSpendRef = useRef<DashboardNftSecuredSpendHandle>(null)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveQrUrl, setReceiveQrUrl] = useState('')
  const [shareWallet, setShareWallet] = useState(true)
  const [shareContact, setShareContact] = useState(false)
  const [shareMailboxIds, setShareMailboxIds] = useState<string[]>([])
  const [mailboxLabels, setMailboxLabels] = useState<Record<string, string>>({})
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactNote, setContactNote] = useState('')
  const { directory: contactDirectory, refresh: refreshContactDirectory } = useContactDirectory()
  const [copied, setCopied] = useState(false)
  const [transferTo, setTransferTo] = useState('')
  const [transferAmount, setTransferAmount] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [transferStatus, setTransferStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [transferMsg, setTransferMsg] = useState('')
  const [refreshingBalance, setRefreshingBalance] = useState(false)
  const [vaultHint, setVaultHint] = useState(() => nftVaultSessionHint())
  const [parkedCount, setParkedCount] = useState(0)
  const [nftCount, setNftCount] = useState(0)
  const [nftGalleryOpenNonce, setNftGalleryOpenNonce] = useState(0)
  const [nftGalleryMode, setNftGalleryMode] = useState<'owner' | 'guthaben'>('owner')
  const [scanRecipientOpen, setScanRecipientOpen] = useState(false)

  const myAddress = (myAddressFull || '').trim()
  const addrOk = /^0x[a-fA-F0-9]{64}$/i.test(myAddress)

  const openNftGallery = (mode: 'owner' | 'guthaben' = 'owner') => {
    setNftGalleryMode(mode)
    setNftGalleryOpenNonce((n) => n + 1)
  }

  useEffect(() => {
    const sync = () => {
      setVaultHint(nftVaultSessionHint())
      setParkedCount(listParkedNftVaults().length)
      const owned = listNftOwnedSnapshot().length
      setNftCount(owned > 0 ? owned : countSecuredNftObjects())
    }
    sync()
    window.addEventListener(VAULT_PASSWORD_SESSION_CHANGED, sync)
    window.addEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
    window.addEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
    window.addEventListener(NFT_ACTIVITY_CHANGED_EVENT, sync)
    return () => {
      window.removeEventListener(VAULT_PASSWORD_SESSION_CHANGED, sync)
      window.removeEventListener(NFT_GUARDED_PURSE_CHANGED, sync)
      window.removeEventListener(NFT_BEARER_TREASURY_CHANGED, sync)
      window.removeEventListener(NFT_ACTIVITY_CHANGED_EVENT, sync)
    }
  }, [])

  const openSecuredSpend = (preferredObjectId?: string) => {
    setSecuredPreferOid(preferredObjectId)
    setSecuredSpendOpen(true)
    if (compact) setTransferOpen(true)
  }

  const handleRefreshBalance = async () => {
    setRefreshingBalance(true)
    try {
      try {
        const { syncDiscoveredVaultsIntoLocalIndex } = await import(
          '@/frontend/lib/nft-vault-discover-onchain'
        )
        await syncDiscoveredVaultsIntoLocalIndex()
      } catch {
        /* ignore */
      }
      requestNftVaultBalanceRefresh()
      if (onRefreshStatus) await onRefreshStatus()
    } finally {
      setRefreshingBalance(false)
    }
  }

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount) return
    setTransferring(true)
    setTransferStatus('idle')
    const to = transferTo.trim()
    const amount = parseFloat(transferAmount)
    const note = transferNote.trim()
    const res = await transferCoins(to, amount)
    if (res.ok) {
      setTransferStatus('success')
      setTransferMsg(
        note
          ? `${t('iota.transferSuccess')} · Notiz (nur hier): ${note.slice(0, 80)}`
          : t('iota.transferSuccess')
      )
      const amountLabel = Number.isFinite(amount) ? String(amount) : transferAmount
      recordIotaActivity({
        kind: 'coin_out',
        summary: note
          ? `${amountLabel} IOTA gesendet · Notiz: ${note.slice(0, 80)}`
          : `${amountLabel} IOTA gesendet`,
        counterparty: to,
        digest: typeof res.txDigest === 'string' ? res.txDigest : undefined,
      })
      setTransferTo('')
      setTransferAmount('')
      setTransferNote('')
      void handleRefreshBalance()
    } else {
      setTransferStatus('error')
      setTransferMsg(res.error || t('iota.transferFailed'))
    }
    setTransferring(false)
    setTimeout(() => setTransferStatus('idle'), 5000)
  }

  const mailboxChoices = [
    ...new Set(
      mailboxIds.map((id) => id.trim().toLowerCase()).filter((id) => /^0x[a-f0-9]{64}$/.test(id))
    ),
  ]
  const primaryMb = (primaryMailboxId || mailboxChoices[0] || '').trim().toLowerCase()

  const receivePayload = buildReceiveSharePayload({
    includeWallet: shareWallet,
    walletAddress: addrOk ? myAddress : undefined,
    mailboxes: shareMailboxIds
      .filter((id) => mailboxChoices.includes(id))
      .map((id, i) => ({
        id,
        label:
          mailboxLabels[id]?.trim() ||
          defaultMailboxLabel(id, mailboxChoices.indexOf(id) >= 0 ? mailboxChoices.indexOf(id) : i, primaryMb),
      })),
    includeContact: shareContact,
    contactName,
    contactPhone,
    contactNote,
  })

  const loadReceiveQr = useCallback(async () => {
    const payload = receivePayload.trim()
    if (!payload) {
      setReceiveQrUrl('')
      return
    }
    try {
      const url = await QRCode.toDataURL(payload, { width: 220, margin: 2 })
      setReceiveQrUrl(url)
    } catch {
      setReceiveQrUrl('')
    }
  }, [receivePayload])

  const seedReceiveContactFromPhonebook = useCallback(() => {
    if (!addrOk) return
    const key = myAddress.toLowerCase()
    const entry = contactDirectory[key]
    const fromOpts = recipientOptions.find((o) => o.address.toLowerCase() === key)
    const name =
      (entry?.label || '').trim() ||
      (fromOpts?.label || '').trim() ||
      ''
    const phone = readContactPhones()[key] || ''
    const note = readContactNotes()[key] || ''
    if (name) setContactName(name)
    setContactPhone(phone)
    setContactNote(note)
  }, [addrOk, myAddress, contactDirectory, recipientOptions])

  useEffect(() => {
    if (!receiveOpen) return
    const stored = readMailboxLabelMap()
    setMailboxLabels(stored)
    seedReceiveContactFromPhonebook()
    void loadReceiveQr()
  }, [receiveOpen, loadReceiveQr, seedReceiveContactFromPhonebook])

  useEffect(() => {
    if (!receiveOpen || !shareContact) return
    const onMeta = () => seedReceiveContactFromPhonebook()
    window.addEventListener(CONTACT_PHONEBOOK_META_CHANGED_EVENT, onMeta)
    return () => window.removeEventListener(CONTACT_PHONEBOOK_META_CHANGED_EVENT, onMeta)
  }, [receiveOpen, shareContact, seedReceiveContactFromPhonebook])

  const persistReceiveContactToPhonebook = useCallback(
    async (patch: { name?: string; phone?: string; note?: string }) => {
      if (!addrOk) return
      const key = myAddress.toLowerCase()
      if (patch.phone !== undefined) writeContactPhone(key, patch.phone)
      if (patch.note !== undefined) writeContactNote(key, patch.note)
      if (patch.name !== undefined) {
        const label = patch.name.trim()
        if (label) {
          try {
            await saveContactEntry({ address: key, label })
            refreshContactDirectory()
          } catch {
            /* offline / vault — Phone/Notiz sind trotzdem lokal */
          }
        }
      }
    },
    [addrOk, myAddress, refreshContactDirectory]
  )

  const copyReceivePayload = async () => {
    const payload = receivePayload.trim()
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const toggleMailboxShare = (id: string) => {
    setShareMailboxIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const freeBalanceLine = (() => {
    if (walletNativeIotaBalanceFetchFailed) {
      return <p className="text-xs text-amber-600 dark:text-amber-400">{t('iota.balanceFailed')}</p>
    }
    if (walletNativeIotaBalance) {
      return (
        <span className="text-xs text-muted-foreground" title={`Exakt: ${walletNativeIotaBalance.mist} MIST`}>
          <strong className="text-foreground">{walletNativeIotaBalance.displayIota}</strong> IOTA
        </span>
      )
    }
    if (!hasValidMyAddressForBalance) {
      return <p className="text-[11px] text-muted-foreground">{t('iota.balanceAfterAddress')}</p>
    }
    return <p className="text-[11px] text-muted-foreground">{t('iota.balanceLoading')}</p>
  })()

  const walletHeader = (
    <div className="mb-2 space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className={cn('font-semibold text-foreground', compact ? 'text-sm' : '')}>
            {t('cards.iotaWallet')}
          </h4>
          <div className="mt-1 flex flex-wrap items-start gap-x-5 gap-y-1">
            <div className="min-w-[5.5rem]">
              <p className="text-[10px] text-muted-foreground">Frei:</p>
              {freeBalanceLine}
            </div>
            <div className="min-w-[5.5rem]">
              <p className="text-[10px] text-muted-foreground">NFT gesichert:</p>
              <DashboardNftSecuredBalanceAmount compact={compact} />
            </div>
            <div className="min-w-[4.5rem]">
              <p className="text-[10px] text-muted-foreground">NFT:</p>
              <button
                type="button"
                className="text-left text-xs text-muted-foreground hover:underline"
                title="NFT-Galerie öffnen"
                aria-label="NFT-Galerie öffnen"
                onClick={() => openNftGallery('owner')}
              >
                <strong className="text-foreground">{nftCount}</strong>
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleRefreshBalance()}
          disabled={refreshingBalance}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
          title={t('iota.refreshBalance')}
          aria-label={t('iota.refreshBalance')}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshingBalance && 'animate-spin')} />
        </button>
      </div>
      {vaultHint ? (
        <p className="rounded border border-amber-800/30 bg-amber-950/15 px-2 py-1 text-[10px] text-amber-100/90">
          {vaultHint}
        </p>
      ) : null}
      {parkedCount > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {parkedCount} NFT geparkt — Galerie laden oder Tresor entsperren.
        </p>
      ) : null}
    </div>
  )

  const nftButton = (
    <ChatViewEvidenceImageViewerButton
      triggerLabel={t('iota.nft')}
      defaultMode={nftGalleryMode}
      autoLoadOwnOnOpen
      allowedModes={NFT_WALLET_MODES}
      openNonce={nftGalleryOpenNonce}
      triggerClassName="inline-flex h-auto w-auto items-center justify-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted [&>svg]:mr-0 [&>svg]:h-3.5 [&>svg]:w-3.5"
    />
  )

  const receiveDialog = (
    <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('iota.receiveTitle')}</DialogTitle>
          <DialogDescription>{t('iota.receiveDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-[11px]">
          <label className="flex items-start gap-2 text-foreground">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={shareWallet}
              disabled={!addrOk}
              onChange={(e) => setShareWallet(e.target.checked)}
            />
            <span>
              Wallet-Adresse (Coins)
              {addrOk ? (
                <span className="mt-0.5 block break-all font-mono text-[10px] text-muted-foreground">
                  {myAddress}
                </span>
              ) : (
                <span className="mt-0.5 block text-muted-foreground">{t('iota.noValidAddress')}</span>
              )}
            </span>
          </label>

          <div className="space-y-1.5">
            <p className="font-medium text-foreground">Mailboxen (Chat)</p>
            {mailboxChoices.length === 0 ? (
              <p className="text-muted-foreground">Keine Mailbox-ID aktiv.</p>
            ) : (
              mailboxChoices.map((id, idx) => {
                const checked = shareMailboxIds.includes(id)
                const label =
                  mailboxLabels[id]?.trim() || defaultMailboxLabel(id, idx, primaryMb)
                return (
                  <div key={id} className="space-y-1 rounded border border-border/50 px-2 py-1.5">
                    <label className="flex items-start gap-2 text-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={checked}
                        onChange={() => toggleMailboxShare(id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="font-medium">{label}</span>
                        <span className="mt-0.5 block break-all font-mono text-[10px] text-muted-foreground">
                          {id}
                        </span>
                      </span>
                    </label>
                    <Input
                      className="h-7 text-[11px]"
                      value={mailboxLabels[id] ?? ''}
                      placeholder={defaultMailboxLabel(id, idx, primaryMb)}
                      onChange={(e) => {
                        const v = e.target.value
                        setMailboxLabels((prev) => ({ ...prev, [id]: v }))
                        writeMailboxLabel(id, v)
                      }}
                    />
                  </div>
                )
              })
            )}
          </div>

          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-foreground">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={shareContact}
                onChange={(e) => {
                  const on = e.target.checked
                  setShareContact(on)
                  if (on) seedReceiveContactFromPhonebook()
                }}
              />
              <span>
                Kontakt
                <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
                  Aus Telefonbuch (dein Wallet-Eintrag: Name / Telefon / Notiz)
                </span>
              </span>
            </label>
            {shareContact ? (
              <div className="space-y-1.5 pl-5">
                <Input
                  className="h-8 text-[12px]"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  onBlur={() => void persistReceiveContactToPhonebook({ name: contactName })}
                  placeholder="Name"
                  autoComplete="name"
                />
                <Input
                  className="h-8 text-[12px]"
                  value={contactPhone}
                  onChange={(e) => {
                    const v = e.target.value
                    setContactPhone(v)
                    void persistReceiveContactToPhonebook({ phone: v })
                  }}
                  placeholder="Telefon (optional)"
                  autoComplete="tel"
                />
                <Input
                  className="h-8 text-[12px]"
                  value={contactNote}
                  onChange={(e) => {
                    const v = e.target.value
                    setContactNote(v)
                    void persistReceiveContactToPhonebook({ note: v })
                  }}
                  placeholder="Notiz (optional)"
                />
              </div>
            ) : null}
          </div>
        </div>

        {receiveQrUrl ? (
          <img src={receiveQrUrl} alt={t('iota.receiveQrAlt')} className="mx-auto rounded-lg border border-border" />
        ) : (
          <p className="text-sm text-muted-foreground">Häkchen setzen — dann erscheint der QR.</p>
        )}
        {receivePayload.trim() ? (
          <div className="space-y-2">
            <p className="max-h-28 overflow-y-auto break-all whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
              {receivePayload}
            </p>
            <button
              type="button"
              onClick={() => void copyReceivePayload()}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('iota.copied') : 'Alles kopieren'}
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )

  const recipientSelectOptions =
    recipientOptions.length > 0
      ? recipientOptions
      : addressSuggestions.map((address) => ({
          address,
          label: `${address.slice(0, 10)}…`,
          favorite: false,
        }))

  const handleSend = async () => {
    if (!securedSpendOpen) {
      await handleTransfer()
      return
    }
    if (!transferTo || !transferAmount) return
    setTransferring(true)
    setTransferStatus('idle')
    try {
      const r = await securedSpendRef.current?.payWith(transferTo.trim(), transferAmount.trim())
      if (!r) {
        setTransferStatus('error')
        setTransferMsg('Vault-Auswahl nicht bereit.')
      } else if (r.ok) {
        setTransferStatus('success')
        setTransferMsg(t('iota.transferSuccess'))
        setTransferAmount('')
        void handleRefreshBalance()
      } else {
        setTransferStatus('error')
        setTransferMsg(r.error || t('iota.transferFailed'))
      }
    } finally {
      setTransferring(false)
      setTimeout(() => setTransferStatus('idle'), 5000)
    }
  }

  const sendSection = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => {
            setSecuredSpendOpen(false)
            setSecuredPreferOid(undefined)
          }}
          className={cn(
            'rounded-md border px-2.5 py-1 text-[11px] font-medium',
            !securedSpendOpen
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
          )}
        >
          Frei (normales IOTA)
        </button>
        <button
          type="button"
          onClick={() => openSecuredSpend()}
          className={cn(
            'rounded-md border px-2.5 py-1 text-[11px] font-medium',
            securedSpendOpen
              ? 'border-primary bg-primary/10 text-foreground'
              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
          )}
        >
          NFT gesichert
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {securedSpendOpen
          ? 'Sender braucht die NFT-Schlüsselkarte; Empfänger nur die Wallet-Adresse.'
          : 'Direkte Wallet-Überweisung. Empfänger aus dem Telefonbuch oder 0x eintippen.'}
      </p>
      {transferStatus !== 'idle' && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-2 text-xs font-medium',
            transferStatus === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          )}
        >
          {transferStatus === 'success' ? <Check className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {transferMsg}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-0.5 block text-[11px] text-muted-foreground">{t('iota.recipient')}</label>
          {recipientSelectOptions.length > 0 ? (
            <select
              value={
                recipientSelectOptions.find(
                  (o) => o.address.toLowerCase() === transferTo.trim().toLowerCase()
                )?.address ?? ''
              }
              onChange={(e) => setTransferTo(e.target.value)}
              className="mb-1.5 w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              aria-label="Empfänger aus Telefonbuch"
            >
              <option value="">Telefonbuch wählen…</option>
              {recipientSelectOptions.map((o) => (
                <option key={o.address} value={o.address}>
                  {o.favorite ? `★ ${o.label}` : o.label}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex gap-1.5">
            <input
              type="text"
              list="dashboard-iota-transfer-recipients"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              placeholder="0x… oder oben wählen"
              className="min-w-0 flex-1 rounded-md border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setScanRecipientOpen(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted"
              title="Empfänger-Adresse per Kamera/QR einlesen"
              aria-label="Empfänger-QR scannen"
            >
              <ScanLine className="h-3.5 w-3.5" aria-hidden />
              QR
            </button>
          </div>
          <datalist id="dashboard-iota-transfer-recipients">
            {recipientSelectOptions.map((o) => (
              <option key={o.address} value={o.address}>
                {o.label}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] text-muted-foreground">{t('iota.amount')}</label>
          <input
            type="number"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder="0.1"
            step="0.01"
            min="0"
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {securedSpendOpen ? (
        <DashboardNftSecuredSpendPanel
          ref={securedSpendRef}
          embed
          vaultOnly
          interactive
          preferredObjectId={securedPreferOid}
        />
      ) : null}

      {!securedSpendOpen ? (
        <div>
          <label className="mb-0.5 block text-[11px] text-muted-foreground">
            Notiz (nur dieses Gerät, nicht on-chain)
          </label>
          <input
            type="text"
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value.slice(0, 120))}
            placeholder="optional"
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={transferring || !transferTo || !transferAmount}
        className="mt-1 w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {transferring
          ? t('iota.sending')
          : securedSpendOpen
            ? 'Aus Vault senden'
            : t('iota.send')}
      </button>
    </div>
  )

  const scanRecipientDialog = (
    <QrCameraScanDialog
      open={scanRecipientOpen}
      onOpenChange={setScanRecipientOpen}
      title="Empfänger-QR scannen"
      description="Wallet-Adresse als QR zeigen lassen — 0x… wird ins Empfängerfeld übernommen."
      onScan={(text) => {
        const addr = extractIotaAddressFromScan(text)
        if (addr) {
          setTransferTo(addr)
          setScanRecipientOpen(false)
          return
        }
        setTransferStatus('error')
        setTransferMsg('Kein gültiges 0x… (64 Hex) im QR gefunden.')
        setTimeout(() => setTransferStatus('idle'), 4000)
      }}
    />
  )

  if (compact) {
    return (
      <>
        <div id="dashboard-iota-transfer" className="rounded-xl border border-border/80 bg-card/60 p-3">
          {walletHeader}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTransferOpen((v) => !v)}
              className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              {transferOpen ? t('iota.hideSend') : t('iota.send')}
            </button>
            <button
              type="button"
              onClick={() => setReceiveOpen(true)}
              disabled={!addrOk}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden />
              {t('iota.receive')}
            </button>
            {nftButton}
          </div>
          {transferOpen ? <div className="mt-3 border-t border-border/60 pt-3">{sendSection}</div> : null}
        </div>
        {receiveDialog}
        {scanRecipientDialog}
      </>
    )
  }

  return (
    <>
      <div id="dashboard-iota-transfer" className="rounded-xl border border-border bg-card p-4">
        {walletHeader}
        <div className="mb-3 mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReceiveOpen(true)}
            disabled={!addrOk}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-40"
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden />
            {t('iota.receive')}
          </button>
          {nftButton}
        </div>
        {sendSection}
      </div>
      {receiveDialog}
      {scanRecipientDialog}
    </>
  )
}
