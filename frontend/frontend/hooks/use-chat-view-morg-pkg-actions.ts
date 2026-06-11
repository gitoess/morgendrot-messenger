'use client'

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { morgPkgExport, morgPkgImport } from '@/frontend/lib/api'
import { encodeIotaCompactAutark } from '@/frontend/lib/image-encode/get-image-encode-port'
import { createMorgPkgDownloadAction, downloadMorgPkgJson } from '@/frontend/lib/sneakernet-export'
import { resolveMorgPkgRecipientAddress } from '@/frontend/lib/morg-pkg-recipient'
import { buildMorgPkgExportPartnerOptions } from '@/frontend/lib/morg-pkg-export-partners'
import { pickFilesForMorgPkgExport } from '@/frontend/lib/pick-files-for-morg-pkg'
import {
  buildMorgPkgBundleFromFiles,
  bundleItemToWireContent,
  tryParseMorgPkgBundle,
} from '@/frontend/lib/morg-pkg-bundle'
import {
  itemKindFromBundleKind,
  readMorgPkgImports,
  writeMorgPkgImports,
  type MorgPkgImportItem,
  type MorgPkgImportRecord,
} from '@/frontend/lib/morg-pkg-import-store'
import type { UseChatViewSendFlowParams } from '@/frontend/hooks/use-chat-view-send-flow-types'
import type { Message } from '@/frontend/lib/types'
import { parseJsonObjectFromFileText } from '@/frontend/lib/morg-pkg-import-utils'
import type { MorgPkgDownloadOffer } from '@/frontend/components/chat-view-morg-pkg-download-dialog'

const MORG_PKG_EXPORT_RECIPIENT_LS = 'morgendrot.morgPkgExportRecipient'

function showMorgPkgRecipientError(
  error: string | null,
  setStatus: UseChatViewSendFlowParams['setStatus'],
  setStatusMsg: UseChatViewSendFlowParams['setStatusMsg']
): void {
  setStatus('error')
  setStatusMsg(error || 'Empfänger unbekannt.')
  toast.error(error || 'Empfänger unbekannt.')
  setTimeout(() => setStatus('idle'), 8000)
}

