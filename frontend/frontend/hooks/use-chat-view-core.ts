'use client'

/**
 * Gesamte Chat-View-Logik: Kontakte, Inbox (Mailbox + Mesh-Merge), Meshtastic BLE, Anhänge, Status-Polling, Send-Flow, Handshake/Schnell verbinden.
 * Meshtastic-First: Funk über `useMeshtasticBle` + Standard-Payloads; keine parallele Mesh-Implementierung hier.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  meshDecryptV2Wire,
  startHandshake,
  connect,
  fetchStatus,
  fetchPackageIdHistory,
  setPackageIdCommand,
  sendEncryptedMessageWithTimeout,
  purgeMailboxMessage,
  fetchAllInboxMessagesForExport,
  type ApiStatus,
} from '@/frontend/lib/api'
import { extractCompletedSlideSequences } from '@/frontend/lib/inbox-slideshow'
import { buildChatInboxRows, type ChatInboxRow } from '@/frontend/lib/chat-view-inbox-rows'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { useMeshtasticBle } from '@/frontend/hooks/use-meshtastic-ble'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { useChatViewSendFlow } from '@/frontend/hooks/use-chat-view-send-flow'
import { useChatViewAttachments } from '@/frontend/hooks/use-chat-view-attachments'
import { useChatViewVoiceRecord } from '@/frontend/hooks/use-chat-view-voice-record'
import { useChatViewInbox } from '@/frontend/hooks/use-chat-view-inbox'
import {
  downloadEinsatzberichtJson,
  downloadEinsatzberichtSummaryTxt,
  buildEinsatzberichtPayload,
} from '@/frontend/lib/einsatzbericht-export'
import { encryptEinsatzberichtUtf8, downloadEinsatzberichtEncryptedJson } from '@/frontend/lib/einsatzbericht-crypto'
import {
  downloadEinsatzprotokollZipPasswordProtected,
  downloadEinsatzprotokollZipPlain,
} from '@/frontend/lib/einsatzprotokoll-export'
import type { Message } from '@/frontend/lib/types'
import {
  drainMirrorQueue,
  enqueueMirrorFailure,
  getMirrorQueueCount,
  hasMirrorQueuePending,
  mirrorPayloadFromWireBody,
  mirrorQueueDedupKey,
} from '@/frontend/lib/delayed-mirror-queue'
import { mergeAllMessages } from '@/frontend/lib/message-dedup'

export type UseChatViewCoreParams = {
  isPrivate: boolean
  role: string
  myAddress: string
}

export function useChatViewCore(p: UseChatViewCoreParams) {
  const { isPrivate, role, myAddress } = p

  const [message, setMessage] = useState('')
  const [recipient, setRecipient] = useState('')
  const [partner, setPartner] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [encrypted, setEncrypted] = useState(true)
  const [bossView, setBossView] = useState(false)
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null)
  const [forcedTransport, setForcedTransport] = useState<ForcedTransport>('internet')
  /** Nach SOS-Sprache: Hinweis + optional „Jetzt senden“, bis Anhang weg oder ersetzt. */
  const [sosVoiceAwaitingSend, setSosVoiceAwaitingSend] = useState(false)
  const clearSosVoicePrompt = useCallback(() => setSosVoiceAwaitingSend(false), [])
  const [morgPkgDeviceBusy, setMorgPkgDeviceBusy] = useState(false)
  const morgPkgFileRef = useRef<HTMLInputElement>(null)
  const morgPkgDeviceFilesRef = useRef<HTMLInputElement>(null)

  /** Posteingang `/inbox` mit dieser Package-ID (0x…); leer = Backend-Default aus .env. */
  const [inboxPackageFilter, setInboxPackageFilter] = useState('')
  const [packageIdSuggestions, setPackageIdSuggestions] = useState<string[]>([])
  const [packageIdBusy, setPackageIdBusy] = useState(false)

  const { directory, refresh: refreshContactDirectory, isMeshVerifiedForAddress } = useContactDirectory()

  const {
    messages,
    setMessages,
    loading,
    loadingMore,
    loadError,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    appendMeshMessage,
  } = useChatViewInbox({
    role,
    bossView,
    refreshContactDirectory,
    packageId: inboxPackageFilter.trim() || undefined,
  })

  const messagesForExport = useCallback(async () => {
    const fromApi = await fetchAllInboxMessagesForExport({
      packageId: inboxPackageFilter.trim() || undefined,
      bossView,
      role,
    })
    const meshOnly = messages.filter((m) => m.transports?.includes('mesh'))
    if (meshOnly.length === 0) return fromApi
    return mergeAllMessages([...fromApi, ...meshOnly])
  }, [messages, inboxPackageFilter, bossView, role])

  const [delayMirrorToIota, setDelayMirrorToIota] = useState(false)
  const [hiddenInboxIds, setHiddenInboxIds] = useState<Set<string>>(() => new Set())
  const [protokollMarkedIds, setProtokollMarkedIds] = useState<Set<string>>(() => new Set())
  const [inboxSelectMode, setInboxSelectMode] = useState(false)
  const [selectedInboxIds, setSelectedInboxIds] = useState<Set<string>>(() => new Set())
  const mirrorDedupRef = useRef(new Set<string>())
  const mirrorDrainInFlightRef = useRef(false)
  /** Anzahl ausstehender IOTA-Mirror-Einträge (LoRa→Chain, localStorage). */
  const [mirrorQueuePending, setMirrorQueuePending] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const h = sessionStorage.getItem('morg.inbox.hidden.ids')
      if (h) setHiddenInboxIds(new Set(JSON.parse(h) as string[]))
      const p = sessionStorage.getItem('morg.protokoll.marked.ids')
      if (p) setProtokollMarkedIds(new Set(JSON.parse(p) as string[]))
    } catch {
      /* ignore */
    }
    try {
      setMirrorQueuePending(getMirrorQueueCount())
    } catch {
      /* ignore */
    }
  }, [])

  const displayMessages = useMemo(
    () => messages.filter((m) => !hiddenInboxIds.has(m.id)),
    [messages, hiddenInboxIds]
  )

  const decryptMeshWire = useCallback(async (senderAddress: string, fullWire: Uint8Array) => {
    const { uint8ArrayToBase64 } = await import('@/frontend/lib/emergency-binary-browser')
    const r = await meshDecryptV2Wire(senderAddress, uint8ArrayToBase64(fullWire))
    return r.ok && r.text ? r.text : null
  }, [])

  const runMirrorDrain = useCallback(async () => {
    if (mirrorDrainInFlightRef.current) return
    const s = await fetchStatus()
    if (s.error || s.backendRunning === false || s.locked) return
    if (getMirrorQueueCount() === 0) return
    mirrorDrainInFlightRef.current = true
    try {
      const r = await drainMirrorQueue(
        async (payload) => {
          const res = await sendEncryptedMessageWithTimeout(payload)
          const err = res.error || (res as { message?: string }).message
          return { ok: res.ok === true, error: typeof err === 'string' ? err : undefined }
        },
        (item) => {
          mirrorDedupRef.current.add(mirrorQueueDedupKey(item.fromAddress, item.wireBody))
        }
      )
      setMirrorQueuePending(r.remaining)
      if (r.sent > 0) {
        setStatus('success')
        setStatusMsg(
          r.sent === 1
            ? 'Delayed Upload: 1 Eintrag aus Warteschlange nach IOTA übertragen.'
            : `Delayed Upload: ${r.sent} Einträge aus Warteschlange nach IOTA übertragen.`
        )
        setTimeout(() => setStatus('idle'), 6000)
        void loadMessages()
      }
    } finally {
      mirrorDrainInFlightRef.current = false
    }
  }, [loadMessages, setStatus, setStatusMsg])

  const onDelayMirrorPlaintext = useCallback(
    async (body: string, fromAddress: string) => {
      const dedup = mirrorQueueDedupKey(fromAddress, body)
      if (mirrorDedupRef.current.has(dedup)) return
      if (hasMirrorQueuePending(fromAddress, body)) return
      try {
        const r = await sendEncryptedMessageWithTimeout(mirrorPayloadFromWireBody(body))
        if (r.ok) {
          mirrorDedupRef.current.add(dedup)
          setStatus('success')
          setStatusMsg('Delayed Upload: Inhalt zusätzlich per IOTA gespeichert.')
          setTimeout(() => setStatus('idle'), 6000)
          void loadMessages()
        } else {
          const en = enqueueMirrorFailure({
            wireBody: body,
            fromAddress,
            lastError: r.error || (r as { message?: string }).message,
          })
          setMirrorQueuePending(getMirrorQueueCount())
          setStatus('error')
          setStatusMsg(
            en.queued
              ? `Delayed Upload: zwischengespeichert (${getMirrorQueueCount()} in Warteschlange). Wird bei Verbindung nachgeliefert.`
              : en.reason || r.error || (r as { message?: string }).message || 'Mirror fehlgeschlagen.'
          )
          setTimeout(() => setStatus('idle'), 8000)
          void runMirrorDrain()
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        enqueueMirrorFailure({ wireBody: body, fromAddress, lastError: msg })
        setMirrorQueuePending(getMirrorQueueCount())
        setStatus('error')
        setStatusMsg(`Delayed Upload: zwischengespeichert (${msg.slice(0, 100)})`)
        setTimeout(() => setStatus('idle'), 8000)
        void runMirrorDrain()
      }
    },
    [loadMessages, runMirrorDrain, setStatus, setStatusMsg]
  )

  const slideSequences = useMemo(() => extractCompletedSlideSequences(displayMessages), [displayMessages])

  const inboxRows = useMemo(
    (): ChatInboxRow[] => buildChatInboxRows(displayMessages, slideSequences),
    [displayMessages, slideSequences]
  )

  const meshtastic = useMeshtasticBle({
    contactDirectory: directory,
    onMeshChatMessage: appendMeshMessage,
    decryptMeshV2Wire: decryptMeshWire,
    onDelayMirrorPlaintext,
  })

  const [meshExportPw, setMeshExportPw] = useState('')
  const [meshImportPw, setMeshImportPw] = useState('')
  const [meshImportJson, setMeshImportJson] = useState('')
  const [meshSyncBusy, setMeshSyncBusy] = useState(false)
  const [meshSyncMsg, setMeshSyncMsg] = useState<string | null>(null)
  const [localPurgeBusy, setLocalPurgeBusy] = useState(false)
  const [contactBleAddress, setContactBleAddress] = useState('')
  const [contactBleUuid, setContactBleUuid] = useState('')
  const [contactBleBusy, setContactBleBusy] = useState(false)

  const {
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    attachedLora,
    compactMeta,
    compactPreviewUrl,
    loraPreviewUrl,
    loraOnlineFallbackOffer,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
    compactBusy,
    compactFileRef,
    clearCompactAttachment,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
  } = useChatViewAttachments({
    role,
    forcedTransport,
    setStatus,
    setStatusMsg,
    onCompactIngestStart: clearSosVoicePrompt,
  })

  const clearCompactAttachmentAndSos = useCallback(() => {
    clearCompactAttachment()
    setSosVoiceAwaitingSend(false)
  }, [clearCompactAttachment])

  const {
    voicePhase,
    voiceActiveKind,
    voiceProgress01,
    voiceBusy,
    voiceRecording,
    onVoiceToggle,
    onVoiceEmergencyToggle,
    voiceNormalBlockedStart,
    voiceEmergencyBlockedStart,
    voiceMaxSeconds,
    voiceEmergencyMaxSeconds,
    sosVoiceFollowsOnline,
  } = useChatViewVoiceRecord({
    forcedTransport,
    ingestChatAttachmentFile,
    setStatus,
    setStatusMsg,
    onEmergencyVoiceReady: () => setSosVoiceAwaitingSend(true),
    blocked: sending || compactBusy,
  })

  useEffect(() => {
    let alive = true
    const tick = async () => {
      const s = await fetchStatus()
      if (!alive || s.error) return
      setApiStatus(s)
      await runMirrorDrain()
    }
    void tick()
    const id = setInterval(() => void tick(), 12000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [runMirrorDrain])

  const {
    exportEcdhMorgPkgForMessage,
    onMorgPkgDeviceFiles,
    onMorgPkgImportFile,
    confirmLoraSendViaOnline,
    handleSend,
  } = useChatViewSendFlow({
    isPrivate,
    encrypted,
    forcedTransport,
    recipient,
    partner,
    myAddress,
    message,
    setMessage,
    apiStatus,
    attachedLora,
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    clearCompactAttachment: clearCompactAttachmentAndSos,
    meshtastic,
    loadMessages,
    setMessages,
    setSending,
    setStatus,
    setStatusMsg,
    setMorgPkgDeviceBusy,
    setLoraOnlineFallbackOffer,
    loraOnlineOfferPayloadRef,
    delayMirrorToIota,
  })

  const handleHandshake = useCallback(async () => {
    if (!partner.trim()) return
    setSending(true)
    const res = await startHandshake(partner)
    if (res.ok) {
      setStatus('success')
      setStatusMsg('Handshake gestartet!')
      setShowSetup(false)
    } else {
      setStatus('error')
      setStatusMsg(res.error || 'Fehler')
    }
    setSending(false)
    setTimeout(() => setStatus('idle'), 3000)
  }, [partner])

  const handleConnect = useCallback(async () => {
    setSending(true)
    const res = await connect()
    if (res.ok) {
      setStatus('success')
      setStatusMsg('Verbunden!')
    } else {
      setStatus('error')
      setStatusMsg(res.error || 'Fehler')
    }
    setSending(false)
    setTimeout(() => setStatus('idle'), 3000)
  }, [])

  const dismissLoraOnlineFallback = useCallback(() => {
    setLoraOnlineFallbackOffer(null)
    loraOnlineOfferPayloadRef.current = null
    setStatus('idle')
  }, [loraOnlineOfferPayloadRef, setLoraOnlineFallbackOffer])

  const toggleShowSetup = useCallback(() => {
    setShowSetup((s) => !s)
  }, [])

  const openPartnerSetupPanel = useCallback(() => {
    setShowSetup(true)
  }, [])

  const refreshPackageIdSuggestions = useCallback(async () => {
    const r = await fetchPackageIdHistory()
    if (!r.ok) return
    const seen = new Set<string>()
    for (const x of [r.current, ...(r.history ?? []), ...(r.discovered ?? [])]) {
      const t = (x || '').trim()
      if (/^0x[a-fA-F0-9]{64}$/.test(t)) seen.add(t.toLowerCase())
    }
    setPackageIdSuggestions([...seen])
  }, [])

  useEffect(() => {
    if (!showSetup) return
    void refreshPackageIdSuggestions()
  }, [showSetup, refreshPackageIdSuggestions])

  const applyPackageIdBackend = useCallback(
    async (raw: string) => {
      const t = raw.trim()
      if (!/^0x[a-fA-F0-9]{64}$/.test(t)) {
        setStatus('error')
        setStatusMsg('Package-ID: 0x und 64 Hex-Zeichen.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      setPackageIdBusy(true)
      try {
        const res = await setPackageIdCommand(t)
        if (res.ok) {
          const s = await fetchStatus()
          if (!s.error) setApiStatus(s)
          setInboxPackageFilter(t)
          await loadMessages('reset')
          void refreshPackageIdSuggestions()
          setStatus('success')
          setStatusMsg('Package-ID gespeichert; Posteingang neu geladen.')
          setTimeout(() => setStatus('idle'), 5000)
        } else {
          setStatus('error')
          setStatusMsg(res.error || 'set-package-id fehlgeschlagen')
          setTimeout(() => setStatus('idle'), 6000)
        }
      } finally {
        setPackageIdBusy(false)
      }
    },
    [loadMessages, refreshPackageIdSuggestions, setStatus, setStatusMsg]
  )

  const applyInboxPackageFilterOnly = useCallback(async () => {
    const t = inboxPackageFilter.trim()
    setInboxPackageFilter(t)
    await loadMessages('reset', t || undefined)
  }, [inboxPackageFilter, loadMessages])

  const onExportEinsatzberichtJson = useCallback(async () => {
    if (messages.length === 0) {
      setStatus('error')
      setStatusMsg('Keine Nachrichten im Posteingang.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    try {
      setStatusMsg('Lade vollständigen Posteingang für Export…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten von der API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      downloadEinsatzberichtJson(full, { exportedByAddress: myAddress })
      setStatus('success')
      setStatusMsg(`Einsatzbericht (JSON) heruntergeladen – ${full.length} Nachricht(en), vollständiger Verlauf.`)
      setTimeout(() => setStatus('idle'), 5000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messages.length, messagesForExport, myAddress, setStatus, setStatusMsg])

  const onExportEinsatzberichtTxt = useCallback(async () => {
    if (messages.length === 0) {
      setStatus('error')
      setStatusMsg('Keine Nachrichten im Posteingang.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    try {
      setStatusMsg('Lade vollständigen Posteingang für Export…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten von der API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      downloadEinsatzberichtSummaryTxt(full, { exportedByAddress: myAddress })
      setStatus('success')
      setStatusMsg(`Kurzbericht (.txt) – ${full.length} Nachricht(en), vollständiger Verlauf.`)
      setTimeout(() => setStatus('idle'), 5000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messages.length, messagesForExport, myAddress, setStatus, setStatusMsg])

  const parseOptionalMessageIdsFromPrompt = (raw: string | null): string[] | undefined => {
    if (raw == null) return undefined
    const ids = raw
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean)
    return ids.length ? ids : undefined
  }

  const onExportEinsatzprotokoll = useCallback(async () => {
    if (messages.length === 0) {
      setStatus('error')
      setStatusMsg('Keine Nachrichten im Posteingang.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (typeof window === 'undefined') return
    const raw = window.prompt(
      'Optional: nur diese Nachrichten-IDs (kommagetrennt). Leer = gesamter Verlauf:'
    )
    if (raw === null) return
    const messageIds = parseOptionalMessageIdsFromPrompt(raw)
    const p1 = window.prompt('Passwort für das Protokoll-ZIP (mind. 8 Zeichen):')
    if (p1 == null) return
    if (p1.length < 8) {
      setStatus('error')
      setStatusMsg('Passwort zu kurz (mindestens 8 Zeichen).')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    const p2 = window.prompt('Passwort wiederholen:')
    if (p1 !== p2) {
      setStatus('error')
      setStatusMsg('Passwörter stimmen nicht überein.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    try {
      setStatusMsg('Lade vollständigen Posteingang für ZIP…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten von der API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      await downloadEinsatzprotokollZipPasswordProtected(full, { exportedByAddress: myAddress }, p1, {
        messageIds,
      })
      setStatus('success')
      setStatusMsg(
        `Einsatzbericht (${full.length} Nachrichten): *.zip.enc.json gespeichert. Passwort beim Export vergeben; zum Öffnen /einsatzbericht-decrypt.html.`
      )
      setTimeout(() => setStatus('idle'), 9000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messages.length, messagesForExport, myAddress, setStatus, setStatusMsg])

  const onExportEinsatzprotokollPlainZip = useCallback(async () => {
    if (messages.length === 0) {
      setStatus('error')
      setStatusMsg('Keine Nachrichten im Posteingang.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (typeof window === 'undefined') return
    if (
      !window.confirm(
        'Unverschlüsseltes ZIP herunterladen? Nur auf vertrauenswürdigen Geräten speichern (kein Passwort).'
      )
    ) {
      return
    }
    try {
      setStatusMsg('Lade vollständigen Posteingang für ZIP…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten von der API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      downloadEinsatzprotokollZipPlain(full, { exportedByAddress: myAddress })
      setStatus('success')
      setStatusMsg(`Einsatzbericht als ZIP (${full.length} Nachrichten) – direkt entpackbar.`)
      setTimeout(() => setStatus('idle'), 7000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messages.length, messagesForExport, myAddress, setStatus, setStatusMsg])

  const onExportEinsatzprotokollMarked = useCallback(async () => {
    if (protokollMarkedIds.size === 0) {
      setStatus('error')
      setStatusMsg('Keine markierten Nachrichten (Stern in der Zeile).')
      setTimeout(() => setStatus('idle'), 6000)
      return
    }
    if (typeof window === 'undefined') return
    const p1 = window.prompt('Passwort für das Protokoll-ZIP (mind. 8 Zeichen):')
    if (p1 == null) return
    if (p1.length < 8) {
      setStatus('error')
      setStatusMsg('Passwort zu kurz (mindestens 8 Zeichen).')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    const p2 = window.prompt('Passwort wiederholen:')
    if (p1 !== p2) {
      setStatus('error')
      setStatusMsg('Passwörter stimmen nicht überein.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    try {
      setStatusMsg('Lade Posteingang für Export…')
      const full = await messagesForExport()
      const ids = [...protokollMarkedIds]
      const marked = full.filter((m) => ids.includes(m.id))
      if (marked.length === 0) {
        setStatus('error')
        setStatusMsg('Keine der markierten IDs im vollständigen Verlauf gefunden (veraltete Markierung?).')
        setTimeout(() => setStatus('idle'), 7000)
        return
      }
      await downloadEinsatzprotokollZipPasswordProtected(
        full,
        { exportedByAddress: myAddress },
        p1,
        { messageIds: ids }
      )
      setStatus('success')
      setStatusMsg(
        `Datei *.zip.enc.json (${marked.length} markierte von ${full.length} geladen). Entschlüsseln über /einsatzbericht-decrypt.html.`
      )
      setTimeout(() => setStatus('idle'), 9000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messagesForExport, myAddress, protokollMarkedIds, setStatus, setStatusMsg])

  const onHideInboxMessageLocal = useCallback((id: string) => {
    setHiddenInboxIds((prev) => {
      const n = new Set(prev)
      n.add(id)
      try {
        sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
  }, [])

  const onPurgeInboxMessageChain = useCallback(
    async (msg: Message) => {
      if (!msg.chainNonce || !msg.chainPurgeable) {
        setStatus('error')
        setStatusMsg(
          'On-chain Purge nicht möglich (nur Funk/Event oder fehlende Nonce). Siehe ENABLE_PURGE / MAILBOX_ID.'
        )
        setTimeout(() => setStatus('idle'), 8000)
        return
      }
      setSending(true)
      try {
        const r = await purgeMailboxMessage(msg.chainNonce, msg.from.startsWith('0x') ? msg.from : undefined)
        if (r.ok) {
          setHiddenInboxIds((prev) => {
            const n = new Set(prev)
            n.add(msg.id)
            try {
              sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...n]))
            } catch {
              /* ignore */
            }
            return n
          })
          setMessages((prev) => prev.filter((m) => m.id !== msg.id))
          setStatus('success')
          setStatusMsg('Nachricht auf der Chain gelöscht (Storage-Rebate).')
          void loadMessages()
        } else {
          setStatus('error')
          setStatusMsg(r.error || r.message || 'Purge fehlgeschlagen')
        }
      } finally {
        setSending(false)
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [loadMessages, setMessages, setStatus, setStatusMsg]
  )

  const toggleProtokollMark = useCallback((id: string) => {
    setProtokollMarkedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      try {
        sessionStorage.setItem('morg.protokoll.marked.ids', JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
  }, [])

  const toggleInboxSelection = useCallback((id: string) => {
    setSelectedInboxIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const selectAllVisibleInbox = useCallback(() => {
    setSelectedInboxIds(new Set(displayMessages.map((m) => m.id)))
  }, [displayMessages])

  const clearInboxSelection = useCallback(() => setSelectedInboxIds(new Set()), [])

  const onHideAllVisibleLocal = useCallback(() => {
    setHiddenInboxIds((prev) => {
      const n = new Set(prev)
      for (const m of displayMessages) n.add(m.id)
      try {
        sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
  }, [displayMessages])

  const onBulkHideSelected = useCallback(() => {
    setHiddenInboxIds((prev) => {
      const n = new Set(prev)
      for (const id of selectedInboxIds) n.add(id)
      try {
        sessionStorage.setItem('morg.inbox.hidden.ids', JSON.stringify([...n]))
      } catch {
        /* ignore */
      }
      return n
    })
    setSelectedInboxIds(new Set())
    setInboxSelectMode(false)
  }, [selectedInboxIds])

  const onBulkPurgeSelected = useCallback(async () => {
    const list = displayMessages.filter(
      (m) => selectedInboxIds.has(m.id) && m.chainPurgeable && m.chainNonce
    )
    if (list.length === 0) {
      setStatus('error')
      setStatusMsg('Keine purge-fähigen Nachrichten ausgewählt (Chain-Eintrag nötig).')
      setTimeout(() => setStatus('idle'), 7000)
      return
    }
    setSending(true)
    try {
      for (const msg of list) {
        const r = await purgeMailboxMessage(msg.chainNonce!, msg.from.startsWith('0x') ? msg.from : undefined)
        if (!r.ok) {
          setStatus('error')
          setStatusMsg(r.error || r.message || 'Purge fehlgeschlagen')
          setTimeout(() => setStatus('idle'), 8000)
          return
        }
        setHiddenInboxIds((prev) => new Set(prev).add(msg.id))
        setMessages((prev) => prev.filter((x) => x.id !== msg.id))
      }
      setStatus('success')
      setStatusMsg(`${list.length} Nachricht(en) auf der Chain gelöscht (Rebate).`)
      void loadMessages()
    } finally {
      setSending(false)
      setSelectedInboxIds(new Set())
      setInboxSelectMode(false)
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [displayMessages, selectedInboxIds, loadMessages, setMessages, setStatus, setStatusMsg])

  const onExportEinsatzberichtEncrypted = useCallback(async () => {
    if (messages.length === 0) {
      setStatus('error')
      setStatusMsg('Keine Nachrichten im Posteingang.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (typeof window === 'undefined') return
    const p1 = window.prompt('Passwort für verschlüsselten Einsatzbericht (mind. 8 Zeichen):')
    if (p1 == null) return
    if (p1.length < 8) {
      setStatus('error')
      setStatusMsg('Passwort zu kurz (mindestens 8 Zeichen).')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    const p2 = window.prompt('Passwort wiederholen:')
    if (p1 !== p2) {
      setStatus('error')
      setStatusMsg('Passwörter stimmen nicht überein.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    try {
      setStatusMsg('Lade vollständigen Posteingang für Export…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten von der API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      const json = JSON.stringify(buildEinsatzberichtPayload(full, { exportedByAddress: myAddress }), null, 2)
      const enc = await encryptEinsatzberichtUtf8(json, p1)
      downloadEinsatzberichtEncryptedJson(enc)
      setStatus('success')
      setStatusMsg(
        `Verschlüsselter Kurzbericht (${full.length} Nachrichten). Öffnen: /einsatzbericht-decrypt.html + Passwort.`
      )
      setTimeout(() => setStatus('idle'), 7000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messages.length, messagesForExport, myAddress, setStatus, setStatusMsg])

  return {
    isPrivate,
    role,
    myAddress,
    message,
    setMessage,
    recipient,
    setRecipient,
    partner,
    setPartner,
    sending,
    status,
    statusMsg,
    setStatus,
    setStatusMsg,
    showSetup,
    setShowSetup,
    toggleShowSetup,
    encrypted,
    setEncrypted,
    bossView,
    setBossView,
    apiStatus,
    mirrorQueuePending,
    inboxPackageFilter,
    setInboxPackageFilter,
    packageIdSuggestions,
    refreshPackageIdSuggestions,
    applyPackageIdBackend,
    applyInboxPackageFilterOnly,
    packageIdBusy,
    forcedTransport,
    setForcedTransport,
    morgPkgDeviceBusy,
    morgPkgFileRef,
    morgPkgDeviceFilesRef,
    directory,
    refreshContactDirectory,
    isMeshVerifiedForAddress,
    messages: displayMessages,
    setMessages,
    loading,
    loadingMore,
    loadError,
    loadMessages,
    loadMoreInbox,
    inboxHasMore,
    slideSequences,
    inboxRows,
    meshtastic,
    meshExportPw,
    setMeshExportPw,
    meshImportPw,
    setMeshImportPw,
    meshImportJson,
    setMeshImportJson,
    meshSyncBusy,
    setMeshSyncBusy,
    meshSyncMsg,
    setMeshSyncMsg,
    localPurgeBusy,
    setLocalPurgeBusy,
    contactBleAddress,
    setContactBleAddress,
    contactBleUuid,
    setContactBleUuid,
    contactBleBusy,
    setContactBleBusy,
    attachedBlobBase64,
    attachedTxtFile,
    attachedAudioBase64,
    attachedLora,
    compactMeta,
    compactPreviewUrl,
    loraPreviewUrl,
    loraOnlineFallbackOffer,
    compactBusy,
    compactFileRef,
    clearCompactAttachment: clearCompactAttachmentAndSos,
    handleCompactAttachmentPick,
    ingestChatAttachmentFile,
    exportEcdhMorgPkgForMessage,
    onMorgPkgDeviceFiles,
    onMorgPkgImportFile,
    confirmLoraSendViaOnline,
    handleSend,
    handleHandshake,
    handleConnect,
    dismissLoraOnlineFallback,
    openPartnerSetupPanel,
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtEncrypted,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    delayMirrorToIota,
    setDelayMirrorToIota,
    protokollMarkedIds,
    toggleProtokollMark,
    onHideInboxMessageLocal,
    onPurgeInboxMessageChain,
    onHideAllVisibleLocal,
    inboxSelectMode,
    setInboxSelectMode,
    selectedInboxIds,
    toggleInboxSelection,
    selectAllVisibleInbox,
    clearInboxSelection,
    onBulkHideSelected,
    onBulkPurgeSelected,
    voicePhase,
    voiceActiveKind,
    voiceProgress01,
    voiceBusy,
    voiceRecording,
    onVoiceToggle,
    onVoiceEmergencyToggle,
    voiceNormalBlockedStart,
    voiceEmergencyBlockedStart,
    voiceMaxSeconds,
    voiceEmergencyMaxSeconds,
    sosVoiceFollowsOnline,
    sosVoiceAwaitingSend,
  }
}

export type ChatViewCoreState = ReturnType<typeof useChatViewCore>
