'use client'

/**
 * Einsatzbericht-/Protokoll-Export-Callbacks aus use-chat-view-core ausgelagert (Phase A: Hook schlanker halten).
 */

import { useCallback } from 'react'
import {
  downloadEinsatzberichtJson,
  downloadEinsatzberichtSummaryTxt,
  downloadEinsatzberichtFullTxt,
  buildEinsatzberichtPayload,
} from '@/frontend/lib/einsatzbericht-export'
import { encryptEinsatzberichtUtf8, downloadEinsatzberichtEncryptedJson } from '@/frontend/lib/einsatzbericht-crypto'
import {
  downloadEinsatzprotokollZipPasswordProtected,
  downloadEinsatzprotokollZipPlain,
} from '@/frontend/lib/einsatzprotokoll-export'
import type { Message } from '@/frontend/lib/types'
import type { ApiStatus } from '@/frontend/lib/api'
import { exportDataDeniedReason } from '@/frontend/lib/messenger-capability-gates'

export type UseChatViewEinsatzExportsParams = {
  messagesLength: number
  messagesForExport: () => Promise<Message[]>
  myAddress: string
  protokollMarkedIds: Set<string>
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
  /** Aus `useChatViewApiStatusPoll` — bei `true` vor Export zusätzlich bestätigen (§ H.6c). */
  deviceTimeTrustWarn: boolean
  apiStatus?: ApiStatus | null
}

/** Vor forensischen Downloads: Nutzer explizit einbinden, wenn die Geräte-Uhr unsicher ist. */
export function confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn: boolean): boolean {
  if (!deviceTimeTrustWarn || typeof window === 'undefined') return true
  return window.confirm(
    'Note: Device clock is not verified against basis (HTTP date) or GPS. Timestamps in the export may be unreliable for analysis or attestation.\n\nExport anyway?'
  )
}

function parseOptionalMessageIdsFromPrompt(raw: string | null): string[] | undefined {
  if (raw == null) return undefined
  const ids = raw
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  return ids.length ? ids : undefined
}

