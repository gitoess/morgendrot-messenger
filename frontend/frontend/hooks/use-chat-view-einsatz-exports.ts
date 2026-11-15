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
  unlockRememberedPassphraseMessagesForExport,
  type EinsatzberichtContentMode,
} from '@/frontend/lib/einsatzbericht-export'
import { encryptEinsatzberichtUtf8, downloadEinsatzberichtEncryptedJson } from '@/frontend/lib/einsatzbericht-crypto'
import {
  downloadEinsatzprotokollZipPasswordProtected,
  downloadEinsatzprotokollZipPlain,
  downloadMorgMediaZipOnly,
  downloadMorgMediaFilesDirect,
  type MorgMediaKindFilter,
} from '@/frontend/lib/einsatzprotokoll-export'
import type { Message } from '@/frontend/lib/types'
import type { ApiStatus } from '@/frontend/lib/api'
import { exportDataDeniedReason } from '@/frontend/lib/messenger-capability-gates'

export type ExportMessagesScope = 'all' | 'visibleChat'

export type UseChatViewEinsatzExportsParams = {
  messagesLength: number
  messagesForExport: (opts?: { scope?: ExportMessagesScope }) => Promise<Message[]>
  myAddress: string
  protokollMarkedIds: Set<string>
  setStatus: (s: 'idle' | 'success' | 'error') => void
  setStatusMsg: (msg: string) => void
  /** Aus `useChatViewApiStatusPoll` — bei `true` vor Export zusätzlich bestätigen (§ H.6c). */
  deviceTimeTrustWarn: boolean
  apiStatus?: ApiStatus | null
}

export type EinsatzExportUiOpts = {
  scope?: ExportMessagesScope
  contentMode?: EinsatzberichtContentMode
}