export function useChatViewMorgPkgActions(p: UseChatViewSendFlowParams) {
  const {
    apiStatus,
    partner,
    recipient: composerRecipient,
    myAddress,
    contactDirectory,
    setStatus,
    setStatusMsg,
    setMorgPkgDeviceBusy,
    morgPkgDeviceBusy,
    morgPkgDeviceFilesRef,
  } = p

  const [morgPkgDownloadOffer, setMorgPkgDownloadOffer] = useState<MorgPkgDownloadOffer | null>(null)
  const [morgPkgImports, setMorgPkgImports] = useState<MorgPkgImportRecord[]>(() => readMorgPkgImports())
  const [morgPkgImportsOpen, setMorgPkgImportsOpen] = useState(false)
  const [morgPkgExportRecipient, setMorgPkgExportRecipient] = useState(() => {
    if (typeof window === 'undefined') return ''
    try {
      return window.sessionStorage.getItem(MORG_PKG_EXPORT_RECIPIENT_LS) || ''
    } catch {
      return ''
    }
  })

  const morgPkgExportPartnerOptions = useMemo(
    () => buildMorgPkgExportPartnerOptions(apiStatus?.connectedAddresses, contactDirectory),
    [apiStatus?.connectedAddresses, contactDirectory]
  )

  useEffect(() => {
    const addrs = apiStatus?.connectedAddresses?.filter(Boolean) ?? []
    if (addrs.length !== 1) return
    const only = addrs[0]!
    setMorgPkgExportRecipient((cur) => cur || only)
  }, [apiStatus?.connectedAddresses])

  useEffect(() => {
    writeMorgPkgImports(morgPkgImports)
  }, [morgPkgImports])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (morgPkgExportRecipient.trim()) {
        window.sessionStorage.setItem(MORG_PKG_EXPORT_RECIPIENT_LS, morgPkgExportRecipient.trim())
      } else {
        window.sessionStorage.removeItem(MORG_PKG_EXPORT_RECIPIENT_LS)
      }
    } catch {
      /* ignore */
    }
  }, [morgPkgExportRecipient])

  const resolveMorgPkgRecipient = useCallback((): { recipient: string | null; error: string | null } => {
    return resolveMorgPkgRecipientAddress({
      locked: apiStatus?.locked,
      connectedAddresses: apiStatus?.connectedAddresses,
      partner,
      recipient: composerRecipient,
      exportRecipient: morgPkgExportRecipient,
    })
  }, [
    apiStatus?.connectedAddresses,
    apiStatus?.locked,
    partner,
    composerRecipient,
    morgPkgExportRecipient,
  ])

  const appendMorgPkgImport = useCallback((record: MorgPkgImportRecord) => {
    setMorgPkgImports((prev) => [record, ...prev].slice(0, 48))
    setMorgPkgImportsOpen(true)
  }, [])

  const removeMorgPkgImport = useCallback((id: string) => {
    setMorgPkgImports((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const finishMorgPkgDownload = useCallback((morgPkg: Record<string, unknown>, stem: string, okMsg: string) => {
    downloadMorgPkgJson(morgPkg, stem)
    setMorgPkgDownloadOffer({ pkg: morgPkg, stem, message: okMsg })
    const saveAgain = createMorgPkgDownloadAction(morgPkg, stem)
    toast.success(okMsg, {
      description: 'Dialog „Datei speichern“ oder Toast-Aktion nutzen, falls kein Download startet.',
      duration: 25000,
      action: { label: 'Datei speichern', onClick: saveAgain },
    })
    setStatus('success')
    setStatusMsg(`${okMsg} — Dialog „Datei speichern“ geöffnet.`)
    setTimeout(() => setStatus('idle'), 10000)
  }, [setStatus, setStatusMsg])

  const dismissMorgPkgDownloadOffer = useCallback(() => setMorgPkgDownloadOffer(null), [])

  const processMorgPkgDeviceFiles = useCallback(
    async (files: File[], rec: string) => {
      setMorgPkgDeviceBusy(true)
      setStatus('success')
      setStatusMsg(`Paket: ${files.length} Datei(en) werden verarbeitet…`)
      toast.message('.morg-pkg-Export', { description: `${files.length} Datei(en) — bitte warten…` })
      try {
        const built = await buildMorgPkgBundleFromFiles(files, async (dataUrl) => {
          const enc = await encodeIotaCompactAutark(dataUrl)
          if (!enc.ok) return { ok: false, error: enc.error }
          return { ok: true, blobBase64: enc.blobBase64 }
        })
        if (!built.ok) {
          setStatus('error')
          setStatusMsg(built.error)
          toast.error(built.error)
          setTimeout(() => setStatus('idle'), 8000)
          return
        }
        setStatusMsg('Verschlüsselung auf dem Server (/morg-pkg-export)…')
        const r = await morgPkgExport(rec, built.plaintext)
        if (!r.ok || !r.morgPkg) {
          const err = r.message || r.error || '.morg-pkg-Export fehlgeschlagen.'
          setStatus('error')
          setStatusMsg(err)
          toast.error(err)
          setTimeout(() => setStatus('idle'), 8000)
          return
        }
        const stem = `Fuer_${rec.slice(0, 10)}_bundle_${built.itemCount}files_${Date.now()}`
        const okMsg = `ECDH-.morg-pkg bereit (${built.itemCount} Datei(en)). Datei an Partner übergeben.`
        finishMorgPkgDownload(r.morgPkg, stem, okMsg)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        setStatus('error')
        setStatusMsg(errMsg)
        toast.error(errMsg)
        setTimeout(() => setStatus('idle'), 8000)
      } finally {
        setMorgPkgDeviceBusy(false)
      }
    },
    [finishMorgPkgDownload, setMorgPkgDeviceBusy, setStatus, setStatusMsg]
  )

  const runMorgPkgDeviceExportPick = useCallback(async () => {
    if (morgPkgDeviceBusy) return
    const { recipient: rec, error } = resolveMorgPkgRecipient()
    if (!rec) {
      showMorgPkgRecipientError(error, setStatus, setStatusMsg)
      return
    }
    setStatus('idle')
    setStatusMsg('Dateiauswahl: Fotos/Text wählen…')
    let files: File[]
    try {
      files = await pickFilesForMorgPkgExport(morgPkgDeviceFilesRef.current)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setStatusMsg(errMsg)
      toast.error(errMsg)
      setTimeout(() => setStatus('idle'), 8000)
      return
    }
    if (!files.length) {
      setStatusMsg('Dateiauswahl abgebrochen.')
      setTimeout(() => setStatus('idle'), 3000)
      return
    }
    await processMorgPkgDeviceFiles(files, rec)
  }, [
    morgPkgDeviceFilesRef,
    morgPkgDeviceBusy,
    processMorgPkgDeviceFiles,
    resolveMorgPkgRecipient,
    setStatus,
    setStatusMsg,
  ])

  const exportEcdhMorgPkgForMessage = useCallback(
    async (msg: Message) => {
      const { recipient: rec, error } = resolveMorgPkgRecipient()
      if (!rec) {
        showMorgPkgRecipientError(error, setStatus, setStatusMsg)
        return
      }
      setStatus('success')
      setStatusMsg('ECDH-.morg-pkg wird erstellt…')
      const r = await morgPkgExport(rec, msg.content)
      if (!r.ok || !r.morgPkg) {
        setStatus('error')
        setStatusMsg(r.message || r.error || '.morg-pkg-Export fehlgeschlagen.')
        toast.error(r.message || r.error || '.morg-pkg-Export fehlgeschlagen.')
        setTimeout(() => setStatus('idle'), 6000)
        return
      }
      const stem = `Fuer_${rec.slice(0, 10)}_${msg.id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 48)}`
      finishMorgPkgDownload(r.morgPkg, stem, 'ECDH-.morg-pkg bereit (offline an Partner übergeben).')
    },
    [finishMorgPkgDownload, resolveMorgPkgRecipient, setStatus, setStatusMsg]
  )

  const onMorgPkgDeviceFiles = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files
      e.target.value = ''
      if (!list?.length) return
      const { recipient: rec, error } = resolveMorgPkgRecipient()
      if (!rec) {
        showMorgPkgRecipientError(error, setStatus, setStatusMsg)
        return
      }
      await processMorgPkgDeviceFiles(Array.from(list), rec)
    },
    [processMorgPkgDeviceFiles, resolveMorgPkgRecipient, setStatus, setStatusMsg]
  )

  const onMorgPkgImportFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ''
      if (!f) return
      if (apiStatus?.locked) {
        setStatus('error')
        setStatusMsg('Tresor entsperren, um .morg-pkg zu öffnen.')
        toast.error('Tresor entsperren.')
        setTimeout(() => setStatus('idle'), 6000)
        return
      }
      if (apiStatus?.connected !== true) {
        setStatus('error')
        setStatusMsg(
          '.morg-pkg import: Zuerst Handshake und „Handshake annehmen“ oder „Mit Einsatz-Partner verbinden“. Der Absender der Datei muss in der peerMap stehen, sonst kann das Backend nicht entschlüsseln.'
        )
        toast.error('Zuerst mit Absender verbinden (Handshake).')
        setTimeout(() => setStatus('idle'), 10000)
        return
      }
      try {
        const text = await f.text()
        const parsedResult = parseJsonObjectFromFileText(text)
        if (!parsedResult.ok) {
          setStatus('error')
          setStatusMsg(parsedResult.error)
          toast.error(parsedResult.error)
          setTimeout(() => setStatus('idle'), 7000)
          return
        }
        const parsed = parsedResult.value
        const r = await morgPkgImport(parsed)
        if (!r.ok || !r.plaintext) {
          setStatus('error')
          setStatusMsg(r.message || r.error || 'Import fehlgeschlagen (Handshake mit Absender?).')
          toast.error(r.message || r.error || 'Import fehlgeschlagen.')
          setTimeout(() => setStatus('idle'), 7000)
          return
        }
        const plain = r.plaintext
        const sender =
          typeof parsed.sender === 'string' && parsed.sender.startsWith('0x') ? parsed.sender : 'import'
        const ts =
          typeof parsed.createdAtMs === 'number' && Number.isFinite(parsed.createdAtMs)
            ? parsed.createdAtMs
            : Date.now()
        const bundle = tryParseMorgPkgBundle(plain)
        const recordId = `morg-pkg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        if (bundle && bundle.items.length > 0) {
          const items: MorgPkgImportItem[] = bundle.items.map((item, i) => ({
            label:
              item.kind === 'compact_image'
                ? `Bild ${i + 1}${item.caption?.trim() ? `: ${item.caption.trim().slice(0, 40)}` : ''}`
                : item.kind === 'file_txt'
                  ? `Textdatei ${i + 1}`
                  : item.kind === 'opus'
                    ? `Audio ${i + 1}`
                    : `Eintrag ${i + 1}`,
            content: bundleItemToWireContent(item),
            kind: itemKindFromBundleKind(item.kind),
          }))
          appendMorgPkgImport({
            id: recordId,
            importedAt: ts,
            sender,
            fileName: f.name,
            items,
          })
          setStatus('success')
          setStatusMsg(`.morg-pkg: ${bundle.items.length} Einträge im Paket-Archiv.`)
          toast.success(`${bundle.items.length} Einträge im Paket-Archiv.`)
        } else {
          appendMorgPkgImport({
            id: recordId,
            importedAt: ts,
            sender,
            fileName: f.name,
            items: [{ label: 'Nachricht', content: plain, kind: 'text' }],
          })
          setStatus('success')
          setStatusMsg('.morg-pkg im Paket-Archiv (nicht im Posteingang).')
          toast.success('Paket-Archiv geöffnet.')
        }
        setTimeout(() => setStatus('idle'), 4000)
      } catch (err) {
        setStatus('error')
        setStatusMsg(err instanceof Error ? err.message : 'Ungültige JSON-Datei.')
        toast.error('Ungültige JSON-Datei.')
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [apiStatus?.connected, apiStatus?.locked, appendMorgPkgImport, setStatus, setStatusMsg]
  )

  return {
    exportEcdhMorgPkgForMessage,
    onMorgPkgDeviceFiles,
    onMorgPkgImportFile,
    runMorgPkgDeviceExportPick,
    morgPkgDownloadOffer,
    dismissMorgPkgDownloadOffer,
    morgPkgImports,
    morgPkgImportsOpen,
    setMorgPkgImportsOpen,
    removeMorgPkgImport,
    morgPkgExportRecipient,
    setMorgPkgExportRecipient,
    morgPkgExportPartnerOptions,
  }
}