export function useChatViewEinsatzExports(p: UseChatViewEinsatzExportsParams) {
  const {
    messagesLength,
    messagesForExport,
    myAddress,
    protokollMarkedIds,
    setStatus,
    setStatusMsg,
    deviceTimeTrustWarn,
    apiStatus = null,
  } = p

  const guardExport = useCallback((): boolean => {
    const denied = exportDataDeniedReason(apiStatus)
    if (!denied) return true
    setStatus('error')
    setStatusMsg(denied)
    setTimeout(() => setStatus('idle'), 6000)
    return false
  }, [apiStatus, setStatus, setStatusMsg])

  const onExportEinsatzberichtJson = useCallback(async () => {
    if (!guardExport()) return
    if (messagesLength === 0) {
      setStatus('error')
      setStatusMsg('No messages in inbox.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
    try {
      setStatusMsg('Loading full inbox for export…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('No messages from the API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      downloadEinsatzberichtJson(full, { exportedByAddress: myAddress })
      setStatus('success')
      setStatusMsg(`Message history (JSON) – ${full.length} message(s), all fields.`)
      setTimeout(() => setStatus('idle'), 5000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messagesLength, messagesForExport, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport])

  const onExportEinsatzberichtTxt = useCallback(async () => {
    if (!guardExport()) return
    if (messagesLength === 0) {
      setStatus('error')
      setStatusMsg('No messages in inbox.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
    try {
      setStatusMsg('Loading full inbox for export…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('No messages from the API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      downloadEinsatzberichtSummaryTxt(full, { exportedByAddress: myAddress })
      setStatus('success')
      setStatusMsg(`Message history (text) – ${full.length} message(s), ~200 character preview each.`)
      setTimeout(() => setStatus('idle'), 5000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messagesLength, messagesForExport, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport])

  const onExportEinsatzberichtTxtFull = useCallback(async () => {
    if (!guardExport()) return
    if (messagesLength === 0) {
      setStatus('error')
      setStatusMsg('No messages in inbox.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
    try {
      setStatusMsg('Loading full inbox for export…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('No messages from the API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      downloadEinsatzberichtFullTxt(full, { exportedByAddress: myAddress })
      setStatus('success')
      setStatusMsg(`Message history (full TXT) – ${full.length} message(s), uncut.`)
      setTimeout(() => setStatus('idle'), 5000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messagesLength, messagesForExport, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport])

  const onExportEinsatzprotokoll = useCallback(async () => {
    if (!guardExport()) return
    if (messagesLength === 0) {
      setStatus('error')
      setStatusMsg('No messages in inbox.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
    if (typeof window === 'undefined') return
    const raw = window.prompt(
      'Optional: only these message IDs (comma-separated). Empty = full history:'
    )
    if (raw === null) return
    const messageIds = parseOptionalMessageIdsFromPrompt(raw)
    const p1 = window.prompt('Password for protocol ZIP (min. 8 characters):')
    if (p1 == null) return
    if (p1.length < 8) {
      setStatus('error')
      setStatusMsg('Password too short (at least 8 characters).')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    const p2 = window.prompt('Repeat password:')
    if (p1 !== p2) {
      setStatus('error')
      setStatusMsg('Passwords do not match.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    try {
      setStatusMsg('Loading full inbox for ZIP…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('No messages from the API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      await downloadEinsatzprotokollZipPasswordProtected(full, { exportedByAddress: myAddress }, p1, {
        messageIds,
      })
      setStatus('success')
      setStatusMsg(
        `Operation report (${full.length} messages): *.zip.enc.json saved. Password set at export; open via /einsatzbericht-decrypt.html.`
      )
      setTimeout(() => setStatus('idle'), 9000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messagesLength, messagesForExport, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport])

  const onExportEinsatzprotokollPlainZip = useCallback(async () => {
    if (!guardExport()) return
    if (messagesLength === 0) {
      setStatus('error')
      setStatusMsg('No messages in inbox.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
    if (typeof window === 'undefined') return
    if (
      !window.confirm(
        'Download unencrypted ZIP? Save only on trusted devices (no password).'
      )
    ) {
      return
    }
    try {
      setStatusMsg('Loading full inbox for ZIP…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('No messages from the API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      downloadEinsatzprotokollZipPlain(full, { exportedByAddress: myAddress })
      setStatus('success')
      setStatusMsg(`Operation report as ZIP (${full.length} messages) – directly unpackable.`)
      setTimeout(() => setStatus('idle'), 7000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messagesLength, messagesForExport, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport])

  const onExportEinsatzprotokollMarked = useCallback(async () => {
    if (!guardExport()) return
    if (protokollMarkedIds.size === 0) {
      setStatus('error')
      setStatusMsg('No marked messages (star in row).')
      setTimeout(() => setStatus('idle'), 6000)
      return
    }
    if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
    if (typeof window === 'undefined') return
    const p1 = window.prompt('Password for protocol ZIP (min. 8 characters):')
    if (p1 == null) return
    if (p1.length < 8) {
      setStatus('error')
      setStatusMsg('Password too short (at least 8 characters).')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    const p2 = window.prompt('Repeat password:')
    if (p1 !== p2) {
      setStatus('error')
      setStatusMsg('Passwords do not match.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    try {
      setStatusMsg('Loading inbox for export…')
      const full = await messagesForExport()
      const ids = [...protokollMarkedIds]
      const marked = full.filter((m) => ids.includes(m.id))
      if (marked.length === 0) {
        setStatus('error')
        setStatusMsg('None of the marked IDs found in full history (stale marking?).')
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
        `File *.zip.enc.json (${marked.length} marked of ${full.length} loaded). Decrypt via /einsatzbericht-decrypt.html.`
      )
      setTimeout(() => setStatus('idle'), 9000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messagesForExport, myAddress, protokollMarkedIds, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport])

  const onExportEinsatzberichtEncrypted = useCallback(async () => {
    if (!guardExport()) return
    if (messagesLength === 0) {
      setStatus('error')
      setStatusMsg('No messages in inbox.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
    if (typeof window === 'undefined') return
    const p1 = window.prompt('Password for encrypted operation report (min. 8 characters):')
    if (p1 == null) return
    if (p1.length < 8) {
      setStatus('error')
      setStatusMsg('Password too short (at least 8 characters).')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    const p2 = window.prompt('Repeat password:')
    if (p1 !== p2) {
      setStatus('error')
      setStatusMsg('Passwords do not match.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    try {
      setStatusMsg('Loading full inbox for export…')
      const full = await messagesForExport()
      if (full.length === 0) {
        setStatus('error')
        setStatusMsg('No messages from the API.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      const json = JSON.stringify(buildEinsatzberichtPayload(full, { exportedByAddress: myAddress }), null, 2)
      const enc = await encryptEinsatzberichtUtf8(json, p1)
      downloadEinsatzberichtEncryptedJson(enc)
      setStatus('success')
      setStatusMsg(
        `Encrypted full report (${full.length} messages, complete content). Open: /einsatzbericht-decrypt.html + password.`
      )
      setTimeout(() => setStatus('idle'), 7000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messagesLength, messagesForExport, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport])

  return {
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    onExportEinsatzberichtEncrypted,
  }
}
