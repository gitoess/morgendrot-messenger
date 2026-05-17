'use client'

import { useCallback, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { morgPkgExport, morgPkgImport, compactImageEncode } from '@/frontend/lib/api'
import { downloadMorgPkgJson } from '@/frontend/lib/sneakernet-export'
import {
  buildMorgPkgBundleFromFiles,
  bundleItemToWireContent,
  tryParseMorgPkgBundle,
} from '@/frontend/lib/morg-pkg-bundle'
import { contentDedupKey, mergeMessageByDedup } from '@/frontend/lib/message-dedup'
import type { Message } from '@/frontend/lib/types'
import type { UseChatViewSendFlowParams } from '@/frontend/hooks/use-chat-view-send-flow-types'
import { parseJsonObjectFromFileText } from '@/frontend/lib/morg-pkg-import-utils'

function showMorgPkgRecipientError(
  error: string | null,
  setStatus: UseChatViewSendFlowParams['setStatus'],
  setStatusMsg: UseChatViewSendFlowParams['setStatusMsg']
): void {
  setStatus('error')
  setStatusMsg(error || 'Empfänger unbekannt.')
  setTimeout(() => setStatus('idle'), 8000)
}

export function useChatViewMorgPkgActions(p: UseChatViewSendFlowParams) {
  const {
    apiStatus,
    partner,
    recipient,
    myAddress,
    setMessages,
    setStatus,
    setStatusMsg,
    setMorgPkgDeviceBusy,
  } = p

  const resolveMorgPkgRecipient = useCallback((): { recipient: string | null; error: string | null } => {
    if (apiStatus?.locked) {
      return { recipient: null, error: 'Tresor entsperren – .morg-pkg braucht Messaging-Keys.' }
    }
    const addrs = apiStatus?.connectedAddresses
    if (!addrs?.length) {
      return {
        recipient: null,
        error: 'Zuerst verbinden (/connect): .morg-pkg braucht den öffentlichen Schlüssel des Empfängers.',
      }
    }
    if (addrs.length === 1) return { recipient: addrs[0]!, error: null }
    const pt = partner.trim().toLowerCase()
    if (!pt) {
      return {
        recipient: null,
        error:
          'Mehrere Partner: im Feld „Partner (Handshake)“ die Zieladresse eintragen (0x…), dann erneut exportieren.',
      }
    }
    const rec = addrs.find((a) => a.toLowerCase() === pt) ?? null
    if (!rec) return { recipient: null, error: 'Partner-Adresse entspricht keinem verbundenen Eintrag.' }
    return { recipient: rec, error: null }
  }, [apiStatus?.connectedAddresses, apiStatus?.locked, partner])

  const exportEcdhMorgPkgForMessage = useCallback(
    async (msg: Message) => {
      const { recipient: rec, error } = resolveMorgPkgRecipient()
      if (!rec) {
        showMorgPkgRecipientError(error, setStatus, setStatusMsg)
        return
      }
      const r = await morgPkgExport(rec, msg.content)
      if (!r.ok || !r.morgPkg) {
        setStatus('error')
        setStatusMsg(r.message || r.error || '.morg-pkg-Export fehlgeschlagen.')
        setTimeout(() => setStatus('idle'), 6000)
        return
      }
      const stem = `Fuer_${rec.slice(0, 10)}_${msg.id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 48)}`
      downloadMorgPkgJson(r.morgPkg, stem)
      setStatus('success')
      setStatusMsg('ECDH-.morg-pkg heruntergeladen (offline an Partner übergeben).')
      setTimeout(() => setStatus('idle'), 4000)
    },
    [resolveMorgPkgRecipient, setStatus, setStatusMsg]
  )

  const onMorgPkgDeviceFiles = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files
      e.target.value = ''
      if (!list?.length) return
      const { recipient: rec, error } = resolveMorgPkgRecipient()
      if (!rec) {
        showMorgPkgRecipientError(error, setStatus, setStatusMsg)
        toast.error(error || 'Partner fehlt für .morg-pkg-Export.')
        return
      }
      setMorgPkgDeviceBusy(true)
      setStatus('success')
      setStatusMsg(`Paket: ${list.length} Datei(en) werden verarbeitet…`)
      toast.message('.morg-pkg-Export', { description: `${list.length} Datei(en) — bitte warten…` })
      try {
        const built = await buildMorgPkgBundleFromFiles(list, compactImageEncode)
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
        downloadMorgPkgJson(r.morgPkg, stem)
        const okMsg = `ECDH-.morg-pkg heruntergeladen (${built.itemCount} Datei(en)). Datei an Partner übergeben.`
        setStatus('success')
        setStatusMsg(okMsg)
        toast.success(okMsg)
        setTimeout(() => setStatus('idle'), 6000)
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
    [resolveMorgPkgRecipient, setMorgPkgDeviceBusy, setStatus, setStatusMsg]
  )

  const onMorgPkgImportFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ''
      if (!f) return
      if (apiStatus?.locked) {
        setStatus('error')
        setStatusMsg('Tresor entsperren, um .morg-pkg zu öffnen.')
        setTimeout(() => setStatus('idle'), 6000)
        return
      }
      if (apiStatus?.connected !== true) {
        setStatus('error')
        setStatusMsg(
          '.morg-pkg import: Zuerst Handshake und „Handshake annehmen“ oder „Mit Einsatz-Partner verbinden“. Der Absender der Datei muss in der peerMap stehen, sonst kann das Backend nicht entschlüsseln.'
        )
        setTimeout(() => setStatus('idle'), 10000)
        return
      }
      try {
        const text = await f.text()
        const parsedResult = parseJsonObjectFromFileText(text)
        if (!parsedResult.ok) {
          setStatus('error')
          setStatusMsg(parsedResult.error)
          setTimeout(() => setStatus('idle'), 7000)
          return
        }
        const parsed = parsedResult.value
        const r = await morgPkgImport(parsed)
        if (!r.ok || !r.plaintext) {
          setStatus('error')
          setStatusMsg(r.message || r.error || 'Import fehlgeschlagen (Handshake mit Absender?).')
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
        if (bundle && bundle.items.length > 0) {
          const baseTs = ts
          const incoming: Message[] = bundle.items.map((item, i) => {
            const content = bundleItemToWireContent(item)
            const t = baseTs + i
            return {
              id: `morg-pkg-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
              from: sender,
              content,
              timestamp: t,
              encrypted: true,
              recipient: myAddress || undefined,
              transports: ['adhoc'],
              dedupKey: contentDedupKey(sender, content, t),
            }
          })
          setMessages((prev: Message[]) => {
            let next = [...prev]
            for (const nm of incoming) {
              next = mergeMessageByDedup(next, nm)
            }
            return next.sort((a, b) => b.timestamp - a.timestamp)
          })
          setStatus('success')
          setStatusMsg(`.morg-pkg Bundle: ${bundle.items.length} Nachrichten importiert (lokal).`)
        } else {
          const imported: Message = {
            id: `morg-pkg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            from: sender,
            content: plain,
            timestamp: ts,
            encrypted: true,
            recipient: myAddress || undefined,
            transports: ['adhoc'],
            dedupKey: contentDedupKey(sender, plain, ts),
          }
          setMessages((prev: Message[]) => {
            const merged = mergeMessageByDedup(prev, imported)
            return merged.sort((a, b) => b.timestamp - a.timestamp)
          })
          setStatus('success')
          setStatusMsg('.morg-pkg importiert (nur lokal im Posteingang).')
        }
        setTimeout(() => setStatus('idle'), 4000)
      } catch (err) {
        setStatus('error')
        setStatusMsg(err instanceof Error ? err.message : 'Ungültige JSON-Datei.')
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [apiStatus?.locked, myAddress, setMessages, setStatus, setStatusMsg]
  )

  return {
    exportEcdhMorgPkgForMessage,
    onMorgPkgDeviceFiles,
    onMorgPkgImportFile,
  }
}
