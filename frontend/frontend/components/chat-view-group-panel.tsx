'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { ContactPhonebookPickerDialog } from '@/frontend/components/contact-phonebook-picker-dialog'
import {
  createMessengerGroupId,
  deleteMessengerGroup,
  getActiveMessengerGroup,
  parseGroupMemberInput,
  readActiveGroupId,
  readMessengerGroups,
  upsertMessengerGroup,
  writeActiveGroupId,
  type MessengerGroupDefinition,
} from '@/frontend/lib/messenger-group-store'
import {
  groupMailboxTargetCount,
  readGroupMailboxSendAll,
  writeGroupMailboxSendAll,
} from '@/frontend/lib/group-mailbox-pairwise-send'
import { normalizeMeshtasticChannelIndex } from '@/frontend/lib/meshtastic-channel-index'

export type ChatViewGroupPanelProps = {
  contactDirectory: Record<string, ContactMeshEntryClient>
  myAddressLine?: string
  onGroupsChanged?: () => void
  onOpenPhonebook?: () => void
}

export function ChatViewGroupPanel(p: ChatViewGroupPanelProps) {
  const { contactDirectory, myAddressLine = '', onGroupsChanged, onOpenPhonebook } = p
  const [groups, setGroups] = useState<MessengerGroupDefinition[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [membersText, setMembersText] = useState('')
  const [streamsAnchorId, setStreamsAnchorId] = useState('')
  const [secondaryChannelIndex, setSecondaryChannelIndex] = useState('')
  const [secondaryChannelName, setSecondaryChannelName] = useState('')
  const [secondaryPskRef, setSecondaryPskRef] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [phonebookPickerOpen, setPhonebookPickerOpen] = useState(false)
  const [sendAllMembers, setSendAllMembers] = useState(() => readGroupMailboxSendAll())

  const reload = useCallback(() => {
    setGroups(readMessengerGroups())
    setActiveId(readActiveGroupId())
    const active = getActiveMessengerGroup()
    if (active) {
      setName(active.name)
      setMembersText(active.memberAddresses.join('\n'))
      setStreamsAnchorId(active.streamsAnchorId ?? '')
      setSecondaryChannelIndex(
        active.secondaryChannel?.channelIndex != null ? String(active.secondaryChannel.channelIndex) : ''
      )
      setSecondaryChannelName(active.secondaryChannel?.channelName ?? '')
      setSecondaryPskRef(active.secondaryChannel?.pskRef ?? '')
    } else {
      setName('')
      setMembersText('')
      setStreamsAnchorId('')
      setSecondaryChannelIndex('')
      setSecondaryChannelName('')
      setSecondaryPskRef('')
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const directoryAddrs = useMemo(
    () =>
      Object.keys(contactDirectory)
        .map((a) => a.trim())
        .filter((a) => /^0x[a-fA-F0-9]{64}$/i.test(a)),
    [contactDirectory]
  )

  const saveGroup = useCallback(() => {
    const memberAddresses = parseGroupMemberInput(membersText)
    if (memberAddresses.length === 0) {
      setMsg('Mindestens eine gültige Mitglieder-Adresse (0x + 64 Hex) eintragen.')
      return
    }
    const id = activeId ?? createMessengerGroupId()
    const anchor = streamsAnchorId.trim()
    const normalizedSecondaryIndex = normalizeMeshtasticChannelIndex(secondaryChannelIndex)
    const secondaryName = secondaryChannelName.trim()
    const secondaryPsk = secondaryPskRef.trim()
    upsertMessengerGroup({
      id,
      name: name.trim() || `Gruppe (${memberAddresses.length})`,
      memberAddresses,
      ...(anchor && /^0x[a-fA-F0-9]{64}$/i.test(anchor) ? { streamsAnchorId: anchor } : {}),
      ...(normalizedSecondaryIndex != null || secondaryName || secondaryPsk
        ? {
            secondaryChannel: {
              ...(normalizedSecondaryIndex != null ? { channelIndex: normalizedSecondaryIndex } : {}),
              ...(secondaryName ? { channelName: secondaryName } : {}),
              ...(secondaryPsk ? { pskRef: secondaryPsk } : {}),
            },
          }
        : {}),
    })
    writeActiveGroupId(id)
    setMsg('Gruppe gespeichert.')
    reload()
    onGroupsChanged?.()
  }, [
    activeId,
    membersText,
    name,
    onGroupsChanged,
    reload,
    streamsAnchorId,
    secondaryChannelIndex,
    secondaryChannelName,
    secondaryPskRef,
  ])

  const selectGroup = useCallback(
    (id: string) => {
      writeActiveGroupId(id)
      reload()
      onGroupsChanged?.()
    },
    [onGroupsChanged, reload]
  )

  const newGroup = useCallback(() => {
    writeActiveGroupId(null)
    setActiveId(null)
    setName('')
    setMembersText(directoryAddrs.join('\n'))
    setStreamsAnchorId('')
    setSecondaryChannelIndex('')
    setSecondaryChannelName('')
    setSecondaryPskRef('')
    setMsg('Neue Gruppe — Name und Mitglieder eintragen, dann speichern.')
  }, [directoryAddrs])

  const removeGroup = useCallback(() => {
    if (!activeId) return
    deleteMessengerGroup(activeId)
    setMsg('Gruppe gelöscht.')
    reload()
    onGroupsChanged?.()
  }, [activeId, onGroupsChanged, reload])

  const applyPhonebookSelection = useCallback(
    (picked: string[]) => {
      const merged = parseGroupMemberInput([membersText, ...picked].join('\n'))
      setMembersText(merged.join('\n'))
      setMsg(`${picked.length} Kontakt(e) übernommen — „Gruppe speichern“ nicht vergessen.`)
    },
    [membersText]
  )

  const openPhonebook = useCallback(() => {
    onOpenPhonebook?.()
  }, [onOpenPhonebook])

  const active = getActiveMessengerGroup()

  return (
    <section className="mb-4 rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Users className="h-4 w-4 text-violet-400" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">Gruppenchat (M2)</h3>
      </div>
      {groups.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => selectGroup(g.id)}
              className={
                activeId === g.id
                  ? 'rounded-md bg-violet-600 px-2 py-1 text-xs font-medium text-white'
                  : 'rounded-md border border-border px-2 py-1 text-xs hover:bg-muted'
              }
            >
              {g.name} ({g.memberAddresses.length})
            </button>
          ))}
        </div>
      ) : null}
      <div className="space-y-2">
        <label className="block text-[10px] font-medium text-muted-foreground">Gruppenname</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Einsatz Alpha"
          className="w-full max-w-md rounded-md border border-border bg-input px-2 py-1.5 text-xs text-foreground"
        />
        <label className="block text-[10px] font-medium text-muted-foreground">
          Mitglieder (je Zeile oder Komma, 0x + 64 Hex)
        </label>
        <textarea
          value={membersText}
          onChange={(e) => setMembersText(e.target.value)}
          rows={4}
          spellCheck={false}
          className="w-full max-w-lg rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
        />
        <label className="block text-[10px] font-medium text-muted-foreground">
          Streams-Anchor (optional, M2b — Metadaten bei Gruppensendung)
        </label>
        <input
          type="text"
          value={streamsAnchorId}
          onChange={(e) => setStreamsAnchorId(e.target.value)}
          placeholder="0x… Anchor-Object-ID (64 Hex)"
          spellCheck={false}
          className="w-full max-w-lg rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
        />
        <label className="block text-[10px] font-medium text-muted-foreground">
          Meshtastic Secondary (optional: Index 0-7, Name, PSK-Referenz)
        </label>
        <div className="grid max-w-lg gap-2 sm:grid-cols-3">
          <input
            type="number"
            min={0}
            max={7}
            step={1}
            value={secondaryChannelIndex}
            onChange={(e) => setSecondaryChannelIndex(e.target.value)}
            placeholder="Index 0-7"
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-[11px]"
          />
          <input
            type="text"
            value={secondaryChannelName}
            onChange={(e) => setSecondaryChannelName(e.target.value)}
            placeholder="Kanalname"
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-[11px]"
          />
          <input
            type="text"
            value={secondaryPskRef}
            onChange={(e) => setSecondaryPskRef(e.target.value)}
            placeholder="PSK-Ref (kein Secret)"
            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-[11px]"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Nur Metadaten. Secret-PSK bleibt in Meshtastic-App/Handoff, nicht im Klartext-Store.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveGroup}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            Gruppe speichern
          </button>
          <button type="button" onClick={newGroup} className="rounded-md border border-border px-3 py-1.5 text-xs">
            Neue Gruppe
          </button>
          <button
            type="button"
            onClick={() => setPhonebookPickerOpen(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs"
          >
            Aus Telefonbuch…
          </button>
          <button
            type="button"
            onClick={openPhonebook}
            disabled={!onOpenPhonebook}
            className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Telefonbuch öffnen
          </button>
          {activeId ? (
            <button
              type="button"
              onClick={removeGroup}
              className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive"
            >
              Aktive Gruppe löschen
            </button>
          ) : null}
        </div>
        {active ? (
          <>
            <p className="text-[10px] text-muted-foreground">
              Aktiv: <strong className="text-foreground">{active.name}</strong> — Posteingang zeigt Nachrichten mit{' '}
              {active.memberAddresses.length} Mitgliedern.
            </p>
            <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-border/80 bg-muted/20 px-2.5 py-2">
              <input
                type="checkbox"
                checked={sendAllMembers}
                onChange={(e) => {
                  const v = e.target.checked
                  setSendAllMembers(v)
                  writeGroupMailboxSendAll(v)
                }}
                className="mt-0.5"
              />
              <span className="text-[10px] leading-snug text-muted-foreground">
                <strong className="text-foreground">Mailbox an alle Mitglieder</strong> (online + Persistent): je
                Mitglied eine pairwise Chain-Nachricht (
                {groupMailboxTargetCount(active, myAddressLine)}× Fee, kein gemeinsamer Gruppenraum). Aus: nur die 0x im
                Composer
                unten.
              </span>
            </label>
          </>
        ) : (
          <p className="text-[10px] text-amber-700 dark:text-amber-300">Keine aktive Gruppe — speichern oder aus Liste wählen.</p>
        )}
        {msg ? <p className="text-[10px] text-foreground">{msg}</p> : null}
      </div>
      <ContactPhonebookPickerDialog
        open={phonebookPickerOpen}
        onOpenChange={setPhonebookPickerOpen}
        directory={contactDirectory}
        title="Mitglieder aus Telefonbuch"
        description="Kontakte auswählen — sie werden der Mitgliederliste hinzugefügt (Duplikate werden ignoriert)."
        confirmLabel="Zur Gruppe hinzufügen"
        onConfirm={applyPhonebookSelection}
      />
    </section>
  )
}