/** Vor forensischen Downloads: Nutzer explizit einbinden, wenn die Geräte-Uhr unsicher ist. */
export function confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn: boolean): boolean {
  if (!deviceTimeTrustWarn || typeof window === 'undefined') return true
  return window.confirm(
    'Hinweis: Die Geräte-Uhr ist nicht gegen Basis (HTTP-Datum) oder GPS abgesichert. Zeitstempel im Export können für Auswertung oder Attestation unzuverlässig sein.\n\nTrotzdem exportieren?'
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

  /** Passphrase-Unlock vor Export (außer „Versiegelt als Platzhalter“). */
  const prepareExportMessages = useCallback(
    async (
      scope: ExportMessagesScope | undefined,
      contentMode?: EinsatzberichtContentMode
    ): Promise<{ messages: Message[]; unlocked: number; stillSealed: number }> => {
      const full = await messagesForExport({ scope: scope ?? 'all' })
      if (contentMode === 'redactEncrypted') {
        return { messages: full, unlocked: 0, stillSealed: 0 }
      }
      return unlockRememberedPassphraseMessagesForExport(full)
    },
    [messagesForExport]
  )

  const onExportEinsatzberichtJson = useCallback(
    async (ui?: EinsatzExportUiOpts) => {
      if (!guardExport()) return
      if (messagesLength === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten im Posteingang.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
      try {
        setStatusMsg('Lade vollständigen Posteingang für Export…')
        const prep = await prepareExportMessages(ui?.scope, ui?.contentMode)
        if (prep.messages.length === 0) {
          setStatus('error')
          setStatusMsg('Keine Nachrichten von der API.')
          setTimeout(() => setStatus('idle'), 5000)
          return
        }
        downloadEinsatzberichtJson(prep.messages, { exportedByAddress: myAddress }, { contentMode: ui?.contentMode })
        setStatus('success')
        setStatusMsg(
          `JSON – ${prep.messages.length} Nachricht(en)` +
            (prep.unlocked || prep.stillSealed
              ? ` · ${prep.unlocked} entsperrt, ${prep.stillSealed} versiegelt`
              : '') +
            '.'
        )
        setTimeout(() => setStatus('idle'), 7000)
      } catch (e) {
        setStatus('error')
        setStatusMsg(e instanceof Error ? e.message : String(e))
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [messagesLength, prepareExportMessages, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport]
  )

  const onExportEinsatzberichtTxt = useCallback(
    async (ui?: EinsatzExportUiOpts) => {
      if (!guardExport()) return
      if (messagesLength === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten im Posteingang.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
      try {
        setStatusMsg('Lade vollständigen Posteingang für Export…')
        const prep = await prepareExportMessages(ui?.scope, ui?.contentMode)
        if (prep.messages.length === 0) {
          setStatus('error')
          setStatusMsg('Keine Nachrichten von der API.')
          setTimeout(() => setStatus('idle'), 5000)
          return
        }
        downloadEinsatzberichtSummaryTxt(prep.messages, { exportedByAddress: myAddress }, {
          contentMode: ui?.contentMode,
        })
        setStatus('success')
        setStatusMsg(
          `Text kurz – ${prep.messages.length} Nachricht(en)` +
            (prep.unlocked || prep.stillSealed
              ? ` · ${prep.unlocked} entsperrt, ${prep.stillSealed} versiegelt`
              : '') +
            '.'
        )
        setTimeout(() => setStatus('idle'), 7000)
      } catch (e) {
        setStatus('error')
        setStatusMsg(e instanceof Error ? e.message : String(e))
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [messagesLength, prepareExportMessages, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport]
  )

  const onExportEinsatzberichtTxtFull = useCallback(
    async (ui?: EinsatzExportUiOpts) => {
      if (!guardExport()) return
      if (messagesLength === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten im Posteingang.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
      try {
        setStatusMsg('Lade vollständigen Posteingang für Export…')
        const prep = await prepareExportMessages(ui?.scope, ui?.contentMode)
        if (prep.messages.length === 0) {
          setStatus('error')
          setStatusMsg('Keine Nachrichten von der API.')
          setTimeout(() => setStatus('idle'), 5000)
          return
        }
        downloadEinsatzberichtFullTxt(prep.messages, { exportedByAddress: myAddress }, {
          contentMode: ui?.contentMode,
        })
        setStatus('success')
        setStatusMsg(
          `TXT vollständig – ${prep.messages.length} Nachricht(en)` +
            (prep.unlocked || prep.stillSealed
              ? ` · ${prep.unlocked} entsperrt, ${prep.stillSealed} versiegelt`
              : '') +
            '.'
        )
        setTimeout(() => setStatus('idle'), 7000)
      } catch (e) {
        setStatus('error')
        setStatusMsg(e instanceof Error ? e.message : String(e))
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [messagesLength, prepareExportMessages, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport]
  )

  const onExportEinsatzprotokoll = useCallback(
    async (kinds?: MorgMediaKindFilter) => {
      if (!guardExport()) return
      if (messagesLength === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten im Posteingang.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
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
        const prep = await prepareExportMessages('all')
        const full = prep.messages
        if (full.length === 0) {
          setStatus('error')
          setStatusMsg('Keine Nachrichten von der API.')
          setTimeout(() => setStatus('idle'), 5000)
          return
        }
        await downloadEinsatzprotokollZipPasswordProtected(full, { exportedByAddress: myAddress }, p1, {
          messageIds,
          kinds: kinds ?? null,
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
    },
    [messagesLength, prepareExportMessages, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport]
  )

  const onExportEinsatzprotokollPlainZip = useCallback(
    async (kinds?: MorgMediaKindFilter) => {
      if (!guardExport()) return
      if (messagesLength === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten im Posteingang.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
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
        const prep = await prepareExportMessages('all')
        const full = prep.messages
        if (full.length === 0) {
          setStatus('error')
          setStatusMsg('Keine Nachrichten von der API.')
          setTimeout(() => setStatus('idle'), 5000)
          return
        }
        await downloadEinsatzprotokollZipPlain(full, { exportedByAddress: myAddress }, { kinds: kinds ?? null })
        setStatus('success')
        setStatusMsg(`Einsatzbericht als ZIP (${full.length} Nachrichten) – direkt entpackbar.`)
        setTimeout(() => setStatus('idle'), 7000)
      } catch (e) {
        setStatus('error')
        setStatusMsg(e instanceof Error ? e.message : String(e))
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [messagesLength, prepareExportMessages, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport]
  )

  const onExportEinsatzprotokollMarked = useCallback(async () => {
    if (!guardExport()) return
    if (protokollMarkedIds.size === 0) {
      setStatus('error')
      setStatusMsg('Keine markierten Nachrichten (Stern in der Zeile).')
      setTimeout(() => setStatus('idle'), 6000)
      return
    }
    if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
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
      const prep = await prepareExportMessages('all')
      const full = prep.messages
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
  }, [prepareExportMessages, myAddress, protokollMarkedIds, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport])

  const onExportEinsatzberichtEncrypted = useCallback(async () => {
    if (!guardExport()) return
    if (messagesLength === 0) {
      setStatus('error')
      setStatusMsg('Keine Nachrichten im Posteingang.')
      setTimeout(() => setStatus('idle'), 5000)
      return
    }
    if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
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
      const prep = await prepareExportMessages('all')
      const full = prep.messages
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
        `Verschlüsselter Vollbericht (${full.length} Nachrichten, kompletter Inhalt). Öffnen: /einsatzbericht-decrypt.html + Passwort.`
      )
      setTimeout(() => setStatus('idle'), 7000)
    } catch (e) {
      setStatus('error')
      setStatusMsg(e instanceof Error ? e.message : String(e))
      setTimeout(() => setStatus('idle'), 6000)
    }
  }, [messagesLength, prepareExportMessages, myAddress, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport])

  const onExportMorgMediaZip = useCallback(
    async (kinds: MorgMediaKindFilter) => {
      if (!guardExport()) return
      if (messagesLength === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten im Posteingang.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
      try {
        setStatusMsg('Extrahiere Medien aus dem Posteingang…')
        const prep = await prepareExportMessages('all')
        const { count } = await downloadMorgMediaZipOnly(prep.messages, { kinds })
        if (count === 0) {
          setStatus('error')
          setStatusMsg(
            'Keine passenden MORG-Medien in den Nachrichten (Telegram-Server-Medien sind nicht enthalten).'
          )
          setTimeout(() => setStatus('idle'), 7000)
          return
        }
        setStatus('success')
        setStatusMsg(`Medien-ZIP: ${count} Datei(en) unter medien/.`)
        setTimeout(() => setStatus('idle'), 7000)
      } catch (e) {
        setStatus('error')
        setStatusMsg(e instanceof Error ? e.message : String(e))
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [messagesLength, prepareExportMessages, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport]
  )

  const onExportMorgMediaDirect = useCallback(
    async (kinds: MorgMediaKindFilter) => {
      if (!guardExport()) return
      if (messagesLength === 0) {
        setStatus('error')
        setStatusMsg('Keine Nachrichten im Posteingang.')
        setTimeout(() => setStatus('idle'), 5000)
        return
      }
      if (!confirmForensicExportIfDeviceTimeUntrusted(deviceTimeTrustWarn)) return
      try {
        setStatusMsg('Speichere Medien als Einzeldateien…')
        const prep = await prepareExportMessages('all')
        const { count } = await downloadMorgMediaFilesDirect(prep.messages, { kinds })
        if (count === 0) {
          setStatus('error')
          setStatusMsg(
            'Keine passenden MORG-Medien in den Nachrichten (Telegram-Server-Medien sind nicht enthalten).'
          )
          setTimeout(() => setStatus('idle'), 7000)
          return
        }
        setStatus('success')
        setStatusMsg(
          `${count} Datei(en) einzeln gespeichert (Browser: ggf. Mehrfach-Downloads erlauben).`
        )
        setTimeout(() => setStatus('idle'), 8000)
      } catch (e) {
        setStatus('error')
        setStatusMsg(e instanceof Error ? e.message : String(e))
        setTimeout(() => setStatus('idle'), 6000)
      }
    },
    [messagesLength, prepareExportMessages, setStatus, setStatusMsg, deviceTimeTrustWarn, guardExport]
  )

  return {
    onExportEinsatzberichtJson,
    onExportEinsatzberichtTxt,
    onExportEinsatzberichtTxtFull,
    onExportEinsatzprotokoll,
    onExportEinsatzprotokollPlainZip,
    onExportEinsatzprotokollMarked,
    onExportEinsatzberichtEncrypted,
    onExportMorgMediaZip,
    onExportMorgMediaDirect,
  }
}
