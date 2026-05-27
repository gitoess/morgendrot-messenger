'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { fetchAllInboxMessagesForExport } from '@/frontend/lib/api/inbox'
import { EinsatzleitungHub } from '@/frontend/components/einsatzleitung-hub'
import { BossHandoffExportPanel } from '@/frontend/components/boss-handoff-export-panel'
import { EinsatzRoleTemplatesPanel } from '@/frontend/components/einsatz-role-templates-panel'
import { ChatViewMyMailboxesPanel } from '@/frontend/components/chat-view-my-mailboxes-panel'
import { ChatViewPhonebookSection } from '@/frontend/components/chat-view-phonebook-section'
import { canCreateTeamMailbox } from '@/frontend/lib/messenger-role-capabilities'
import {
  downloadEinsatzberichtJson,
  downloadEinsatzberichtSummaryTxt,
  buildEinsatzberichtPayload,
} from '@/frontend/lib/einsatzbericht-export'
import { encryptEinsatzberichtUtf8, downloadEinsatzberichtEncryptedJson } from '@/frontend/lib/einsatzbericht-crypto'
import { downloadEinsatzprotokollZipPlain } from '@/frontend/lib/einsatzprotokoll-export'
import type { Message } from '@/frontend/lib/types'

export type EinsatzleitungViewProps = {
  apiSnapshot?: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
  refreshContactDirectory: () => void
  scrollToKontakteRequest?: number
}

