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
  setStatusMsg(error || 'Recipient unknown.')
  toast.error(error || 'Recipient unknown.')
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
      description: 'Use "Save file" dialog or toast action if download does not start.',
      duration: 25000,
      action: { label: 'Save file', onClick: saveAgain },
    })
    setStatus('success')
    setStatusMsg(`${okMsg} — "Save file" dialog opened.`)
    setTimeout(() => setStatus('idle'), 10000)
  }, [setStatus, setStatusMsg])

  const dismissMorgPkgDownloadOffer = useCallback(() => setMorgPkgDownloadOffer(null), [])

  const processMorgPkgDeviceFiles = useCallback(
    async (files: File[], rec: string) => {
      setMorgPkgDeviceBusy(true)
      setStatus('success')
      setStatusMsg(`Package: processing ${files.length} file(s)…`)
      toast.message('.morg-pkg export', { description: `${files.length} file(s) — please wait…` })
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
        setStatusMsg('Encrypting on server (/morg-pkg-export)…')
        const r = await morgPkgExport(rec, built.plaintext)
        if (!r.ok || !r.morgPkg) {
          const err = r.message || r.error || '.morg-pkg export failed.'
          setStatus('error')
          setStatusMsg(err)
          toast.error(err)
          setTimeout(() => setStatus('idle'), 8000)
          return
        }
        const stem = `Fuer_${rec.slice(0, 10)}_bundle_${built.itemCount}files_${Date.now()}`
        const okMsg = `ECDH .morg-pkg ready (${built.itemCount} file(s)). Hand file to partner.`
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
    setStatusMsg('File picker: choose photos/text…')
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
      setStatusMsg('File selection cancelled.')
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
      setStatusMsg('Creating ECDH .morg-pkg…')
      const r = await morgPkgExport(rec, msg.content)
      if (!r.ok || !r.morgPkg) {
        setStatus('error')
        setStatusMsg(r.message || r.error || '.morg-pkg export failed.')
        toast.error(r.message || r.error || '.morg-pkg export failed.')
        setTimeout(() => setStatus('idle'), 6000)
        return
      }
      const stem = `Fuer_${rec.slice(0, 10)}_${msg.id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 48)}`
      finishMorgPkgDownload(r.morgPkg, stem, 'ECDH .morg-pkg ready (hand to partner offline).')
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
        setStatusMsg('Unlock vault to open .morg-pkg.')
        toast.error('Unlock vault.')
        setTimeout(() => setStatus('idle'), 6000)
        return
      }
      if (apiStatus?.connected !== true) {
        setStatus('error')
        setStatusMsg(
          '.morg-pkg import: first complete handshake and "Accept handshake" or "Connect to deployment partner". The file sender must be in peerMap, otherwise the backend cannot decrypt.'
        )
        toast.error('Connect to sender first (handshake).')
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
          setStatusMsg(r.message || r.error || 'Import failed (handshake with sender?).')
          toast.error(r.message || r.error || 'Import failed.')
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
                ? `Image ${i + 1}${item.caption?.trim() ? `: ${item.caption.trim().slice(0, 40)}` : ''}`
                : item.kind === 'file_txt'
                  ? `Text file ${i + 1}`
                  : item.kind === 'opus'
                    ? `Audio ${i + 1}`
                    : `Entry ${i + 1}`,
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
          setStatusMsg(`.morg-pkg: ${bundle.items.length} entries in package archive.`)
          toast.success(`${bundle.items.length} entries in package archive.`)
        } else {
          appendMorgPkgImport({
            id: recordId,
            importedAt: ts,
            sender,
            fileName: f.name,
            items: [{ label: 'Message', content: plain, kind: 'text' }],
          })
          setStatus('success')
          setStatusMsg('.morg-pkg in package archive (not in inbox).')
          toast.success('Package archive opened.')
        }
        setTimeout(() => setStatus('idle'), 4000)
      } catch (err) {
        setStatus('error')
        setStatusMsg(err instanceof Error ? err.message : 'Invalid JSON file.')
        toast.error('Invalid JSON file.')
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