export function EinsatzleitungView(p: EinsatzleitungViewProps) {
  const [forensicBusy, setForensicBusy] = useState(false)
  const [messageCountHint, setMessageCountHint] = useState<number | undefined>(undefined)
  const [statusMsg, setStatusMsg] = useState('')
  const [handoffExpanded, setHandoffExpanded] = useState(false)

  const handoffRef = useRef<HTMLElement>(null)
  const vorlagenRef = useRef<HTMLElement>(null)
  const kontakteRef = useRef<HTMLElement>(null)

  const isBoss = (p.apiSnapshot?.role || '').trim().toLowerCase() === 'boss'
  const myAddress = (p.apiSnapshot?.myAddressFull || p.apiSnapshot?.myAddress || '').trim()
  const walletValid = /^0x[a-fA-F0-9]{64}$/i.test(myAddress)

  const scrollToRef = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToHandoff = useCallback(() => {
    setHandoffExpanded(true)
    requestAnimationFrame(() => scrollToRef(handoffRef))
  }, [])

  const scrollToVorlagen = useCallback(() => {
    scrollToRef(vorlagenRef)
  }, [])

  useEffect(() => {
    if (p.scrollToKontakteRequest == null || p.scrollToKontakteRequest <= 0) return
    scrollToRef(kontakteRef)
  }, [p.scrollToKontakteRequest])

  const loadMessagesForExport = useCallback(async (): Promise<Message[]> => {
    const messages = await fetchAllInboxMessagesForExport({
      packageId: p.apiSnapshot?.packageId?.trim(),
      bossView: true,
      role: (p.apiSnapshot?.role || '').trim().toLowerCase(),
      pageSize: 200,
    })
    setMessageCountHint(messages.length)
    return messages
  }, [p.apiSnapshot?.packageId, p.apiSnapshot?.role])

  const runForensic = useCallback(
    async (fn: (messages: Message[]) => void | Promise<void>, emptyMsg: string) => {
      setForensicBusy(true)
      setStatusMsg('')
      try {
        const messages = await loadMessagesForExport()
        if (messages.length === 0) {
          setStatusMsg(emptyMsg)
          toast.error(emptyMsg)
          return
        }
        await fn(messages)
        toast.success('Export gestartet.')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setStatusMsg(msg)
        toast.error(msg)
      } finally {
        setForensicBusy(false)
      }
    },
    [loadMessagesForExport]
  )

  const onExportMessagesJson = useCallback(
    () =>
      runForensic(
        (messages) => downloadEinsatzberichtJson(messages, { exportedByAddress: myAddress }),
        'Keine Nachrichten zum Exportieren.'
      ),
    [myAddress, runForensic]
  )

  const onExportMessagesTxt = useCallback(
    () =>
      runForensic(
        (messages) => downloadEinsatzberichtSummaryTxt(messages, { exportedByAddress: myAddress }),
        'Keine Nachrichten zum Exportieren.'
      ),
    [myAddress, runForensic]
  )

  const onExportMessagesEncrypted = useCallback(async () => {
    const pw = window.prompt('Passwort für verschlüsselten Nachrichtenverlauf (min. 8 Zeichen):')?.trim()
    if (!pw || pw.length < 8) return
    await runForensic(async (messages) => {
      const json = JSON.stringify(buildEinsatzberichtPayload(messages, { exportedByAddress: myAddress }), null, 2)
      const enc = await encryptEinsatzberichtUtf8(json, pw)
      downloadEinsatzberichtEncryptedJson(enc)
    }, 'Keine Nachrichten zum Exportieren.')
  }, [runForensic, myAddress])

  const onExportProtokollZip = useCallback(
    () =>
      runForensic(
        (messages) => downloadEinsatzprotokollZipPlain(messages, { exportedByAddress: myAddress }),
        'Keine Nachrichten zum Exportieren.'
      ),
    [myAddress, runForensic]
  )

  return (
    <div className="space-y-8 pb-4">
      <EinsatzleitungHub
        apiStatus={p.apiSnapshot ?? null}
        contactDirectory={p.contactDirectory}
        onContactsChanged={p.refreshContactDirectory}
        onScrollToHandoffExport={isBoss ? scrollToHandoff : undefined}
        onScrollToEinsatzVorlagen={scrollToVorlagen}
        onExportMessagesJson={onExportMessagesJson}
        onExportMessagesTxt={onExportMessagesTxt}
        onExportMessagesEncrypted={onExportMessagesEncrypted}
        onExportProtokollZip={onExportProtokollZip}
        forensicExportBusy={forensicBusy}
        messageCountHint={messageCountHint}
      />

      {isBoss ? (
        <section
          id="einsatz-handoff-export"
          ref={handoffRef}
          className="scroll-mt-4 rounded-xl border border-purple-500/25 bg-card p-4"
        >
          <BossHandoffExportPanel
            apiSnapshot={p.apiSnapshot ?? null}
            contactDirectory={p.contactDirectory}
            forceExpanded={handoffExpanded}
            embedded
          />
        </section>
      ) : null}

      <section id="einsatz-vorlagen" ref={vorlagenRef} className="scroll-mt-4 rounded-xl border border-border bg-card p-4">
        <EinsatzRoleTemplatesPanel apiSnapshot={p.apiSnapshot ?? null} embedded />
      </section>

      {walletValid ? (
        <section id="einsatz-team-mailboxen" className="scroll-mt-4 rounded-xl border border-violet-500/25 bg-violet-500/[0.06] p-4">
          <h2 className="mb-2 text-base font-semibold text-foreground">Team-Mailboxen</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Team-Mailbox erstellen, beitreten, aktiv setzen — Mitglieder per Object-ID / QR einladen.
          </p>
          <ChatViewMyMailboxesPanel
            myAddressLine={myAddress}
            serverMailboxIdHint={p.apiSnapshot?.mailboxId}
            contactDirectory={p.contactDirectory}
            onContactsChanged={p.refreshContactDirectory}
            onStatus={(msg, kind) => (kind === 'success' ? toast.success(msg) : toast.error(msg))}
            teamMailboxCreateAllowed={canCreateTeamMailbox(p.apiSnapshot ?? null)}
          />
        </section>
      ) : null}

      <section id="einsatz-kontakte" ref={kontakteRef} className="scroll-mt-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-base font-semibold text-foreground">Kontakte verwalten</h2>
        <ChatViewPhonebookSection
          directory={p.contactDirectory}
          refreshContactDirectory={p.refreshContactDirectory}
          setStatusMsg={(msg) => setStatusMsg(msg)}
          myAddressLine={myAddress}
          serverMailboxId={p.apiSnapshot?.mailboxId}
          connectedAddresses={p.apiSnapshot?.connectedAddresses}
          embedded
          teamMailboxCreateAllowed={canCreateTeamMailbox(p.apiSnapshot ?? null)}
        />
      </section>

      {statusMsg ? (
        <p className="text-xs text-muted-foreground" role="status">
          {statusMsg}
        </p>
      ) : null}
    </div>
  )
}
